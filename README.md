# Booga Booga Track - Cloudflare Worker (dashboard)

Files are at the zip root: `worker.js`, `wrangler.toml`.

## Deploy with Wrangler
1. Edit `wrangler.toml` and set `API_URL` to your API's public https URL.
2. `npx wrangler deploy`

## Deploy in the Cloudflare dashboard
1. Workers & Pages > Create > Worker > Edit code, paste `worker.js`, deploy.
2. Settings > Variables: add `API_URL` = your API URL (no trailing slash).

## First use
Open the Worker URL > Settings > paste your API `ACCESS_KEY` > Save.
Then click **Copy loader** and run the copied line in your Roblox executor on each account.

The dashboard calls `/api/*` on the Worker itself, which forwards to your API, so there are no CORS problems.
