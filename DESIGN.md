---
name: JarvisTravel
description: Marketing site for the JarvisTravel trip planner, set in Meridian navy bands on a Moonlight ground with one amber action.
colors:
  buckthorn-amber: "#FFBF65"
  buckthorn-light: "#FFCC85"
  buckthorn-deep: "#9A5B00"
  ateneo-navy: "#003A6C"
  ateneo-deep: "#083258"
  midnight-navy: "#0E2A47"
  harbor-blue: "#2E6FA3"
  navy-glint: "#8CC0E8"
  navy-haze: "#B7D3E9"
  navy-mist: "#DBE9F4"
  journal-coral: "#B23F2C"
  moonlight: "#F0EEEB"
  paper-white: "#FFFFFF"
  neverything-ink: "#13181B"
  ink-soft: "#4A5560"
  ink-muted: "#5C6B77"
  hairline: "#DAD5CD"
  hairline-strong: "#C7C1B8"
  fatigue-chill: "#0EA5E9"
  fatigue-balanced: "#059669"
  fatigue-packed: "#CA8A04"
  fatigue-peak: "#D35446"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
  lead:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  label-medium:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: "1.5rem"
  label-caps:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.14em"
  figure:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    fontFeature: "\"tnum\" 1"
  caption:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  badge:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.025em"
  credit:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  squared: "2px"
  focus: "4px"
  tile: "8px"
  control: "12px"
  card: "14px"
  panel: "16px"
  phone: "18px"
  ledge: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  section: "64px"
  section-lg: "80px"
  band-lg: "96px"
components:
  button-primary:
    backgroundColor: "{colors.buckthorn-amber}"
    textColor: "{colors.neverything-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.squared}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.buckthorn-light}"
  button-compact:
    backgroundColor: "{colors.buckthorn-amber}"
    textColor: "{colors.neverything-ink}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.squared}"
    padding: "10px 20px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.neverything-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.squared}"
    padding: "14px 32px"
  link-inline:
    textColor: "{colors.ateneo-navy}"
  link-inline-hover:
    textColor: "{colors.ateneo-deep}"
  nav-bar:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-medium}"
    height: "96px"
  nav-link-current:
    textColor: "{colors.harbor-blue}"
  header-band:
    backgroundColor: "{colors.ateneo-navy}"
    textColor: "{colors.moonlight}"
    typography: "{typography.display}"
    padding: "96px 32px"
  page-label:
    textColor: "{colors.buckthorn-amber}"
    typography: "{typography.label-caps}"
  ledge:
    backgroundColor: "{colors.ateneo-navy}"
    rounded: "{rounded.ledge}"
    padding: "32px"
  card-panel:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.neverything-ink}"
    rounded: "{rounded.card}"
    padding: "32px"
  icon-tile:
    backgroundColor: "#003A6C1A"
    textColor: "{colors.ateneo-navy}"
    rounded: "{rounded.tile}"
    size: "36px"
  icon-tile-journal:
    backgroundColor: "#B23F2C1A"
    textColor: "{colors.journal-coral}"
    rounded: "{rounded.tile}"
    size: "36px"
  hairline-row:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    padding: "24px 0"
  offer-card-highlight:
    backgroundColor: "{colors.ateneo-navy}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.card}"
    padding: "32px"
  offer-card-quiet:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.neverything-ink}"
    rounded: "{rounded.card}"
    padding: "32px"
  billing-option:
    backgroundColor: "transparent"
    textColor: "{colors.neverything-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  billing-option-selected:
    backgroundColor: "#003A6C1A"
  badge-saving:
    backgroundColor: "#FFBF651F"
    textColor: "{colors.buckthorn-deep}"
    typography: "{typography.badge}"
    rounded: "{rounded.squared}"
    padding: "2px 8px"
  footer:
    backgroundColor: "{colors.ateneo-navy}"
    textColor: "{colors.navy-mist}"
    padding: "64px 32px"
---

# Design System: JarvisTravel

## Overview

**Creative North Star: "The Chart Room at Noon"**

The site is a chart room with the sun overhead. Ateneo navy is the room: the page header bands, the ledges that hold the app's screens, the closing invitation and the footer. Sea Buckthorn amber is the sun. It fills the one place to act, and elsewhere it appears only as small label type on navy. Between the navy bands lies a warm Moonlight ground where the reading happens, set in one typeface with sentence-case headlines. The only ornament is the contour ring: thin Moonlight circles bleeding off the corners of a navy band, like chart linework.

The mood is calm, unhurried and trustworthy. The density is low: a page is a vertical stack of full-bleed bands, 64 to 96px deep, each holding one idea. Parallel points sit in hairline rows rather than boxes. The product is shown, never staged. The app's real screens lie flat on a navy ledge with no bezel, tilt or chrome, and real photographs sit behind a navy scrim with their credit on the image.

The system rejects what the brand has already taken out: gradients and glows in chrome, black or Neverything as a surface, device bezels and keyline rings around screenshots, pill-shaped actions, and accents outside the navy family.

**Key Characteristics:**
- Navy bands alternate with a warm Moonlight ground and white sections.
- One filled amber action per group, always under an ink label.
- Inter alone: 700 headlines in sentence case, balanced.
- Flat and quiet: depth comes from the band color, 1px hairlines and one phone shadow.
- Real app screens on navy ledges; real photographs carry their credits.
- Concentric contour rings are the only decoration.

## Colors

A cool navy world on a warm neutral ground, lit by one amber: navy carries the brand, Moonlight carries the reading, and amber carries the action.

### Primary
- **Sea Buckthorn Amber** (#FFBF65): The action. It fills Join Now and the skip link, always under a Neverything ink label (10.98:1); on Pricing, only the offer holding the highlight fills its Join Now. On navy it also sets small label type: the page label above a header band's headline, and the highlighted offer's name (7.08:1 on Ateneo Navy). It never fills a band, card or icon.
- **Buckthorn Light** (#FFCC85): The hover fill of the amber action (12.12:1 with ink).
- **Buckthorn Deep** (#9A5B00): Amber's text voice on white: the quiet offer's name and the saving badge on the quiet pricing card (5.43:1 on white).

### Secondary
- **Ateneo Navy** (#003A6C): The brand world: page header bands, the home hero ground, ledge planes, the highlighted pricing card and the footer. On light grounds it is the voice for text links, icon glyphs, check marks and the focus ring (9.95:1 on Moonlight, 11.53:1 on white).
- **Ateneo Deep** (#083258): Text link hover on light grounds.
- **Midnight Navy** (#0E2A47): The deeper navy of the closing invitation band, and the photo scrim.
- **Harbor Blue** (#2E6FA3): The current page in the navigation, as text and a 2px underline (5.36:1 on white). Inside the navy pricing card it tints billing options: 20% on hover, 30% when selected.
- **Navy Glint** (#8CC0E8): Marks on navy, such as the check marks and the selected billing option's border in the highlighted pricing card (5.94:1 on Ateneo Navy).
- **Navy Haze** (#B7D3E9): Secondary text on navy: price periods, the legal date line and the copyright line (7.41:1).
- **Navy Mist** (#DBE9F4): Lead and body text on navy: header-band leads and footer links (9.32:1).

### Tertiary
- **Journal Coral** (#B23F2C): The trip journal's color. It appears only on the journal's icon tile, as a 10% tint behind a coral glyph.

### Neutral
- **Magical Moonlight** (#F0EEEB): The page ground, the fill of cards that sit on a white section, and the color of headlines and the logo on navy.
- **Paper White** (#FFFFFF): The alternate section ground, the scrolled navigation, and the surface of panels and the quiet pricing card on Moonlight.
- **Neverything Ink** (#13181B): Headlines, titles, button labels and the logo on light grounds (15.44:1 on Moonlight). Ink only, never a surface.
- **Soft Ink** (#4A5560): Body copy and leads on light grounds (6.57:1 on Moonlight, 7.61:1 on white), and resting navigation links.
- **Muted Ink** (#5C6B77): Small secondary text on light grounds, such as "Patent pending" and price periods on the quiet card (5.49:1 on white, 4.74:1 on Moonlight).
- **Hairline** (#DAD5CD): The 1px rules: row dividers, card borders, and the edge of a desktop screenshot on a light ground.
- **Hairline Strong** (#C7C1B8): Resting borders of quiet controls (the quiet Join Now and unselected billing options on white) and the scrollbar thumb.

### Data
- **Fatigue Index Chill** (#0EA5E9), **Fatigue Index Balanced** (#059669), **Fatigue Index Packed** (#CA8A04) and **Fatigue Index Peak** (#D35446): The app's four color steps, for days rated 1 to 3, 4 to 6, 7 to 8 and 9 (7 to 9 are all packed, and 9 is the peak), mirrored for the scale on How it works. They are data, not chrome.

### Named Rules
**The One Sun Rule.** Solid amber fills the sign-up action and the skip link, always under ink, and never a band, card, badge or icon. As text, amber is small label type only: Sea Buckthorn on navy, Buckthorn Deep on light grounds. Raw Sea Buckthorn is never text on a light ground.

**The Navy Night Rule.** The brand's dark is navy. Dark surfaces are Ateneo Navy or Midnight Navy, never black or Neverything. Text on navy is Moonlight or a navy tint, and the logo there is Moonlight.

**The Borrowed Color Rule.** Coral belongs to the journal and the four Fatigue Index colors belong to the scale. Neither appears as chrome, decoration or a category accent anywhere else.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, BlinkMacSystemFont, sans-serif)
**Body Font:** Inter (same stack)

**Character:** One neutral grotesque, self-hosted as a variable font (100 to 900), carries every role. Hierarchy comes from clear steps in size and weight, never from a second face or italics.

### Hierarchy
- **Display** (700, 36px on a 45px line below 768px, 48px set solid from 768px): Page headlines in the navy header bands and the home hero. Moonlight on navy, balanced wrapping, 768px wide at most in a header band.
- **Headline** (700, 30px/36px below 768px, 36px/40px from 768px): Section headlines on Moonlight, white and navy bands. Data Security's sub-sections step down to 24px/32px, then 30px/36px from 768px.
- **Title** (600, 20px/28px below 768px, 24px/32px from 768px): Row titles in hairline lists and legal section titles. Panel titles and Home's No catches rows hold at 20px/28px.
- **Lead** (400, 18px, line-height 1.625): The paragraph under a headline, and long-form reading (About, legal). The home hero and photo band step to 20px/28px from 768px.
- **Body** (400, 16px, line-height 1.625): Row descriptions, card text and list items.
- **Label** (600, 16px/24px): Button labels, card titles and footer column titles.
- **Label Medium** (500, 16px/24px): Navigation links, standalone links, and the benefit line that closes a How it works row.
- **Label Caps** (600, 11px, 0.14em tracking, uppercase): The page label above a header band's headline, and the offer names on Pricing.
- **Figure** (700, 36px/40px, tabular figures): Prices.
- **Caption** (500, 14px/20px): A note attached to a feature, such as "Patent pending". The copyright line and the legal date line use the same size at 400.
- **Badge** (600, 11px, 0.025em tracking, uppercase): The saving badge inside a billing option.
- **Credit** (400, 11px, line-height 1.25): Photo credits over a photograph.

### Named Rules
**The One Family Rule.** Inter is the only typeface, served from the site itself and never from a font CDN. Steps come from size (11, 12, 14, 16, 18, 20, 24, 30, 36, 48px) and weight (400 reading, 500 links, 600 titles and labels, 700 headlines). Tracking belongs only to the two 11px uppercase settings.

**The Sentence Headline Rule.** Headlines are sentences in sentence case with normal tracking, and a headline that makes a statement closes with a period. Display headlines, and the section headlines on Home and How it works, wrap balanced. Legal page titles are the document's name, and Data Security's sub-section headings are plain labels.

**The Tabular Figures Rule.** Prices and Fatigue Index digits use tabular figures, so amounts align and never shift when a billing option changes.

## Layout

The page is a vertical stack of full-bleed bands. Each band sets its own ground (Moonlight, white, Ateneo Navy or Midnight Navy) and centers one container. The change of ground is the section break, so no divider sits between bands.

**Containers.** 1280px for the navigation and footer; 1152px for the home product section; 1024px for header bands, the pricing offers and every section of How it works, whose text keeps one left edge inside it; 896px for the home hero; 768px for reading sections; 672px for intros, the About letter and the closing invitation. Side gutters are 16px, 24px from 640px, and 32px from 1024px.

**Rhythm.** Content bands carry 64px above and below, 80px from 768px. Header bands carry 80px, 96px from 768px. The home hero opens 144px above its headline (176px from 768px) to clear the fixed navigation, and closes 96px below (128px). The closing invitation carries 80px, 112px from 768px. Pages without a hero start 96px down, clear of the fixed bar. Inside a band: 16 to 24px between a headline and its lead, and 40 to 48px from an intro to the component it introduces.

**Grids.** Parallel points default to a single column of hairline rows. A card grid steps from 1 to 2 columns at 640px and 3 at 1024px, with 24px gaps. The pricing offers sit on a 5-column grid from 768px (the single-trip offer spans 2, the subscription spans 3) and stack below it. The footer uses 5 columns from 768px, with the brand block spanning 2 and 48px gaps.

**Alignment.** Left-aligned by default. Only the home hero, the closing invitation and a band's single closing action are centered.

**Measure.** The 672px column sets 18px text at 66 to 76 characters a line, with a median of 70. The 768px column runs 18px text to 75 to 84 characters and 16px text to 88 to 94, so it suits components and screenshots better than long reading.

**Responsive.** Breakpoints sit at 640px, 768px and 1024px. Below 640px, a screenshot pair collapses to the phone screen alone (300px wide at most). Below 768px, the navigation collapses to a menu button, and the display, headline and title sizes step down.

## Elevation & Depth

Flat and quiet. Depth comes from the ground changing under a band (Moonlight to white to navy), from 1px Hairline rules, and from one authored shadow: the phone screenshot sitting in front of the desktop screenshot. That shadow has a real offset, a long soft blur, a negative spread and a navy tint, so it reads as the phone lifting off the desktop rather than as a glow. Structural shadows exist only for the two things that genuinely float above the page: the fixed navigation once it turns white, and the mobile menu panel.

### Shadow Vocabulary
- **Phone on ledge** (`box-shadow: 0 28px 56px -20px rgba(4, 16, 30, 0.6)`): The phone screenshot on a navy ledge. It shows only where the phone crosses the light desktop screen, so it can be deep without looking heavy.
- **Phone on page** (`box-shadow: 0 24px 48px -18px rgba(14, 42, 71, 0.32)`): The phone screenshot on a light ground, lighter because the whole silhouette shows.
- **Navigation, scrolled** (`box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)`): The fixed bar once it turns white over content, with a 16px backdrop blur behind its 95% white.
- **Menu panel** (`box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`): The mobile navigation panel.
- **Credit legibility** (`text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6)`): Photo credit text over a photograph.

### Named Rules
**The One Depth Cue Rule.** A screenshot pair gets one depth cue: the phone's shadow. No keyline ring, no border in the ground color, no bezel and no tilt. A zero-offset ring reads as a line drawn around the phone, not as the phone in front.

**The Declare Once Rule.** A surface takes a border or a shadow, never both. Cards and panels take a 1px Hairline and no shadow, and the phone takes its shadow and no edge. The desktop screenshot takes a 1px Hairline ring only on a light ground, where its edge would otherwise vanish, and nothing on navy.

## Shapes

Actions are squared; containers soften as they grow. Buttons and badges take 2px corners, because the brand owner retired pills (JAR-678). Radius then scales with the object: 8px on the 36px icon tile and the menu button, 12px on billing options, Fatigue Index chips and menu rows, 14px on cards, panels and the desktop screenshot, 16px on the mobile menu panel, 18px on the phone screenshot, and 20px on the navy ledge. The focus outline takes a 4px radius on elements without corners of their own.

Edges are 1px hairlines. A list opens with a rule on top and closes each row with a rule below, and nothing carries a colored side stripe. Screenshots are clipped rectangles, never framed.

Circles appear only as the contour motif: four concentric 1px Moonlight rings at 13% opacity, evenly spaced (radii 130 to 250 in a 520 box, or 110 to 215 in a 440 box), placed so they bleed off a navy band's corners. They are drawn geometry, not illustration, and they never appear on a light ground.

### Named Rules
**The Squared Action Rule.** Anything pressed is squared at 2px, and pills are retired. Rounded corners belong to containers, and they grow with the container.

**The Contour Rule.** The contour ring is the only decoration. It lives on navy at 13% Moonlight, bleeds off a corner behind the content, and never intercepts a click.

## Components

Refined and restrained: squared, certain actions inside quiet, soft-cornered containers. The containers stay out of the way so the one amber action and the real product screens do the talking.

### Buttons
- **Shape:** Squared corners (2px).
- **Primary:** Sea Buckthorn fill under a Neverything ink label in Label type, with 16px by 32px of padding (40px at the sides on the closing invitation). Every Join Now outside the navigation takes it, except the one in the pricing offer that doesn't hold the highlight, which is Quiet.
- **Hover / Focus:** The fill lightens to Buckthorn Light over 150ms. Focus draws a 2px outline 3px outside the element, visible at 3:1 or better on its ground: Ateneo Navy on light grounds (9.95:1 on Moonlight), Moonlight on navy (9.95:1 on Ateneo Navy).
- **Compact:** The navigation's Join Now: the same fill, label color and corners, at 500 weight with 10px by 20px of padding.
- **Quiet:** The resting action inside the offer that does not hold the highlight: transparent, with a 1px Hairline Strong border, an ink label and 14px by 32px of padding. When its offer takes the highlight, it becomes the Primary fill.

### Chips
- **Saving badge:** Amber at 12% with a 1px amber border at 30%, in Badge type with 2px by 8px of padding. The label is Sea Buckthorn on navy and Buckthorn Deep on white. It appears only inside the annual billing option.
- **Billing options:** Full-width choice rows (12px corners, 12px by 16px of padding, a 1px border) that behave as toggle buttons. On a white card: Hairline Strong at rest, an Ateneo Navy border with a 6% navy fill on hover, and an Ateneo Navy border with a 10% navy fill when selected. On the navy card: a lighter navy border at rest, a Navy Glint border with a 20% Harbor Blue fill on hover, and a Navy Glint border with a 30% Harbor Blue fill when selected.

### Cards / Containers
- **Corner Style:** Softly rounded (14px).
- **Background:** Paper White on a Moonlight band; Moonlight on a white band.
- **Shadow Strategy:** None (see The Declare Once Rule).
- **Border:** 1px Hairline. The highlighted pricing card's border matches its navy fill, so nothing shifts when the highlight moves.
- **Internal Padding:** 32px for panels and offers; 24px for compact cards in a grid.

### Navigation
- **Style:** A fixed bar, 96px tall, holding the JarvisTravel lockup (64px high, never retyped as text), four links 32px apart, and the compact Join Now.
- **Over the home hero:** Transparent, with the lockup in Moonlight and links in Moonlight at 90% that brighten to full on hover. It turns white after 20px of scroll.
- **Scrolled, and on every other page:** White at 95% over a 16px backdrop blur, with the navigation shadow. The lockup turns Neverything ink, links rest in Soft Ink and darken to ink on hover, and the current page is Harbor Blue with a 2px underline 4px below.
- **Mobile (below 768px):** A menu button opens a white panel (16px corners, menu shadow) of rows with 12px corners. The current row takes the palest navy tint with Ateneo Navy text, and a full-width Join Now ends the panel, below a rule.
- **Footer:** An Ateneo Navy band with 64px of padding. It holds the lockup at 40px in Moonlight, a short description in Navy Mist, and lucide social glyphs (20px, 1.75 stroke), then three link columns titled in Moonlight Label type, with Navy Mist links that brighten on hover. A 1px Moonlight rule at 15% sits above the copyright line (Navy Haze, 14px) and the trademark line (12px, Navy Haze at 80%).

### The Ledge
The site's signature. A solid Ateneo Navy plane with 20px corners and 16px of padding (24px from 640px, 32px from 768px) holds one app screen at two sizes. The desktop screenshot (14px corners) is inset 14% from the left, with 3% above and 6% below. The phone screenshot (18px corners, 26% of the width) overlaps its lower-left corner and casts the Phone on ledge shadow. One set of contour rings bleeds off the bottom-right corner behind it. Below 640px the phone screen appears alone, centered, up to 300px wide. The same pair sits directly on a light page inside How it works rows, where the desktop gains a 1px Hairline ring and the phone takes the lighter Phone on page shadow. There is no visible caption; the description lives in the image's alt text.

### Header Band
Every page without a hero opens on a flat Ateneo Navy band: the Display headline in Moonlight (768px at most) over a Lead in Navy Mist (672px at most), with no rings. Most pages set a page label in Label Caps above the headline, in Sea Buckthorn, 24px above it. Legal pages follow the headline with a Navy Haze date line.

### Photo Band
The home hero and the breadth band put an Unsplash photograph (full bleed, cropped to cover) under a Midnight Navy scrim, then contour rings, then the content. The hero rotates through five city photographs. Both bands use a 70% scrim, which keeps their text readable over a bright facade. The credit sits in the bottom-right corner in Credit type, white at 85% with the credit text shadow, and comes after the band's content in reading and tab order. A photograph never renders without its credit, and with no photograph the band stays plain navy with its rings.

### Hairline Rows
The default structure for parallel points (Home's No catches rows, How it works, Data Security, legal clauses): a list with a 1px Hairline on top and one under each row, 20 to 32px of vertical padding, a Title, then Body text in Soft Ink. On How it works a benefit line in ink Label Medium closes each row. Rows carry no icons and no cards. Legal clauses keep their numbers because readers cite them.

### Icon Tile
Lucide icons sit in a 36px tile with 8px corners: the glyph at 20px with a 2px stroke in the voice color, over a 10% tint of that color. The voice is Ateneo Navy; only the trip journal's tile is Journal Coral. Icons are drawn lucide glyphs, never emoji or typed symbols.

### Traveling Highlight
Pricing shows two offers, and exactly one holds the highlight. The subscription holds it by default: Ateneo Navy fill, Moonlight text, Navy Glint checks, Sea Buckthorn offer name, and the group's one amber action. Hovering or focusing inside the single-trip offer moves the whole treatment there over 200ms and turns the subscription quiet (white card, Hairline border, Buckthorn Deep name, Quiet action). Leaving hands it back.

### Fatigue Index Scale
The 1 to 9 scale appears as the app shows it: 44px chips with 12px corners and 8px gaps, each tinted 10% in its band color, with the current reading ringed 2px in that color. Each digit is set in 700 18px tabular figures and must reach 4.5:1 against its chip, since 18px bold is not large text. Today the digits take the band color itself and measure 2.51 to 3.62:1; JAR-1634 fixes that. The group is one image to assistive technology, described once in words.

## Do's and Don'ts

### Do:
- **Do** fill the sign-up action with Sea Buckthorn (#FFBF65) under a Neverything ink (#13181B) label, squared at 2px, lightening to #FFCC85 on hover.
- **Do** show the product as the app's real screens lying flat on a navy ledge (20px corners), with the phone in front of the desktop and its navy-tinted shadow.
- **Do** separate parallel points with 1px Hairline (#DAD5CD) rows before reaching for cards.
- **Do** set text on navy in Moonlight (#F0EEEB) or a navy tint: Navy Mist (#DBE9F4) for leads, Navy Haze (#B7D3E9) for secondary lines.
- **Do** put every Unsplash photograph under a Midnight Navy (#0E2A47) scrim with its credit on the image, at 70% wherever text sits on the photograph.
- **Do** hold running text near 65 to 75 characters a line; the 672px column at 18px measures a median of 70.
- **Do** keep focus visible at 3:1 or better on every ground: an Ateneo Navy ring on light grounds, a Moonlight ring on navy.
- **Do** set prices and Fatigue Index digits in tabular figures.

### Don't:
- **Don't** use gradients or glows in chrome, text or borders; emphasis comes from band color, weight and size.
- **Don't** frame screenshots in a device bezel, tilt them, caption them, or ring the phone with a keyline.
- **Don't** use black or Neverything (#13181B) as a surface, or set the logo in pure white or black.
- **Don't** round actions or badges into pills; the brand owner removed them.
- **Don't** use Journal Coral outside the journal, or the Fatigue Index colors outside the scale.
- **Don't** set Fatigue Index digits in their band color on their own 10% tint: at 18px bold they need 4.5:1, and all four fall short (chill #0EA5E9 2.51:1, balanced #059669 3.33:1, packed #CA8A04 2.66:1, peak #D35446 3.62:1).
- **Don't** add a second typeface, or load Inter from a font CDN.
