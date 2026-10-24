# V12 — Sales Count Persistence and Dashboard Fix

- Added a tolerant sales-count extractor for numbered EOD lines such as `2. Sales Count ~ 29`, `Sales Count: 29`, and `Today's Sales Count: 12`.
- Profile/dashboard records are normalized after loading from the API and browser cache; if a legacy row contains a blank/zero structured `salesCount`, the original EOD text is parsed as a fallback.
- Backend read fallback uses the same tolerant formats, so old EOD entries can contribute to sales performance without editing their original message.
- Original EOD text is preserved unchanged.
- Refined the Insights header: month picker and Excel export now align as a compact right-side control group on desktop, with clean tablet and mobile stacking; metric cards have safer responsive sizing.

## Deploy
1. Deploy `index.html` and `logo.png` to Vercel.
2. Replace Apps Script `Code.gs`, save, then deploy a **New version** of the web app.
3. Keep the existing Script Properties (`SHEET_ID`, `TEAM_CODE`, `ADMIN_KEY`) unchanged.
4. Hard-refresh the website and test a fresh EOD containing `2. Sales Count ~ 29`.

Static JavaScript syntax and sample sales-parser checks were performed earlier for this version. The responsive CSS update was checked for markup consistency; a live Google Apps Script/Sheet end-to-end test and device-browser visual QA were not available in this session.


## V12 fixed UI pass (2026-10-24)
- Reworked Management Insights month selector and Excel export alignment using responsive grid/flex sizing; controls stay aligned on desktop and stack cleanly on tablet/mobile.
- Added a separate “Top sales contributor” KPI to the main Dashboard, calculated from the selected month's Sales Performance statistics and showing sales count plus team share.
- Tightened minimum-width and overflow behavior for Insights cards at narrower viewport sizes.
- Re-ran static JavaScript syntax and DOM-ID reference checks after edits.
