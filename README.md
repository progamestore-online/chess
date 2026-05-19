# chess

A free, open-source chess game with Stockfish analysis. Part of [ProGameStore](https://progamestore.online).

Play at **[chess.progamestore.online](https://chess.progamestore.online)**.

## Features

- Play vs Stockfish (WASM, runs entirely in your browser — no server)
- Move analysis with best-alternative arrows
- Voice moves ("knight to f3")
- Offline play (PWA)
- Sign in with GitHub to track stats (optional)

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build
pnpm test
```

Auto-deploys to Cloudflare Pages on push to `main`.

## License

MIT — see [LICENSE](./LICENSE).

Chess pieces from the [Cburnett set](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces) (CC-BY-SA 3.0).
Stockfish (GPL-3.0) bundled as a WASM worker.
