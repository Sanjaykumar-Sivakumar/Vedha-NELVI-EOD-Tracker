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
  const current=sheet.getRange(1,1,1,header.length).getValues()[0].map(String);
  if(current.join('|')!==header.join('|')) sheet.getRange(1,1,1,header.length).setValues([header]);
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
  ensureHeader_(e,['id','date','name','text','newMails','followupMails','extraJson','tomorrowJson','createdAt','updatedAt']);
  let p=ss.getSheetByName(PEOPLE_SHEET);
  if(!p)p=ss.insertSheet(PEOPLE_SHEET);
  if(p.getLastRow()===0)p.appendRow(['id','name','role','photo','pinHash','active','createdAt','updatedAt']);
  else migratePins_(p);
  return {ss,e,p};
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){
  try{
    const s=getSheets_();
    return json_({ok:true,records:readRecords_(s.e),people:readPeople_(s.p)});
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function doPost(e){
  try{
    const d=JSON.parse(e.postData&&e.postData.contents||'{}');
    switch(d.action){
      case 'authTeam':return authTeam_(d);
      case 'authAdmin':return authAdmin_(d);
      case 'authMember':return authMember_(d);
      case 'upsertEod':return upsertEod_(d);
      case 'deleteEod':return deleteEod_(d);
      case 'upsertPerson':return upsertPerson_(d);
      default:throw new Error('Unknown action.');
    }
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function authTeam_(d){
  const c=getConfig_();
  if(!c.TEAM_CODE)throw new Error('TEAM_CODE is not configured.');
  if(String(d.teamCode||'')!==String(c.TEAM_CODE))throw new Error('Invalid team access code.');
  const s=getSheets_();
  return json_({ok:true,people:readPeople_(s.p),records:readRecords_(s.e)});
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
  const data=[id,r.date,r.name,r.text,Number(r.newMails||0),Number(r.followupMails||0),JSON.stringify(r.extra||[]),JSON.stringify(r.tomorrow||[]),row?values[row-1][8]:now,now];
  if(row)s.e.getRange(row,1,1,data.length).setValues([data]);else s.e.appendRow(data);
  if(!findPerson_(s.p,r.name)&&d.actor==='admin'){
    s.p.appendRow(['p_'+Date.now(),r.name,'Team Member','', '',true,now,now]);
  }
  return json_({ok:true,record:readRecordRow_(data)});
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
  s.e.deleteRow(row);return json_({ok:true});
}
function upsertPerson_(d){
  requireAdmin_(d);
  const p=d.person||{};if(!p.name)throw new Error('Name is required.');
  const s=getSheets_(),existing=findPerson_(s.p,p.name),now=new Date();
  const pinHash=p.pin?hash_(String(p.pin)):(existing?existing.pinHash:'');
  if(!existing&&!pinHash)throw new Error('Personal PIN is required for a new member.');
  const row=[existing?existing.id:(p.id||('p_'+Date.now())),p.name,p.role||'Team Member',p.photo||'',pinHash,p.active!==false,existing?existing.createdAt||now:now,now];
  if(existing)s.p.getRange(existing.row,1,1,8).setValues([row]);else s.p.appendRow(row);
  return json_({ok:true,people:readPeople_(s.p)});
}
function readRecords_(sheet){
  const v=sheet.getDataRange().getValues();if(v.length<2)return[];
  return v.slice(1).filter(r=>r[0]).map(readRecordRow_);
}
function readRecordRow_(r){
  return {id:String(r[0]),date:formatDate_(r[1]),name:String(r[2]||''),text:String(r[3]||''),newMails:Number(r[4]||0),followupMails:Number(r[5]||0),extra:safeJson_(r[6]),tomorrow:safeJson_(r[7]),source:'remote'};
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
