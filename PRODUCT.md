# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People planning a real trip: a long weekend, a staycation, two weeks abroad. They are not buying software. They want the trip to feel like a vacation, not a second job. On this site they are deciding whether to sign up, and success is **Join Now: signing up for the app** (confirmed 2026-09-14).

## Product Purpose

JarvisTravel is a trip planner that keeps the days, the pace, the budget, the map and the journal in one plan. Jarvis drafts the days and rates each one, and the money and the route live inside the same plan, so the trip someone takes feels like the trip they imagined.

This site replaces the waitlist at jarvistravel.com the day the app ships, so it is written as if the app is live.

## Positioning

**The Fatigue Index leads** (confirmed 2026-09-14). It rates every day chill, balanced or packed while you plan, so the tough days show up while they can still be fixed. It reads five inputs: how far the body clock moves, time in transit, walking distance, how much is packed in, and the downtime left. The day is rated, never the traveler. Patent pending.

Supporting claims, in order: one plan instead of twelve tabs; nobody pays to be in your plan, and there are no ads.

## Operating Context

Inferred from the codebase: visitors arrive on phones and desktops, usually partway through researching a trip. The site is a Vite + React single-page app styled with Tailwind 3, and the product it sells is a web app.

## Capabilities and Constraints

- Shipped features the site may describe: Jarvis-drafted trip plans; the Fatigue Index, with a lighter version of a packed day; a budget inside the plan; the trip map with the walking route; weather and flights inside the plan; the trip journal (notes, photos, receipts, places).
- Prices come only from `src/app/data/pricing.ts`, which mirrors Stripe: Trip Pass for one trip, and Explore as one subscription with annual and monthly cadences. No invented tiers.
- JarvisTravel plans; it never sells or books travel. No booking language anywhere, enforced by `lint:plan-not-book`.
- No absolute or forward-looking claims about data, enforced by `lint:absolute-claims`.
- Join Now is the sign-up call to action. Every Join Now outside Pricing leads to `/pricing`, and Pricing's own actions link into the app. `lint:pricing-ctas` enforces both.

## Brand Commitments

- The name is "JarvisTravel", one word. The assistant is "Jarvis".
- Voice follows the `jarvistravel-copy` skill: benefit first, plain speech, second person, short sentences, and every feature line landing on what the traveler gets. Approved anchor lines: "Your vacation should be a break, not a second job." "Enjoy Your Vacation." "Planning is hard. Jarvis does the heavy lifting."
- Fatigue Index band words lead (chill, balanced, packed). Digits appear only where the 1 to 9 scale is explained, and the verb is "rate", never "score".
- No em dashes, no emoji, no scarcity or urgency, and no disclaimer captions on images.
- Brand system: Meridian (palette, Inter, logo lockup) and the NINE marketing language already on the site.
- Imagery: no recognisable faces, landmark and property rights checked, and every Unsplash photo carries its credit. App screenshots show the in-app photos, as the app does.

## Evidence on Hand

Confirmed 2026-09-14:

- Real app screenshots of the demo trip (a week in Rome), at desktop and phone size, from web-app's capture harness, in `src/assets/captures/`.
- Patent pending on the Fatigue Index, shown next to the feature, never as a site-wide badge.
- Live pricing from Stripe, through `src/app/data/pricing.ts`.

**Not on hand, so never fabricated:** testimonials, ratings, user counts, press, customer logos, or usage statistics. They return only once real arm's-length users exist.

## Product Principles

1. A vacation should feel like one. Every claim lands on what the traveler gets back.
2. The day is rated, never the traveler.
3. Truth only: every claim maps to shipped product or an approved document.
4. Trust is structural. JarvisTravel plans and never sells travel, and nobody pays to appear in a plan.

## Accessibility & Inclusion

The target is WCAG AA: text contrast of 4.5:1 (3:1 for large text), a focus ring visible on every background, a skip link, and alt text that describes an image rather than captioning it.
