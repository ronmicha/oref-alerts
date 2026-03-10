# Cloudflare Worker Teardown

The CF Worker (`oref-proxy.js`) was replaced by an AWS Lambda in `il-central-1`
which provides guaranteed Israeli IPs without relying on Smart Placement.
This file documents how to clean it up when ready.

## Steps

### 1. Remove the Worker from Cloudflare

Cloudflare dashboard → **Workers & Pages** → **round-morning-0e82** → **Settings** → **Delete** → confirm.

### 2. Remove the `workers/` directory from the repo

```bash
git rm -r workers/
git commit -m "chore: remove CF Worker (replaced by Lambda in il-central-1)"
git push
```

### 3. Verify Vercel env var is correct

Make sure `NEXT_PUBLIC_OREF_PROXY` in Vercel points to the API Gateway URL
(`https://<id>.execute-api.il-central-1.amazonaws.com`), not the old
`*.workers.dev` URL. Redeploy if you changed it.
