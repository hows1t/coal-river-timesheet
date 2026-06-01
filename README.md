# Coal River Coaches Timesheet

Mobile-first web app for Coal River Coaches staff to fill in their
fortnightly hours and send the completed timesheet to accounts.

## Features

- Mobile-first, branded with the Coal River blue
- Smart time entry (`0600`, `6:00`, `6` all work) — auto-calculates totals
- Up to 3 shifts per day
- Tasmanian public holiday auto-detection (2025–2027, Hobart area)
- Generates the **exact same .xlsx template** accounts already uses
- Web Share API on mobile attaches the file directly into the email app
- Pre-filled email template addressed to the accountant
- Print / save as PDF
- Remembers your details locally between visits

## Hosting

This is a pure static site — no backend, no build step. Just serve the files.

### Deploy to GitHub Pages (free)
1. Create a new public repo
2. Upload all the files in this folder
3. In repo Settings → Pages, set Source to "Deploy from branch" and pick `main` / `/` (root)
4. Visit `https://YOURNAME.github.io/REPO-NAME/Timesheet.html`

### Deploy to Netlify Drop (also free)
1. Visit https://app.netlify.com/drop
2. Drag this entire folder onto the page
3. Get your live URL instantly

## Files
- `Timesheet.html` — entry point
- `styles.css` — all styling
- `app.jsx` — main React app
- `components.jsx` — shared UI components
- `preview.jsx` — visual spreadsheet preview
- `utils.js` — time parsing, public holidays, calculations
- `xlsx-export.js` — generates the .xlsx by patching the embedded template
- `xlsx-template.js` — base64-encoded blank timesheet template
- `assets/logo.jpg` — company logo

## Accounts email
The app is hard-coded to email `accounts@coalrivercoaches.com.au`.
To change this, edit the `ACCOUNTS_EMAIL` constant at the top of `app.jsx`.
