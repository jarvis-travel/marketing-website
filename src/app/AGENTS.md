# DOX — src/app/

## Purpose

Application source code for the JarvisTravel marketing website. Contains all
React components, pages, routing, and auth state. This is where all UI work
happens.

## Ownership

| Area | Files |
|------|-------|
| Shared layout components | `components/Navigation.tsx`, `components/Footer.tsx`, `components/index.ts` |
| Page components | `pages/HomePage.tsx`, `pages/FeaturesPage.tsx`, `pages/PricingPage.tsx`, `pages/AboutPage.tsx`, `pages/ContactPage.tsx`, `pages/PrivacyPage.tsx`, `pages/TermsPage.tsx`, `pages/DataSecurityPage.tsx`, `pages/index.ts` |
| Routing | `router/PageRouter.tsx`, `router/ScrollToTop.tsx` |

## Local Contracts

### Component patterns

- **Page components** live in `pages/`, one file per page. Each page accepts no props — it reads routing state from hooks (`useNavigate`, `useLocation`).
- **Layout components** (`Navigation`, `Footer`) are in `components/`. They are shared across all marketing pages via `MarketingLayout` in `PageRouter.tsx`.
- **Barrel exports** — `pages/index.ts` and `components/index.ts` re-export all public symbols. Always add new exports there.
- **Icons** — import from `lucide-react` directly (e.g. `import { MapPin } from 'lucide-react'`). Do not install additional icon libraries.

### Routing

- All routes are defined in `PageRouter.tsx` at root (`/`) paths
- Every marketing route wraps its page in `<MarketingLayout>` (provides Navigation + Footer)
- `ScrollToTop` in `router/ScrollToTop.tsx` scrolls to top on route change — included in the root component tree
- The catch-all `Route path="*"` redirects to `/`

### No auth

- This is a pre-launch marketing site with **no authentication**. The simulated client-side auth stack (`context/`, `ProtectedRoute`, `RouterContext`, and the sign-in/up/dashboard pages) was removed as dead code (JAR-429). "Join Now" links go to `/pricing`, where each plan's CTA starts sign-up in the app (JAR-1630).

### Global entry points (outside `src/app/`)

- `src/main.tsx` — renders the React tree into `#root` with `BrowserRouter` > `ScrollToTop` + `PageRouter`
- `src/index.css` — Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities`)

## Work Guidance

1. **New pages** — create the file in `pages/`, export from `pages/index.ts`, add a route in `PageRouter.tsx`. Use `MarketingLayout` for public pages.
2. **Type safety** — `strict: true` in tsconfig. No `any`, no `// @ts-expect-error` without justification. Keep TypeScript errors at zero.
3. **Tailwind** — use utility classes directly in JSX. Avoid custom CSS unless the design system requires it. The `tailwind.config.js` `theme.extend` block is where project-specific tokens go.

## Verification

Before changing any file in `src/app/`:
- [ ] Read the root `AGENTS.md` plus this file (the full DOX chain)
- [ ] After changes: `npm run type-check` passes
- [ ] After changes: `npm run lint` passes (zero warnings)
- [ ] If routes changed: verify all root (`/`) paths work

## Child DOX Index

No child AGENTS.md files exist under `src/app/`. This leaf node owns all files
in this subtree directly.
