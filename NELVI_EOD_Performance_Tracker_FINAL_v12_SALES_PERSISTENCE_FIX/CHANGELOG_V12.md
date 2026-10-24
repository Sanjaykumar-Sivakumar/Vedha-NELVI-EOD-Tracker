# V12 — Sales Count Persistence and Dashboard Fix

- Added one shared, more tolerant sales-count extractor for numbered EOD lines such as `2. Sales Count ~ 29`, `Sales Count: 29`, and `Today's Sales Count: 12`.
- Profile/dashboard records are normalized after loading from the API and browser cache; if a legacy row contains a blank/zero structured salesCount, the original EOD text is parsed as a fallback.
- Backend read fallback uses the same tolerant formats, so old EOD entries can contribute to sales performance without editing their original message.
- Original EOD text is preserved unchanged.

## Deploy
1. Deploy `index.html` and `logo.png` to Vercel.
2. Replace Apps Script `Code.gs`, save, then deploy a **New version** of the web app.
3. Keep the existing Script Properties (`SHEET_ID`, `TEAM_CODE`, `ADMIN_KEY`) unchanged.
4. Hard-refresh the website and test a fresh EOD containing `2. Sales Count ~ 29`.

Static JavaScript syntax checks and sales-parser tests passed for the supplied sample formats. A live Google Apps Script/Sheet deployment was not available for end-to-end verification.
