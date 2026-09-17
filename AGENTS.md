# DOX framework — JarvisTravel Marketing Website

DOX is a performant AGENTS.md hierarchy. This file is the root contract for the
JarvisTravel Marketing Website repository. Every AGENTS.md in the tree is a
binding work contract for its subtree.

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it
- Read the full DOX chain from root to target path before editing any file in this repo
- After every meaningful change, run a DOX closeout pass (update nearest owning docs, refresh Child DOX Index entries, remove stale/contradictory text)

## Purpose

React TypeScript marketing website for JarvisTravel — a standalone SPA deployed
to the production Droplet (mktg.jarvistravel.com) and GitHub Pages. Serves as the public-facing landing experience: marketing pages for a
pre-launch product (no auth on this site; every "Join Now" goes to the app's sign-in, and the pricing page's plan CTAs carry the chosen plan: JAR-1692).

## Ownership

| Area | Owner |
|------|-------|
| Root config & build | `AGENTS.md` (this file) |
| Deployment & CI | `.github/workflows/node.js.yml`, `.github/workflows/deploy-droplet.yml` |
| Application source | `src/app/` — see `src/app/AGENTS.md` |
| Entry point & global styles | `src/main.tsx`, `src/index.css` |

## Local Contracts

### Build & run

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
npm run build        # tsc + vite build → dist/
npm run preview      # preview production build
npm run type-check   # tsc --noEmit
npm run lint         # eslint with zero-warnings policy
```

### Fonts (self-hosting invariant — JAR-1152/JAR-1165)

The site's typeface (Inter) is served from `public/fonts/` and declared in
`src/index.css`. It must never load from a third-party font CDN
(fonts.googleapis.com et al.): a webfont fetch transmits every visitor's IP
before consent (LG München I, 3 O 17493/20), and it is the one third-party
connection that fires on every page.

`scripts/check-fonts.mjs` is the gate, and it runs on ALL shipping paths:
`pr-checks` (PRs), `node.js.yml` (GitHub Pages deploy), and
`deploy-droplet.yml` (droplet deploy). Its self-tests run via
`npm run test:scripts` (there is no bare `npm test` script in this repo). The guard refuses: any font-CDN fetch spelling
(`url()`, `href=`/`src=`, `@import` string form, protocol-relative `//host`),
faces with no local file, placeholder (stub/zero-byte) font files, and a
missing or stubbed `public/fonts/LICENSE.txt` (the OFL requires the verbatim
notice to travel with the files — the shipped copy is byte-identical to
upstream). Adding a subset or weight means adding the file AND its
`@font-face` in `src/index.css`; nothing about fonts is configured anywhere
else.

### Pricing (single source of truth — JAR-660)

The only place this site knows what anything costs is `src/app/data/pricing.ts`,
which mirrors Stripe (the org account `acct_1ToBJsPDaNqc0Lek`; there is no
separate sandbox account — test and live are modes of that one account, and a
`lookup_key` is per-account-and-mode, so at live launch the catalogue is
re-minted in live mode under the same account and the pin does not move —
keyed by the same
`lookup_key` the backend resolves at checkout). The `lint:prices` guard fails
CI when the site and Stripe disagree; `check-prices.mjs` also fails when a
dollar amount reappears as a literal in a component.

**Changing a price or adding a plan (runbook):**
1. Edit/create the price in the Stripe dashboard (test mode; same lookup_key
   in live mode at launch).
2. `STRIPE_READ_API_KEY=rk_test_... npm run sync:prices` — regenerates the
   generated block in `pricing.ts` from Stripe (the `Price` type + the guard's
   `EXPECTED_KEYS` fail loudly if the catalogue shape changes; `interval_count
   != 1` is refused — the site cannot render it).
3. Update `PriceLookupKey` + `EXPECTED_KEYS` in `check-prices.mjs` if the key
   set changed.
4. Open the PR — `pr-checks` runs the guard (literal scan + Stripe
   reconciliation). The droplet + Pages deploys re-run it immediately before
   shipping (`--network-warn`: a Stripe outage warns; a verified mismatch
   fails).
5. The daily `pr-checks` schedule (06:00 UTC) catches Stripe-side edits that
   make no PR.

### Base path & routing

- Routes are served at the domain root (`/`) on both deployments (configured in `vite.config.ts` and `tsconfig.json`)
- The Droplet deployment serves from mktg.jarvistravel.com/, GitHub Pages from the /project-insight-website/ subdirectory
- `tsconfig.json` `baseUrl` and `paths` (`@/*`) — keep in sync with `vite.config.ts` resolve alias

### UI stack

- **React 18** + **TypeScript** (strict mode, `strict: true`)
- **Vite 5** with `@vitejs/plugin-react`
- **Tailwind CSS 3** via PostCSS — utility-first styling, no CSS modules
- **Lucide React** for icons (import individual icons from `lucide-react`)
- **react-router-dom v7** for client-side routing

### Architectural invariants

- **SPA** — no server-side rendering. All pages are client-rendered React.
- **Marketing layout** — `MarketingLayout` in `PageRouter.tsx` wraps all public-facing pages with `<Navigation />` + `<Footer />`. New marketing routes should follow the same pattern.
- **No auth** — pre-launch marketing site; the simulated client-side auth stack was removed as dead code (JAR-429). Sign-in lives in the app: every "Join Now" links to the app's sign-in through `appLink.ts`, the pricing page's plan CTAs carry the chosen plan, and the pricing page has a sign-in link for existing accounts (JAR-1692, which reversed JAR-1630's route to `/pricing`). `scripts/check-pricing-ctas.mjs` enforces all three.
- **Static output** — `npm run build` produces `dist/`. The GitHub Actions workflow uploads `dist/` to GitHub Pages or rsyncs it to the Droplet.
- **Sourcemaps enabled** in production builds (`vite.config.ts` `sourcemap: true`).

## Work Guidance

1. **Stale README** — The README references `src/marketing/` but the code lives in `src/app/`. Update it when making other changes.
2. **Barrel exports** — `src/app/components/index.ts` and `src/app/pages/index.ts` re-export their contents. Follow the same pattern.
3. **New pages** — create the page component in `src/app/pages/`, add a barrel export to `src/app/pages/index.ts`, and wire the route in `src/app/router/PageRouter.tsx` inside a `MarketingLayout` wrapper.
4. **Lint discipline** — `npm run lint` enforces `--max-warnings 0`. Zero warnings is the bar.
5. **Before editing any file in `src/app/`**, read `src/app/AGENTS.md` first.
6. **Before any code editing**, load the `code-workflow` skill and follow its standard engineering workflow (branching, TDD, conventional commits, quality gates, PRs)

## Verification

Before merging to `main`:
- [ ] `npm run type-check` passes (zero errors)
- [ ] `npm run lint` passes (zero warnings, zero errors)
- [ ] `npm run build` succeeds
- [ ] Stale text removed from AGENTS.md chain if anything changed
- [ ] Child DOX Index updated if docs were added/removed

## Child DOX Index

| Path | Scope |
|------|-------|
| `src/app/AGENTS.md` | Application source code: components, pages, router |

## User Preferences

- Routes are served at the domain root (`/`); the old `/project-insight-website/` GitHub Pages prefix is deprecated
- React Router is the routing library; use its hooks directly
- Tailwind CSS is the only styling approach — no CSS modules, no styled-components
