const SHEET_NAME = 'EOD_Tracker';
const PEOPLE_SHEET = 'Team_Members';
const TZ = 'Asia/Kolkata';

function getConfig_(){
  const p = PropertiesService.getScriptProperties();
  return {
    SHEET_ID: p.getProperty('SHEET_ID'),
    ADMIN_KEY: p.getProperty('ADMIN_KEY'),
    TEAM_CODE: p.getProperty('TEAM_CODE')
  };
}
function getSs_(){
  const c=getConfig_();
  if(!c.SHEET_ID) throw new Error('SHEET_ID is not configured in Script Properties.');
  return SpreadsheetApp.openById(c.SHEET_ID);
}
function ensureHeader_(sheet, header){
  if(sheet.getLastRow()===0){sheet.appendRow(header);return;}
  const lastCol=Math.max(1,sheet.getLastColumn());
  const current=sheet.getRange(1,1,1,lastCol).getValues()[0].map(v=>String(v||'').trim());
  const missing=header.filter(h=>!current.includes(h));
  if(missing.length){
    sheet.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  }
}
function migratePins_(sheet){
  const header=sheet.getRange(1,1,1,8).getValues()[0].map(String);
  const pinIndex=header.indexOf('pin');
  const hashIndex=header.indexOf('pinHash');
  if(pinIndex<0 || hashIndex>=0) return;
  sheet.getRange(1,5).setValue('pinHash');
  const last=sheet.getLastRow();
  if(last<2)return;
  const vals=sheet.getRange(2,5,last-1,1).getValues();
  vals.forEach((r,i)=>{if(r[0])sheet.getRange(i+2,5).setValue(hash_(String(r[0])));});
}
function getSheets_(){
  const ss=getSs_();
  let e=ss.getSheetByName(SHEET_NAME);
  if(!e)e=ss.insertSheet(SHEET_NAME);
  ensureHeader_(e,['id','date','name','text','newMails','followupMails','extraJson','tomorrowJson','createdAt','updatedAt','salesCount']);
  let p=ss.getSheetByName(PEOPLE_SHEET);
  if(!p)p=ss.insertSheet(PEOPLE_SHEET);
  if(p.getLastRow()===0)p.appendRow(['id','name','role','photo','pinHash','active','createdAt','updatedAt']);
  else migratePins_(p);
  return {ss,e,p};
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function getPublicPayload_(){
  const cache=CacheService.getScriptCache();
  const hit=cache.get('nelvi_public_v1');
  if(hit){try{return JSON.parse(hit);}catch(e){}}
  const s=getSheets_();
  const payload={ok:true,records:readRecords_(s.e),people:readPeople_(s.p),serverAt:new Date().toISOString()};
  try{cache.put('nelvi_public_v1',JSON.stringify(payload),45);}catch(e){}
  return payload;
}
function clearPublicCache_(){try{CacheService.getScriptCache().remove('nelvi_public_v1');}catch(e){}}
function doGet(e){
  try{
    if(e&&e.parameter&&e.parameter.warm==='1') return json_({ok:true,pong:true,serverAt:new Date().toISOString()});
    return json_(getPublicPayload_());}
  catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function doPost(e){
  try{
    const d=JSON.parse(e.postData&&e.postData.contents||'{}');
    switch(d.action){
      case 'ping':return json_({ok:true,pong:true,version:'v10-sales-excel-fast-login',serverAt:new Date().toISOString()});
      case 'authTeam':return authTeam_(d);
      case 'authAdmin':return authAdmin_(d);
      case 'authMember':return authMember_(d);
      case 'upsertEod':return upsertEod_(d);
      case 'deleteEod':return deleteEod_(d);
      case 'upsertPerson':return upsertPerson_(d);
      case 'deletePerson':return deletePerson_(d);
      case 'updatePhoto':return updatePhoto_(d);
      default:throw new Error('Unknown action.');
    }
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function authTeam_(d){
  const c=getConfig_();
  if(!c.TEAM_CODE)throw new Error('TEAM_CODE is not configured.');
  if(String(d.teamCode||'')!==String(c.TEAM_CODE))throw new Error('Invalid team access code.');
  // Keep authentication lightweight. The frontend opens immediately and loads records in the background.
  return json_({ok:true,authenticated:true,serverAt:new Date().toISOString(),version:'v10-sales-excel-fast-login'});
}
function authAdmin_(d){
  const c=getConfig_();
  if(!c.ADMIN_KEY || String(d.adminKey||'')!==String(c.ADMIN_KEY))throw new Error('Invalid Admin Key.');
  return json_({ok:true});
}
function hash_(value){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8);
  return bytes.map(b=>{const v=b<0?b+256:b;return ('0'+v.toString(16)).slice(-2);}).join('');
}
function findPerson_(sheet,name){
  const rows=sheet.getDataRange().getValues();
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][1]).trim().toLowerCase()===String(name).trim().toLowerCase()){
      return {row:i+1,id:String(rows[i][0]),name:String(rows[i][1]),role:String(rows[i][2]||''),photo:String(rows[i][3]||''),pinHash:String(rows[i][4]||''),active:rows[i][5]!==false};
    }
  }
  return null;
}
function authMember_(d){
  const s=getSheets_(),p=findPerson_(s.p,d.name);
  if(!p||!p.active||!p.pinHash||hash_(String(d.pin||''))!==p.pinHash)throw new Error('Incorrect PIN.');
  return json_({ok:true,person:{id:p.id,name:p.name,role:p.role,photo:p.photo}});
}
function requireAdmin_(d){
  const c=getConfig_();
  if(!c.ADMIN_KEY || String(d.adminKey||'')!==String(c.ADMIN_KEY))throw new Error('Admin access required.');
}
function requireOwner_(d){
  const s=getSheets_(),p=findPerson_(s.p,d.actor);
  if(!p||!p.active||!p.pinHash||hash_(String(d.actorPin||''))!==p.pinHash)throw new Error('Owner authentication failed.');
  return p;
}
function upsertEod_(d){
  const r=d.record||{};
  if(d.actor==='admin')requireAdmin_(d);
  else{
    const owner=requireOwner_(d);
    if(owner.name.toLowerCase()!==String(r.name||'').toLowerCase())throw new Error('You can only save EOD under your own profile.');
  }
  if(!r.date||!r.name||!r.text)throw new Error('Date, name and text are required.');
  const s=getSheets_(),values=s.e.getDataRange().getValues();let row=0;
  for(let i=1;i<values.length;i++){
    if(String(values[i][1])===String(r.date)&&String(values[i][2]).toLowerCase()===String(r.name).toLowerCase()){row=i+1;break;}
  }
  const now=new Date(),id=row?String(values[row-1][0]):String(r.id||('e_'+Date.now()));
  const headers=s.e.getRange(1,1,1,s.e.getLastColumn()).getValues()[0].map(v=>String(v||'').trim());
  const obj={id:id,date:r.date,name:r.name,text:r.text,newMails:Number(r.newMails||0),followupMails:Number(r.followupMails||0),extraJson:JSON.stringify(r.extra||[]),tomorrowJson:JSON.stringify(r.tomorrow||[]),createdAt:row?values[row-1][headers.indexOf('createdAt')>=0?headers.indexOf('createdAt'):8]:now,updatedAt:now,salesCount:Number(r.salesCount||parseSalesCount_(r.text)||0)};
  const data=row?values[row-1].slice():Array(headers.length).fill('');
  while(data.length<headers.length)data.push('');
  headers.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(obj,h))data[i]=obj[h];});
  if(row)s.e.getRange(row,1,1,headers.length).setValues([data]);else s.e.appendRow(data);
  clearPublicCache_();
  if(!findPerson_(s.p,r.name)&&d.actor==='admin'){
    s.p.appendRow(['p_'+Date.now(),r.name,'Team Member','', '',true,now,now]);
  }
  return json_({ok:true,record:readRecordRow_(data,headers)});
}
function deleteEod_(d){
  const s=getSheets_();
  if(d.actor==='admin')requireAdmin_(d);else requireOwner_(d);
  const values=s.e.getDataRange().getValues();let row=0;
  for(let i=1;i<values.length;i++){
    if(d.id&&String(values[i][0])===String(d.id)){row=i+1;break;}
  }
  if(!row)throw new Error('EOD record not found.');
  if(d.actor!=='admin'&&String(values[row-1][2]).toLowerCase()!==String(d.actor).toLowerCase())throw new Error('You can delete only your own EOD.');
  s.e.deleteRow(row);clearPublicCache_();return json_({ok:true});
}
function deletePerson_(d){
  requireAdmin_(d);
  const name=String(d.name||'').trim();
  if(!name)throw new Error('Profile name is required.');
  const s=getSheets_(),p=findPerson_(s.p,name);
  if(!p)throw new Error('Profile not found.');
  // Remove only the team-member profile. Existing EOD history is intentionally preserved.
  s.p.deleteRow(p.row);
  clearPublicCache_();
  return json_({ok:true,deleted:name,people:readPeople_(s.p)});
}
function updatePhoto_(d){
  const name=String(d.name||'').trim(),photo=String(d.photo||'');
  if(!name||!photo)throw new Error('Name and photo are required.');
  const s=getSheets_(),p=findPerson_(s.p,name);
  if(!p)throw new Error('Profile not found.');
  if(d.adminKey){requireAdmin_(d);}
  else {if(!d.pin||hash_(String(d.pin))!==p.pinHash)throw new Error('Incorrect PIN.');}
  if(photo.length>50000)throw new Error('Photo is too large.');
  s.p.getRange(p.row,4).setValue(photo);
  clearPublicCache_();
  return json_({ok:true,person:{id:p.id,name:p.name,role:p.role,photo:photo,active:p.active}});
}
function upsertPerson_(d){
  requireAdmin_(d);
  const p=d.person||{};if(!p.name)throw new Error('Name is required.');
  const s=getSheets_(),existing=findPerson_(s.p,p.name),now=new Date();
  const pinHash=p.pin?hash_(String(p.pin)):(existing?existing.pinHash:'');
  if(!existing&&!pinHash)throw new Error('Personal PIN is required for a new member.');
  const row=[existing?existing.id:(p.id||('p_'+Date.now())),p.name,p.role||'Team Member',p.photo||'',pinHash,p.active!==false,existing?existing.createdAt||now:now,now];
  if(existing)s.p.getRange(existing.row,1,1,8).setValues([row]);else s.p.appendRow(row);
  clearPublicCache_();
  return json_({ok:true,people:readPeople_(s.p)});
}
function readRecords_(sheet){
  const v=sheet.getDataRange().getValues();if(v.length<2)return[];
  const headers=v[0].map(x=>String(x||'').trim());
  return v.slice(1).filter(r=>r[headers.indexOf('id')>=0?headers.indexOf('id'):0]).map(r=>readRecordRow_(r,headers));
}
function parseSalesCount_(raw){
  const lines=String(raw||'').replace(/\r/g,'').split('\n');
  let inTomorrow=false,total=0,found=false;
  for(let i=0;i<lines.length;i++){
    const source=lines[i].trim();
    if(/TODAY.?S WORK/i.test(source))continue;
    if(/TOMORROW.?S PLAN/i.test(source)){inTomorrow=true;continue;}
    if(inTomorrow)continue;
    const line=source.replace(/^\d+[.)]\s*/,'').replace(/^[*_]+|[*_]+$/g,'').replace(/[：]/g,':').trim();
    const m=line.match(/(?:today(?:['’]s)?\s+)?sales(?:\s+count)?\s*(?:~|:|=|-|–|—)\s*(\d+)\b/i)
      ||line.match(/(?:total\s+sales|sales\s+done|number\s+of\s+sales)\s*(?:~|:|=|-|–|—)?\s*(\d+)\b/i);
    if(m){total+=Number(m[1]||0);found=true;}
  }
  return found?total:0;
}
function readRecordRow_(r,headers){
  const h=headers||['id','date','name','text','newMails','followupMails','extraJson','tomorrowJson','createdAt','updatedAt','salesCount'];
  const val=(key,fallback)=>{const i=h.indexOf(key);return i>=0?r[i]:r[fallback];};
  const text=String(val('text',3)||'');
  const stored=Number(val('salesCount',10)||0);
  return {id:String(val('id',0)||''),date:formatDate_(val('date',1)),name:String(val('name',2)||''),text:text,newMails:Number(val('newMails',4)||0),followupMails:Number(val('followupMails',5)||0),extra:safeJson_(val('extraJson',6)),tomorrow:safeJson_(val('tomorrowJson',7)),salesCount:stored>0?stored:parseSalesCount_(text),source:'remote'};
}
function readPeople_(sheet){
  const v=sheet.getDataRange().getValues();if(v.length<2)return[];
  return v.slice(1).filter(r=>r[0]&&r[1]).map(r=>({id:String(r[0]),name:String(r[1]),role:String(r[2]||''),photo:String(r[3]||''),active:r[5]!==false}));
}
function safeJson_(x){try{return x?JSON.parse(x):[];}catch(e){return[];}}
function formatDate_(x){
  if(Object.prototype.toString.call(x)==='[object Date]'&&!isNaN(x))return Utilities.formatDate(x,TZ,'yyyy-MM-dd');
  return String(x||'').slice(0,10);
}
