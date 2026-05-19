# Contributing

PRs welcome. Keep it small, keep it focused.

## Develop

```bash
pnpm install
pnpm dev    # http://localhost:5173
pnpm test
pnpm build
```

## Conventions

- TypeScript strict mode
- One feature per PR
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`)
- Run `pnpm test` before opening a PR

## Compliance

This game is part of [ProGameStore](https://progamestore.online) and must
pass the weekly compliance audit. See `.github/workflows/compliance.yml`.
