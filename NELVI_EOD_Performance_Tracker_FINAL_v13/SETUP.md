# NELVI EOD Performance Tracker — Deployment

## What this project does

- Common Team Access Code for everyone.
- Everyone can view all team profiles, mail analytics and EOD history.
- Each member has a private PIN issued by Admin.
- Correct PIN unlocks **Add EOD** and **Delete own EOD only** for that profile.
- Admin Key unlocks full management.
- New mails are the only competitive Mail KPI.
- Follow-up / reminder mails are tracked separately and excluded from Mail Leaderboard.
- Non-mail / role work is preserved and shown as separate Work Performance.
- Original WhatsApp EOD text is stored exactly as submitted.
- Monthly and all-time views, rankings, contribution %, daily trend, profile history, calendar, and Excel (.xlsx) export are included.
- Separate Sales Performance page parses explicit “Today's Sales Count: N” entries from EOD messages and provides monthly totals, leaderboard, contribution pie/donut, performance bars, and daily trend.
- Login validates the team code first, opens the portal quickly, then loads shared records in the background.
- Existing EOD sheet data is preserved; the backend appends a `salesCount` column when it is first used.
- No external chart library is required, which keeps the portal lighter and faster.

## 1. Google Sheet

Create a Google Sheet, then copy its Spreadsheet ID.

Your current Sheet ID:

`1LLalYQa9ZO8mOkRpHmd2RSDS-C-2ilNJhFOixQl7Gxk`

Do not make the sheet public.

## 2. Google Apps Script

In the Google Sheet:

**Extensions → Apps Script**

Replace the default `Code.gs` with the supplied `Code.gs`. The updated script safely adds the `salesCount` column to the existing `EOD_Tracker` header without clearing existing EOD rows.

Save.

## 3. Script Properties

Apps Script → **Project Settings → Script Properties**

Add:

| Property | Value |
|---|---|
| `SHEET_ID` | `1LLalYQa9ZO8mOkRpHmd2RSDS-C-2ilNJhFOixQl7Gxk` |
| `TEAM_CODE` | Choose your common team code |
| `ADMIN_KEY` | Choose your private admin key |

Example only:

`TEAM_CODE = NELVI2026`

`ADMIN_KEY = NELVI_ADMIN_2026@Secure#7391`

Do not publish your real Admin Key.

## 4. Deploy Apps Script

Click:

**Deploy → New deployment → Select type → Web app**

Use:

- **Execute as:** Me
- **Who has access:** Anyone

Click **Deploy**.

Copy the URL ending in:

`/exec`

## 5. Put the Apps Script URL into the website

Open:

`index.html`

At the top of the JavaScript, find:

```js
const CONFIG={API_URL:'YOUR_URL'};
```

Replace `YOUR_URL` with your `/exec` URL.

The current package already contains the Apps Script URL from the previous project. If you redeploy the Apps Script and receive a new URL, update it here.

## 6. Deploy to Vercel

Upload the contents of this project to a GitHub repository or directly deploy the project folder with Vercel.

The required web files are:

- `index.html`
- `logo.png`

`Code.gs` is supplied for your Apps Script deployment and does not need to be served by Vercel.

## 7. First setup inside the portal

1. Enter the Team Access Code.
2. Open **Team Profiles**.
3. Admin → **Add Team Member**.
4. Enter:
   - Name
   - Position / Role
   - Photo URL (optional)
   - Personal PIN
5. Give that PIN privately to the employee.

## 8. Employee workflow

Employee opens the same Vercel URL:

**Team Code → Team Profiles → their profile → Unlock my EOD → PIN**

After the correct PIN:

- Add EOD appears.
- They can submit their own EOD.
- They can delete only their own EOD.
- They cannot add/delete another employee's EOD.

Everyone can still view all team performance and EOD history.

## 9. Admin workflow

Admin clicks:

**Admin Access → Admin Key**

Admin can:

- Add/edit team profiles.
- Set/reset employee PINs.
- Add EOD for any profile.
- Delete any EOD.
- View all analytics.

## Important note about performance %

### Mail contributors

Mail Performance % = employee's share of total **new mails** for the selected month.

Follow-up/reminder mails are excluded.

### Non-mail / role contributors

Role Work Activity % = documented non-mail work items relative to the highest documented non-mail work-item volume in that selected month.

This is intentionally a transparent activity indicator, not a claim that every role has an identical workload.

If you later want role-specific targets (for example, video editing = X videos/month, design = X creatives/month), the tracker can be extended to calculate target-based percentages.

## EOD parser example

For:

`Total Mail Delivery Sent ~ 11 / 50`

the tracker records:

- New mails = **11**
- Target = **50**
- It does not count 50 as output.

A line such as:

`14-day remainder follow up mail for UK buyers`

is treated as follow-up/reminder context and is not counted as 14 new mails.

## Speed

The portal avoids the previous login pattern of:

1. authenticate
2. then immediately make a second full data request

The team login now receives people + EOD data in the same authenticated response.

The portal also avoids a heavy chart library and renders charts with lightweight inline SVG.

Google Apps Script can still have a cold-start delay on an idle deployment; that part is controlled by Google's runtime, not the browser. The new client flow minimizes the additional delay caused by the website itself.


## Version 10 changes

- Login validates the Team Access Code without reading the full spreadsheet. The portal opens quickly, uses the browser's cached snapshot if available, and refreshes shared records in the background.
- Sales Performance is separate from Mail Performance and Work Performance. Enter a line such as `Today's Sales Count: 12` in the EOD message under Today's Work. The number is stored with that EOD and appears in monthly sales totals, rankings, contribution chart, performance bars, daily trend, profile history, and Excel export.
- Existing EOD messages are preserved. The backend safely appends a `salesCount` column and can derive sales counts from older raw EOD messages if the structured field is blank.
- Insights exports a real `.xlsx` workbook (not CSV renamed to Excel), with Monthly Summary, Sales Performance, Mail Performance, and EOD Details sheets. Data is readable in ordinary workbook cells; no workbook encryption is applied.

## Updating to V10

1. Deploy `index.html` to Vercel (the ZIP also includes `NELVI Scorecard and Performance Tracker.html`).
2. Replace the current Apps Script source with V10 `Code.gs`, save, then **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the same Script Properties (`SHEET_ID`, `TEAM_CODE`, `ADMIN_KEY`) and existing spreadsheet.
3. Reload the website. The existing EOD and Team_Members rows are not deleted.
