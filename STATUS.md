# pgs/games/chess — status

Online multiplayer chess for ProGameStore. **Ready to ship** pending the npm scope setup. Builds and deploys via Cloudflare Workers (not Pages) — one Worker serves both the static SPA (via the `ASSETS` binding) and the WebSocket `/api/rooms/<id>/ws` route (via the `GAME` Durable Object).

## What's here

- **`src/worker.js`** — the Worker entrypoint. Routes `/api/rooms/new` and `/api/rooms/<id>/ws`; everything else falls through to `env.ASSETS`. Lifted from the original `web/public/_worker.js` and renamed for the standard `/api/rooms/*` shape.
- **`web/src/components/MultiplayerTab.tsx`** — refactored to use `useRooms()` from `@progamestore/games` instead of hand-rolling the WebSocket. ~60 lines smaller.
- **`web/src/App.tsx`** — drops its own `createGame()` helper; `useRooms.create()` handles the `POST /api/rooms/new` call.
- **`wrangler.jsonc`** — Workers config (not Pages). Declares the `ASSETS` binding, the `GAME` DO, and the v1 migration.
- **`web/package.json`** — depends on `@progamestore/games@^0.2.0`.
- Everything chess-specific (engine, puzzles, voice, board, analysis) untouched.

## Why this can't `pnpm install` today

`@progamestore/games@0.2.0` isn't on npm yet. The `@progamestore` scope hasn't been created. See `pgs/platform/README.md` for the one-time setup steps.

Once the SDK is published:

```bash
cd ~/dev/stores/pgs/games/chess
pnpm install
pnpm build           # bundles web/dist
pnpm deploy          # wrangler deploy (Worker + DO + assets in one)
```

### Local dev before the SDK is on npm

If you want to verify chess builds before npm is set up, swap the SDK dep
to a local link:

```bash
cd ~/dev/stores/pgs/games/chess
# Temporarily replace "^0.2.0" with the local link
jq '.dependencies["@progamestore/games"] = "link:../../../platform/packages/games-sdk"' web/package.json > /tmp/p.json && mv /tmp/p.json web/package.json
pnpm install
pnpm build
# Don't commit this — revert before pushing.
```

Verified end-to-end on 2026-05-20: TS compiles, vite produces a 97 KB
gzipped bundle, 55/55 tests pass.

## Shipping checklist

1. **Publish `@progamestore/games`** (and its sibling packages) to npm. One-time, per the platform README.
2. **Create the GitHub repo**: `gh repo create progamestore-online/chess --public --source ~/dev/stores/pgs/games/chess`.
3. **Cloudflare**:
   - Create a Workers project named `prochess` (matches `wrangler.jsonc` `name`).
   - Bind a custom route `chess.progamestore.online/*` to it.
   - DNS: CNAME `chess.progamestore.online` → `prochess.<account>.workers.dev` (proxied).
4. **Add to PGS registry / storefront** — TBD; depends on PGS storefront work.
5. **CI workflow** — port `progamestore-online/progamestore/.github/workflows/game-ci.yml` to PGS as `progamestore-online/platform/.github/workflows/game-ci.yml`, then add a caller `.github/workflows/deploy.yml` here.

## What this proves

The `useRooms()` API + per-game-Worker pattern is enough to ship server-authoritative multiplayer. Once chess deploys successfully, the same pattern becomes the basis for `pgs init turn-based` (the template the platform CLI scaffolds).
