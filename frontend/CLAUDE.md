# Hyro — Frontend Conventions

Guidance for working in `frontend/`. Read this before adding screens, components, or styles so the work stays consistent with the existing v2 app.

## ⛔ Never edit v1

**Do not edit anything under `src/pages/application/v1/` (or other v1 code). v1 is legacy and frozen** — not even small additions like a new form field. The live app is v2; all work goes there. If a request points at a v1 file, flag that it's v1/frozen and offer to make the change in the corresponding v2 screen instead.

## Stack

- **React** 18.3 + **Vite** 7 (`@vitejs/plugin-react`)
- **Tailwind CSS v4** via `@tailwindcss/vite` (NOT v3, NOT PostCSS). Configured with `@import "tailwindcss"` + `@theme` in `src/index.css`. A `tailwind.config.js` exists only to load the Relume preset and alias theme colors.
- **React Router DOM** 7 — all app screens live under `/app/*` (see `src/App.jsx`)
- **Framer Motion** — landing page only. **v2 app screens use pure CSS animation**, never Framer Motion.
- **Supabase** — anonymous auth, gated by `<ProtectedRoute>`

The product is Indonesian. Screen names, copy, and route segments are Indonesian (Notifikasi, Dompet, Profil, Undang, Gabung, BuatArisan). Code identifiers and CSS class names are English/kebab-case.

## The v2 design system

The live app is "v2". Two product domains, each with a fixed color identity — keep this mapping everywhere:

- **arisan** (rotating savings groups) → **emerald** (`--emerald`, `--emerald-dark`, `--emerald-soft`, `--emerald-tint`)
- **patungan** (one-off bill splits) → **lavender** (`--lavender`, `--lavender-dark`, `--lavender-soft`, `--lavender-tint`)
- accent → **gold** (`--gold`); destructive → **danger** (`--danger`)

Modifier shorthands in v2 CSS: `.em` = emerald, `.lv` = lavender.

## Workflow: design → prototype → React

When a screen or significant UI is **new** or needs a redesign, prototype first; don't design straight in JSX.

### 1. Rapid-prototype in `design-prototypes/`

Build a self-contained HTML file in `frontend/design-prototypes/`, matching the existing ones (`final-home.html`, `final-notifications.html`, `final-members-orbit.html`, etc.):

- Single `.html` file with an inline `<style>` block.
- `@import "tokens.css"` (or link it) — the shared token + phone-frame stylesheet every prototype uses. Reuse its tokens and base classes (`.icon-btn`, `.avatar-btn`, `.card`, `.list-item`, pills, tags, inputs, sheets) instead of reinventing them.
- Iterate on layout, spacing, typography, hierarchy, and motion here — it's the fast feedback loop, no build step.
- Name finalized concepts `final-<screen>.html`. Exploratory variants can use descriptive names (`home-concept-story.html`, `create-option2.html`).

Keep the prototype's class names and DOM structure clean, because they port almost 1:1 to React.

### 2. Translate HTML prototype → React

Port the finalized prototype into the app:

- **Page** → `src/pages/application/v2/<ScreenName>.jsx` (PascalCase, Indonesian name: `Notifikasi.jsx`, `Dompet.jsx`). The page imports `../../../styles/app-v2.css`, holds screen state/handlers, and composes components.
- **Repeated/structural pieces** → `src/components/application/v2/<screen>/<Component>.jsx`. Group components in a subfolder named after the screen (`notifikasi/`, `dompet/`, `members/`, `grup/`, `bukti/`, `undang/`, `profil/`, `home/`). Static content arrays go in that folder's `data.jsx`.
- **Shared across screens** → top level of `v2/` (`PaySheet.jsx`, `ComposeSheet.jsx`, `CoachMarks.jsx`, `icons.jsx`).
- **Preserve the prototype's class names and nesting.** A `.story-card` in HTML becomes `<div className="story-card">`; a `.bub-row.incoming` becomes `<NotifBubble side="incoming">` that renders `bub-row incoming`. This 1:1 mapping is what keeps prototype and implementation in sync.
- Component props mirror the visual structure — pass `variant` (`"arisan"|"patungan"`), `icon` (JSX node), `label`, `side`, etc. Keep logic minimal; let CSS handle open/active/paid states via modifier classes (`.open`, `.card-active`, `.paid`).
- Add the route in `src/App.jsx` under `/app/...` and document it.
- Icons: use/extend `src/components/application/v2/icons.jsx` (thin `<svg>` wrappers, 24×24 viewBox, props spread through). Don't inline raw SVG in pages or pull in an icon library.

## Page headers / navbar — always use `ScreenHeader`

Every v2 sub-page navbar comes from the shared component `src/components/application/v2/ScreenHeader.jsx`. **Do not hand-roll a sticky header** (no per-page `<div className="sticky top-0 …">` bars, no scoped `.ov-header`/`.notif-header` markup). One component = one container, so alignment stays identical everywhere.

```jsx
import ScreenHeader from "../../../components/application/v2/ScreenHeader";

<ScreenHeader title="Buat Arisan" onBack={() => navigate("/app")} />
```

- **The container is the point.** It renders a full-width sticky bar (`bg-surface/95` + `backdrop-blur` + bottom hairline) whose inner content is centered in a **1200px band** (`mx-auto max-w-300 px-5 lg:px-8`) — the same band the Profil hero uses (`calc(50% - 600px)`). This gives the back button + title a consistent *slight* inset that caps on wide desktops; it is intentionally **not** pinned to each page's (narrower) content column. Responsive by construction: `px-5` on mobile → `lg:px-8` + centered band on desktop.
- Props: `title` (string → the page `<h1>`), `sub` (optional second line, e.g. a count), `onBack` (handler; omit to render no back button), and `children` (optional right-aligned slot — a Save button, loading spinner, share action, etc.). Put right-side actions in `children`, not a new bar.
- The standard back button (gray-soft, `h-10` rounded, `ChevronLeft`) is built in — never re-import `ChevronLeft` just for a header.
- `grup/GroupHeader.jsx` is a thin wrapper over `ScreenHeader` (title + `sub`); keep it that way.
- **Exceptions (don't convert):** the gradient hero headers that are part of a screen's identity — `profil/ProfileHero.jsx` (gradient + avatar) and `home/StoryTopBar.jsx` (title-less story overlay). They already align to the same 1200px band via `calc(50% - 600px)`; leave them bespoke.

## CSS: where each rule goes (strict priority order)

Three layers. **Always reach for them in this order — only fall to the next when the current one genuinely can't express it.**

### 1. Tailwind utilities (first choice)

Use Tailwind classes in JSX for layout, spacing, sizing, flex/grid, basic colors, borders, and simple radii. Prefer the theme-token utilities over arbitrary values:

- `bg-brand-primary`, `text-ink-1`, `border-line`, `shadow-card`, `rounded-card` — these resolve to the `@theme` tokens.
- Avoid arbitrary values like `bg-[#10b981]` when a token utility exists.

### 2. `src/index.css` (global tokens & cross-cutting base)

Edit here only for things that are genuinely global:

- New **design tokens** → add to the `@theme { }` block as `--color-*`, `--shadow-*`, `--radius-*`, `--spacing-*` (this is what generates Tailwind utilities in v4).
- If a token needs a friendly alias for raw CSS use, add it to the `:root { }` aliases block (e.g. `--emerald: var(--color-brand-primary)`).
- Global base resets and reusable micro-animations (scroll-reveal, hover-lift, etc.) live here too.
- Note: `prefers-reduced-motion` is honored globally **except** `.v2-screen`, which is intentionally exempt because motion is core to the v2 experience. Don't "fix" that.

### 3. `src/styles/app-v2.css` (last resort — scoped screen styles)

Use only for what Tailwind and tokens can't cleanly do. **Every rule must be scoped under `.v2-screen` / `.v2-<screen>`** to avoid collisions. This is where these belong:

- Gradients (e.g. `.home-card-arisan { background: linear-gradient(...) }`)
- `@keyframes` and transform-driven animation (orbit spin, card drift, sheet slide-up, bubble entrance)
- Pseudo-element accents (`::before`/`::after` colored borders, unread dots, perforated edges)
- Complex positioning/layout for interactive UI (orbit stage, card deck, bottom sheets)
- Responsive overrides — mobile-first (≤480px floating-card look), tablet (481–1023px full-width), desktop (≥1024px full-bleed + centered ~1200px content column)

`src/styles/app-v1.css` is the **legacy** v1 component library (`.app-*`, `.btn-*`, `.badge-*`). Don't add v2 work there; only touch it to maintain old `/app/arisan`, `/app/patungan` v1 screens.

## Consistency checklist (before finishing a UI change)

- [ ] arisan = emerald, patungan = lavender, consistently
- [ ] CSS chosen by priority: Tailwind → index.css token → app-v2.css; nothing in a lower layer that a higher one could do
- [ ] All new `app-v2.css` rules scoped under `.v2-*`
- [ ] No arbitrary Tailwind values where a theme token utility exists
- [ ] Icons via `icons.jsx`, not inline SVG or a library
- [ ] Sub-page navbar uses `ScreenHeader` (no hand-rolled sticky header bar)
- [ ] Component in the right `v2/<screen>/` subfolder; shared pieces at `v2/` top level; static data in `data.jsx`
- [ ] New route registered in `App.jsx`
- [ ] If the UI was new/redesigned, a matching `design-prototypes/*.html` exists and the React structure mirrors it
- [ ] v2 motion is CSS, not Framer Motion
- [ ] Indonesian copy/screen names; English class names & identifiers
