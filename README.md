# Booga Booga Track - Cloudflare Worker (dashboard)

Files: `worker.js`, `wrangler.toml`.

## Deploy with Wrangler
1. Edit `wrangler.toml` and set `API_URL` to your API's public HTTPS URL.
2. Run `npx wrangler deploy`.

## Deploy in the Cloudflare dashboard
1. Go to Workers & Pages → Create → Worker → Edit code, paste `worker.js`, and deploy.
2. In Settings → Variables, add `API_URL` with your API URL (no trailing slash).

## First use
Open the Worker URL, go to Settings, paste your API `ACCESS_KEY`, and save. Then click **Copy loader** and run the copied line in your Roblox executor on each account.

The dashboard calls `/api/*` on the Worker itself, which forwards to your API, so there are no CORS problems.
