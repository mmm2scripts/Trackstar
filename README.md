# Booga Booga Track - Cloudflare Worker (dashboard)

Files at the zip root: `worker.js` (the whole dashboard, deploy this) and `wrangler.toml`.
`src/` holds the editable source; `python3 src/build.py` regenerates `worker.js` (only if you edit it).

## Deploy with Wrangler
1. Edit `wrangler.toml`, set `API_URL` to your API's public https address.
2. `npx wrangler deploy`

## Deploy in the Cloudflare dashboard
1. Workers & Pages > Create > Worker > Edit code, paste all of `worker.js`, Deploy.
2. Settings > Variables: add `API_URL` = your API address (no trailing slash).

## First use
Open the Worker URL. It jumps to **Settings**, where the **Connection check** tests the Worker, your API, the key and your accounts, and tells you what to fix. Paste the API `ACCESS_KEY`, press **Save & test**, then use **Copy loader** on each Roblox account.

## "Cannot reach the API"
Open Settings > Connection check (or visit `/_diag` on your Worker). Usual causes:
- `API_URL` is still `https://your-api-domain.com` or empty.
- `API_URL` is a raw IP or an odd port (`http://1.2.3.4:3000`). Workers usually can't connect to those.
- The API isn't running, or a `trycloudflare.com` address changed after a restart.

Fix: put `TUNNEL=1` in the API's `.env` (needs `cloudflared`), restart the API, copy the https address it prints into `API_URL`.
No time to redeploy? Paste that address in Settings > **API address** and the dashboard talks to the API directly from your browser.
