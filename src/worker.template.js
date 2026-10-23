// Booga Booga Track dashboard - Cloudflare Worker
// Serves the dashboard and proxies /api/* to your API (set API_URL in wrangler.toml or Worker variables).
// GET /_diag tells you exactly why the Worker can or can't reach the API.
const ICON_MOJO = "__ICON_MOJO__";
const ICON_CANDY = "__ICON_CANDY__";
const HTML = __HTML__;

const TUNNEL_HINT = 'Easiest fix: run the API with TUNNEL=1 in its .env (or run "cloudflared tunnel --url http://localhost:3000") and put the https://...trycloudflare.com address in API_URL.';
const PLACEHOLDER = /your-api-domain|yourdomain|example\.(com|org|net)/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const HTTP_PORTS = new Set(['80', '8080', '8880', '2052', '2082', '2086', '2095']);
const HTTPS_PORTS = new Set(['443', '2053', '2083', '2087', '2096', '8443']);
const CF_ERRORS = {
  520: 'the server returned an empty/unknown response',
  521: 'the web server is down',
  522: 'connection to the server timed out',
  523: 'the server is unreachable',
  524: 'the server took too long to answer',
  525: 'SSL handshake with the server failed',
  526: 'the server SSL certificate is invalid',
  530: 'the tunnel is offline (a trycloudflare.com link stops working when the tunnel restarts)',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function png(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Response(u, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
}

// Look at API_URL and list anything that is likely to stop the Worker from reaching it.
function inspectApiUrl(raw) {
  const apiUrl = String(raw || '').trim().replace(/\/+$/, '');
  const problems = [];
  const add = (level, text) => problems.push({ level, text });
  if (!apiUrl) { add('error', 'API_URL is not set on this Worker. Add it under Settings > Variables, or in wrangler.toml.'); return { apiUrl, problems }; }
  let u;
  try { u = new URL(apiUrl); } catch (e) { add('error', 'API_URL is not a valid URL. It must look like https://api.example.com'); return { apiUrl, problems }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') add('error', 'API_URL must start with https:// (or http://).');
  if (PLACEHOLDER.test(u.hostname)) add('error', 'API_URL is still the placeholder from wrangler.toml. Put your real API address there.');
  if (IPV4.test(u.hostname) || u.hostname.startsWith('[')) add('warn', 'API_URL is a raw IP address. Cloudflare Workers usually refuse those (error 1003). Use a domain or a Cloudflare Tunnel instead.');
  if (u.port) {
    const ok = (u.protocol === 'https:' ? HTTPS_PORTS : HTTP_PORTS).has(u.port);
    if (!ok) add('warn', 'Port ' + u.port + ' is not one Cloudflare can connect to from a Worker. Use a tunnel, or port 80/443.');
  }
  if (u.protocol === 'http:') add('warn', 'API_URL is plain http. It works on some hosts, but https (via a domain or tunnel) is more reliable.');
  return { apiUrl, problems };
}

function hintFor(problems) {
  const first = problems.find(p => p.level === 'error') || problems[0];
  return (first ? first.text + ' ' : '') + TUNNEL_HINT;
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal;
}

function explainError(e) {
  if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) return 'Timed out waiting for the API (no answer after 12 seconds). Is it running?';
  return String((e && e.message) || e || 'unknown error');
}

async function diag(apiUrl, problems) {
  const out = { configured: !!apiUrl, apiUrl, problems, upstream: null };
  if (!apiUrl || problems.some(p => p.level === 'error')) return out;
  const t0 = Date.now();
  try {
    const r = await fetch(apiUrl + '/', { headers: { accept: 'application/json' }, redirect: 'manual', signal: timeoutSignal(8000) });
    const ms = Date.now() - t0;
    let body = null;
    try { body = await r.json(); } catch (e) { /* not json */ }
    if (r.status >= 520 && r.status <= 530) {
      out.upstream = { ok: false, status: r.status, ms, error: 'Cloudflare error ' + r.status + ': ' + (CF_ERRORS[r.status] || 'origin problem') };
    } else if (body && body.name === 'booga-track-api') {
      out.upstream = { ok: true, status: r.status, ms, accounts: body.accounts };
    } else if (r.status >= 300 && r.status < 400) {
      out.upstream = { ok: false, status: r.status, ms, error: 'API_URL redirects somewhere else (' + (r.headers.get('location') || '?') + '). Use the final address.' };
    } else {
      out.upstream = { ok: false, status: r.status, ms, error: 'Reached a server (HTTP ' + r.status + ') but it is not the Booga Track API. Check API_URL.' };
    }
  } catch (e) {
    out.upstream = { ok: false, ms: Date.now() - t0, error: explainError(e) };
  }
  return out;
}

async function proxy(request, url, apiUrl, problems) {
  if (!apiUrl) return json({ error: 'config', detail: 'API_URL is not set on this Worker.', hint: hintFor(problems) }, 500);
  if (problems.some(p => p.level === 'error')) return json({ error: 'config', detail: problems.find(p => p.level === 'error').text, hint: hintFor(problems) }, 500);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('accept-encoding');
  let upstream;
  try {
    upstream = await fetch(apiUrl + url.pathname + url.search, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: timeoutSignal(12000),
    });
  } catch (e) {
    return json({ error: 'unreachable', detail: explainError(e), hint: hintFor(problems), apiUrl }, 502);
  }

  if (upstream.status >= 520 && upstream.status <= 530) {
    return json({ error: 'unreachable', detail: 'Cloudflare error ' + upstream.status + ': ' + (CF_ERRORS[upstream.status] || 'origin problem'), hint: hintFor(problems), apiUrl }, 502);
  }

  // The loader can be pointed at this Worker (https, always reachable by the executor) instead of the raw API address.
  if (url.pathname === '/loader.lua' && url.searchParams.get('via') === 'worker' && upstream.ok) {
    const lua = (await upstream.text()).replace(/^local API = .*$/m, () => 'local API = ' + JSON.stringify(url.origin));
    return new Response(lua, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }

  const out = new Headers(upstream.headers);
  if (!out.has('cache-control')) out.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { apiUrl, problems } = inspectApiUrl(env.API_URL);

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const page = HTML.replace('/*CFG*/{}', () => JSON.stringify({ apiUrl }).replace(/</g, '\\u003c'));
      return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/icon-mojo.png') return png(ICON_MOJO);
    if (url.pathname === '/icon-candy.png') return png(ICON_CANDY);
    if (url.pathname === '/_diag') return json(await diag(apiUrl, problems));

    if (url.pathname.startsWith('/api/') || url.pathname === '/loader.lua') {
      return proxy(request, url, apiUrl, problems);
    }
    return new Response('Not found', { status: 404 });
  },
};
