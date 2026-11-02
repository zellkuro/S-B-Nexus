# Backend

Saves each player's level, XP, gold and quests. A Cloudflare Worker (JavaScript)
with a D1 database, both on Cloudflare's free tier. The rules come from
[`shared/rules.js`](../shared/rules.js), the same file the world uses.

API and design: [design doc, section 9.1](../docs/game-design.md#91-backend-api).

## First-time setup
You need a free Cloudflare account and Node.js 22.

```sh
cd backend
npm install
npx wrangler login                 # opens a browser to sign in to Cloudflare
npx wrangler d1 create sbn         # prints a database_id
```

1. Paste the printed `database_id` into `wrangler.toml`, replacing the zeros,
   and commit it. (It's not a secret.)
2. Create the table and deploy:
   ```sh
   npm run db:init
   npm run deploy
   ```
   `deploy` prints the address, like
   `https://sbn-backend.<your-subdomain>.workers.dev`.
3. Put that address in `CONFIG.backendUrl` at the top of
   `world/WebRoot/script.js`.
4. Check it: open `https://sbn-backend.<your-subdomain>.workers.dev/health`
   in a browser. It should say `{"ok":true}`.

## Deploying from GitHub
After the first setup, pushes to `main` deploy automatically
(`.github/workflows/ci.yml`) once these repository secrets exist
(**Settings → Secrets and variables → Actions**):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template, plus **D1: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right side) |

Without them the deploy job is skipped and only the tests run.

## Running it locally
```sh
npm run db:init:local
npx wrangler dev --var ALLOWED_ORIGINS:'*'
curl "http://localhost:8787/players/sq%3A1?name=Test"
curl -X POST http://localhost:8787/players/sq%3A1/events \
     -H 'Content-Type: application/json' -d '{"event":{"type":"accept","quest":"q01"}}'
```

## Tests
`npm test` here, or `npm test` at the repo root for everything. They use an
in-memory store instead of D1, and need no install.

## Settings
| Setting | Where | Default |
|---|---|---|
| Allowed browser origins | `ALLOWED_ORIGINS` in `wrangler.toml` | `https://*.worldspace.host` |
| Kill rate limit, XP curve, rewards | `shared/rules.js` | see the design doc |
