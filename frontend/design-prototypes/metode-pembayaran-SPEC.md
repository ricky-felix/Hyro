# Design Spec — Metode Pembayaran (Payment Methods)

**Prototype files:** `metode-pembayaran-list.html`, `metode-pembayaran-form.html`, `metode-pembayaran-peer.html`
**Design system:** v2 (lavender/patungan theme) · tokens from `tokens.css`
**PRD reference:** `/Users/rickyfelix/GitHub/Arisan-Digital/PRD-payment-methods.md`

---

## 1. Screen Inventory

| File | Frames inside | Purpose |
|------|--------------|---------|
| `metode-pembayaran-list.html` | 3 frames | Owner view: populated list, empty state, legacy v0 migration banner |
| `metode-pembayaran-form.html` | 5 frames | Add/edit form: bank, e-wallet, QRIS placeholder, validation errors, edit-mode (type locked) |
| `metode-pembayaran-peer.html` | 4 frames | Peer/payer view: method selector sheet with masked numbers, QRIS thumbnail, empty-payee state, BuktiTransfer receipt integration |

---

## 2. Color & Token Usage

All payment-method screens use the **lavender/patungan** palette — consistent with the settlement flow they serve.

| Token | Hex | Usage |
|-------|-----|-------|
| `--lavender-dark` (`--accent`) | `#8b5cf6` | Primary buttons, selected states, badges, amount chip |
| `--lavender` | `#a78bfa` | Sheet header accent, dashed borders |
| `--lavender-soft` | `#ede9fe` | Icon badge backgrounds, method card selected fill, primary badge |
| `--lavender-tint` | `#f5f3ff` | Page tint, info-note background, selected card background |
| `--danger` | `#ef4444` | Delete button, field error text/border, delete-confirm modal |
| `--ink-1` | `#111827` | Primary text, labels |
| `--ink-3` | `#9ca3af` | Hint text, type chip, secondary meta |
| `--gray-soft` | `#f3f4f6` | Type segment background, lock notice, loading skeleton |
| `--warn` / `#fef3c7` | amber family | Migration banner (v0 data detected) |

---

## 3. Component Breakdown

### 3.1 Page — `MetodePembayaran.jsx`
**Path:** `frontend/src/pages/application/v2/MetodePembayaran.jsx`
**Replaces:** current toggle-chip version

Structure:
```
MetodePembayaran (page)
├── ScreenHeader (existing shared component)
│     title="Metode Pembayaran"  onBack → /app/profil
│     children → (no right-side save button; saves are per-method)
├── [if v0 legacy format] MigrationBanner (new)
├── [if loading] MethodCardSkeleton × 2
├── [if methods.length === 0] MethodsEmptyState (new)
├── [if methods.length > 0] MethodsList (new)
│     └── MethodCard × N
├── AddMethodRow (button inside the card that opens MethodForm)
├── InfoNote (static — regulatory consent copy)
└── [modal] MethodForm (add / edit)
└── [modal] DeleteConfirmModal
```

### 3.2 `MethodCard.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/MethodCard.jsx`

Props: `method: PaymentMethod`, `onEdit: fn`, `onDelete: fn`, `onSetPrimary: fn`

Visual anatomy (left → right):
1. Primary radio (20×20, circular, `--accent` fill when active)
2. Type icon tile (40×40, `border-radius: 12px`)
   - Bank: `#e0f2fe` bg / `#0369a1` color
   - E-wallet: `--lavender-soft` bg / `--lavender-dark` color
   - QRIS: `#fce7f3` bg / `#9d174d` color
3. Info block:
   - Label row: `font-size: 14px; font-weight: 700` + optional `primary-badge`
   - Detail row: `method-type-chip` (10px, gray-soft bg) + account/phone (12px, `--ink-3`)
4. Actions: edit button (`--lavender-soft`), delete button (`#fee2e2` / danger)

Height: ~70px per row. Separator: `border-top: 1px solid var(--line-soft)`.

### 3.3 `MethodForm.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/MethodForm.jsx`

Renders as a **full-screen page** (not a bottom sheet), navigated to/from with `navigate()`.
This allows the keyboard to push content without cutting off the form on small screens.

Mode: `"add"` | `"edit"` (passed as prop; edit pre-fills, locks type field)

**Type segment control:**
- Container: `border-radius: 14px; background: var(--gray-soft); padding: 4px`
- Buttons: `border-radius: 10px`, active = `--surface` bg + `box-shadow: 0 2px 8px rgba(17,24,39,.08)`
- QRIS button: "Segera" badge (7px, `--ink-3`, absolute top-right). Clicking QRIS tab still shows the form but image upload field has a frosted overlay (`rgba(248,250,252,.88)`) with "Segera — Fase 4" copy.

**Conditional fields by type:**

| Type | Fields shown |
|------|-------------|
| Bank | Bank picker (radio list) · Label · Nomor Rekening · Nama Pemilik Rekening |
| E-Wallet | E-wallet picker (radio list) · Label · Nomor HP (with +62 prefix) |
| QRIS | Label · Upload zone (Phase 4 overlay) |

**Field specs:**
- Label: `type="text"`, `maxLength=50`, required
- Nomor Rekening: `type="tel"`, `inputmode="numeric"`, pattern `[0-9]*`, 6–20 digits, no spaces
- Nama Pemilik: `type="text"`, `maxLength=50`, alphanumeric + spaces
- Nomor HP: prefix "+62" as visual overlay (not part of value), `type="tel"`, `inputmode="numeric"`
- Input focus ring: `border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,92,246,.12)`
- Input error state: `border-color: var(--danger); box-shadow: 0 0 0 3px rgba(239,68,68,.10)`

**Primary toggle:** Full-width row (`border: 1.5px solid`), checkbox in right corner, active = lavender tint bg.

**Edit mode — type lock:**
- Type segment replaced by read-only display tile (opacity .65)
- Lock notice banner above: "Jenis pembayaran tidak bisa diubah…"
- Nav title: "Edit [label]" instead of "Tambah Metode Pembayaran"
- Save button: "Simpan Perubahan"

**Floating action bar:** `position: absolute; bottom: 0` with gradient fade. Primary CTA height: 52px (15px padding). Secondary "Batal" text-only below.

### 3.4 `DeleteConfirmModal.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/DeleteConfirmModal.jsx`

Renders as a **center modal** (not bottom sheet) — `align-items: center` on backdrop.
Entry animation: `scale(.94) → scale(1)` + `translateY(8px) → 0` via CSS transition on `.open` class toggle.
Backdrop: `rgba(17,24,39,.50)` + `backdrop-filter: blur(3px)`.

Copy: "Hapus metode pembayaran ini? Anggota grup tidak bisa membayar ke rekening ini lagi."
Actions: [Batal] gray-soft / [Hapus] danger red.

### 3.5 `PaymentMethodSelector.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/PaymentMethodSelector.jsx`

Renders as a **bottom sheet** (`align-items: flex-end` backdrop).
Max-height: `88%` of phone frame. Internal structure: fixed header + fixed payee row + scrollable list + fixed action bar.

Grabber: `36×4px`, `border-radius: 999px`, `--line` color, `margin: 10px auto 0`.

**Peer method card anatomy:**
1. Selection radio (22×22)
2. Type icon (40×40, same palette as MethodCard)
3. Info block:
   - Label row: type-chip + label text + optional primary-badge
   - **Masked number row** (see Section 4 below)
   - Holder name row (bank only, `11px`, `--ink-3`)
   - [if QRIS + image] `qris-thumb-row` block

Auto-select primary on open. User can change selection. "Lanjutkan" passes `selectedMethod.id` as query param to BuktiTransfer.

**Empty-payee state:** centered in the sheet scroll area, icon + title + desc + single "Tutup" button.

**Privacy note:** pinned above the action bar in the scroll area — "Nomor rekening ditampilkan sebagian (4 digit terakhir) demi privasi…"

### 3.6 `MigrationBanner.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/MigrationBanner.jsx`

Shown when `isLegacyFormat` (PRD § 5). Amber color scheme.
One action: "Lengkapi Sekarang" → opens MethodForm for each legacy method in sequence.

### 3.7 `data.jsx`
**Path:** `frontend/src/components/application/v2/metodePembayaran/data.jsx`

Export arrays:
```js
export const BANK_OPTIONS = ['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata'];
export const EWALLET_OPTIONS = ['GoPay','OVO','DANA','ShopeePay','LinkAja'];
// type → icon key mapping for MethodCard icon selection
export const METHOD_ICONS = { bank: 'Bank', gopay: 'Phone', ... };
```

No logo images — text labels only (trademark constraint).

---

## 4. Masking Design — Critical Privacy Requirement

**Rule (from PRD § 8):** When payer views payee's methods, `account_number` and `phone` are masked to last-4 digits server-side. The masked string from the API is `"••••7890"` or `"••••6789"`.

**Visual rendering spec:**

The masked number is split into two styled spans:

```html
<div class="masked-number">
  <span class="mask-dots">•&nbsp;•&nbsp;•&nbsp;•</span>
  <span class="mask-last4">7890</span>
</div>
```

CSS for `.masked-number`:
```css
font-size: 13px;
font-weight: 600;
color: var(--ink-2);
display: flex;
align-items: center;
gap: 6px;
font-variant-numeric: tabular-nums;
letter-spacing: .02em;
```

`.mask-dots`: `color: var(--ink-3); font-size: 14px; letter-spacing: 1px`
`.mask-last4`: `color: var(--ink-1); font-weight: 700; font-size: 14px`

**Why this approach:**
- Using U+2022 bullet characters (`•`) instead of asterisks (`*`) for cross-platform consistent rendering (Android, iOS, desktop).
- The last-4 digits are visually heavier (`font-weight: 700`, `--ink-1`) so the user can glance-confirm "yes, that's the right BCA account ending in 7890" without seeing the full number.
- The mask dots are lighter (`--ink-3`) to signal redacted information without feeling alarming.
- In BuktiTransfer receipt: same pattern, with the label on one line and `• • • • 7890` + `a.n. Ari Nugraha` on subsequent lines.

**Owner view (own methods):** Full number shown without masking. No mask-dots span.

---

## 5. QRIS — Phase 4 Placeholder Design

The QRIS tab is accessible in the form but the upload zone is overlaid with a frosted "Segera — Fase 4" banner:

```css
.soon-overlay::after {
  content: 'Segera — Fase 4';
  position: absolute; inset: 0;
  background: rgba(248,250,252,.88);
  border-radius: var(--r-input);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: var(--ink-2);
  backdrop-filter: blur(1px);
  pointer-events: none;
}
```

The QRIS tab button itself carries a "Segera" micro-badge (7px, `--ink-3` bg) positioned `absolute; top: -4px; right: 2px`.

The form still allows saving a QRIS method with just a label (no image). The info copy explicitly states: "Hanya gambar yang kamu upload sendiri yang ditampilkan. Hyro tidak membuat atau memproses QRIS." — this is the regulatory guardrail copy for the QRIS field.

When Phase 4 ships: remove `.soon-overlay::after` pseudo-element and the "Segera" micro-badge. The upload zone and preview states are already designed (`qris-zone`, `qris-preview`, `qris-change-btn` classes in the prototype).

---

## 6. Spacing & Typography Reference

| Element | Font size | Font weight | Color |
|---------|-----------|-------------|-------|
| Screen eyebrow title | 15px | 800 | `--ink-1` |
| Screen subtitle | 13px | 500 | `--ink-3` |
| Nav title | 15px | 800 | `--ink-1` |
| Method card label | 14px | 700 | `--ink-1` |
| Type chip | 10px | 700 | `--ink-2` (gray-soft bg) |
| Method detail / masked number | 12–13px | 600 | `--ink-2/3` |
| Mask last-4 | 14px | 700 | `--ink-1` |
| Holder name (peer view) | 11px | 600 | `--ink-3` |
| Form label | 11px | 700, uppercase, tracking `.06em` | `--ink-2` |
| Form input | 15px | 500 | `--ink-1` |
| Input placeholder | 15px | 400 | `--ink-3` |
| Field hint | 11px | 500 | `--ink-3` |
| Field error | 11px | 600 | `--danger` |
| Info note text | 12px | 600 | `--accent` |
| Primary badge | 9px | 800, uppercase | `--accent` |
| Sheet title | 15px | 800 | `--ink-1` |
| Sheet sub | 12px | 500 | `--ink-3` |
| Privacy note | 11px | 600 | `--ink-3` |

**Content column padding:** `px-5` (`padding: 0 20px`) on mobile.
**Card border-radius:** `var(--r-card)` = `16px` for method cards; `var(--r-input)` = `12px` for inputs and pickers.
**Method row height:** `~70px` (min 56px). Padding: `14px 16px`.
**Separator:** `border-top: 1px solid var(--line-soft)` between rows.

---

## 7. State Matrix

| State | Visual |
|-------|--------|
| Loading | Skeleton pulses (`animate-pulse`, `bg-gray-soft`) — 2 placeholder rows |
| Empty (own) | Center-aligned icon + title + desc + CTA button in card |
| Legacy v0 data | Amber migration banner above card; methods shown with dashed radio + amber "Detail belum dilengkapi" indicator |
| Normal (populated) | Method rows with radio, icon, label, detail, edit/delete |
| Primary method | Filled radio + "Utama" star-badge (lavender) |
| Edit button | `--lavender-soft` bg, pencil icon |
| Delete button | `#fee2e2` bg, danger color, trash icon |
| Form — valid | Purple focus ring, save button enabled |
| Form — error | Red border + shadow on invalid fields, error message with icon, save button dimmed `opacity: .5; pointer-events: none` |
| Form — edit mode | Type field replaced by read-only tile + lock banner |
| Delete modal | Scale-in animation, danger icon + copy + [Batal] / [Hapus] |
| Peer sheet — methods available | Auto-selected primary; user can re-select |
| Peer sheet — empty payee | Icon + copy + "Tutup" only |
| QRIS upload (Phase 4 not yet) | Frosted overlay on upload zone |
| Toast success | `#111827` bg, lavender icon, slide-up `translateY(0)` |
| Toast error | Same bg, danger icon |

---

## 8. Developer Handoff — Prototype → React Mapping

### Layout structure
Each prototype frame maps to one React path:

| Prototype frame | React path |
|-----------------|-----------|
| `metode-pembayaran-list.html` Frame 1 | `MetodePembayaran.jsx` default render (populated) |
| `metode-pembayaran-list.html` Frame 2 | `MetodePembayaran.jsx` + `MethodsEmptyState` |
| `metode-pembayaran-list.html` Frame 3 | `MetodePembayaran.jsx` + `MigrationBanner` |
| `metode-pembayaran-form.html` Frame 1 | `MethodForm.jsx` mode="add" type="bank" |
| `metode-pembayaran-form.html` Frame 2 | `MethodForm.jsx` mode="add" type="ewallet" |
| `metode-pembayaran-form.html` Frame 3 | `MethodForm.jsx` mode="add" type="qris" |
| `metode-pembayaran-form.html` Frame 4 | `MethodForm.jsx` validation error state |
| `metode-pembayaran-form.html` Frame 5 | `MethodForm.jsx` mode="edit" |
| `metode-pembayaran-peer.html` Frame 1 | `PaymentMethodSelector.jsx` (sheet, methods present) |
| `metode-pembayaran-peer.html` Frame 2 | `PaymentMethodSelector.jsx` (QRIS method with image) |
| `metode-pembayaran-peer.html` Frame 3 | `PaymentMethodSelector.jsx` (empty payee) |
| `metode-pembayaran-peer.html` Frame 4 | `BuktiTransfer.jsx` (method row in receipt) |

### Class name → React class name mapping (1:1)
The prototype class names port directly as `className` values in JSX. Key mappings:

```
.method-row          → <div className="method-row">
.primary-radio.active → <div className={`primary-radio ${isPrimary ? 'active' : ''}`}>
.method-icon.bank    → <div className="method-icon bank">
.primary-badge       → <span className="primary-badge">
.masked-number       → <div className="masked-number"> (peer view only — never on own view)
.mask-dots           → <span className="mask-dots">
.mask-last4          → <span className="mask-last4">
.peer-method-card.selected → className={`peer-method-card ${isSelected ? 'selected' : ''}`}
.form-input.error    → className={`form-input ${hasError ? 'error' : ''}`}
.type-seg-btn.active → className={`type-seg-btn ${type === 'bank' ? 'active' : ''}`}
.primary-toggle-row.active → className={`primary-toggle-row ${isPrimary ? 'active' : ''}`}
.modal-backdrop.open → className={`modal-backdrop ${showDelete ? 'open' : ''}`}
```

### CSS layer placement
All new styles belong in `src/styles/app-v2.css` under `.v2-metode-pembayaran` scope (for the list/form page styles) and `.v2-payment-selector` (for the sheet). Do not add `.mp-*` or `.peer-method-*` rules to `index.css` — those are screen-specific, not tokens.

The masked-number pattern (`.masked-number`, `.mask-dots`, `.mask-last4`) should live in `app-v2.css` scoped under `.v2-payment-selector` since it is exclusive to the peer sheet.

### Motion
- Delete modal entry: CSS only — `transition: opacity .2s` on backdrop + `transition: transform .25s cubic-bezier(.34,1.56,.64,1)` on modal card. Toggle via `.open` class addition/removal with `requestAnimationFrame` to let the browser see the initial state before the class is added.
- Sheet slide-up: `transform: translateY(100%) → translateY(0)` — already the existing pattern in `app-v2.css`'s sheet keyframe.
- Toast: `transition: opacity .25s, transform .25s` — same as `final-proof.html`.
- **No Framer Motion** anywhere in v2 app screens.

### API integration notes
- `GET /users/me/payment-methods` → hydrates `MetodePembayaran` on mount
- `GET /users/{userId}/payment-methods` → hydrates `PaymentMethodSelector` (returns masked fields)
- On `POST`/`PUT` success: show toast, refetch list (`setMethods(await listMethods())`)
- On `DELETE` success: remove from local state optimistically, show toast
- Masking is server-side: the React component receives `"••••7890"` as the string value — just render it, never mask in JS
- `is_primary: true` → only one at a time; backend handles demotion of others; frontend should reflect the updated array returned in the response

### Icons (icons.jsx additions needed)
New icons to add to `src/components/application/v2/icons.jsx`:

```jsx
// Bank (landmark / institution)
export const BankIcon = ({ size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="3" y1="22" x2="21" y2="22"/>
    <line x1="6" y1="18" x2="6" y2="11"/>
    <line x1="10" y1="18" x2="10" y2="11"/>
    <line x1="14" y1="18" x2="14" y2="11"/>
    <line x1="18" y1="18" x2="18" y2="11"/>
    <polygon points="12 2 20 7 4 7"/>
  </svg>
);

// QRIS / QR code
export const QRCodeIcon = ({ size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z" strokeWidth="1.8"/>
  </svg>
);
```

The e-wallet icon is already in `icons.jsx` as part of the existing phone/device icons. Check before adding a duplicate.

---

## 9. Regulatory / Compliance Copy Checklist

The following copy strings must be present and exact:

**Info note (own view — MetodePembayaran page):**
> "Hyro tidak menyimpan atau memproses uangmu. Detail ini dipakai semata agar anggota grup bisa mentransfer langsung ke rekeningmu — tidak melalui aplikasi."

**Privacy note (peer view — PaymentMethodSelector sheet):**
> "Nomor rekening ditampilkan sebagian (4 digit terakhir) demi privasi. Detail lengkap hanya terlihat oleh pemilik."

**QRIS upload hint (form):**
> "Hanya gambar yang kamu upload sendiri yang ditampilkan. Hyro tidak membuat atau memproses QRIS."

**Delete confirm copy:**
> "Hapus metode pembayaran ini? Anggota grup tidak bisa membayar ke rekening ini lagi."

These are not just UX copy — they are the regulatory-consent text required by the PRD's compliance guardrails.

---

## 10. Accessibility Annotations

- Primary radio: `aria-label="Utama"` / `aria-label="Jadikan utama"` — no visual label, so aria is required
- Edit button: `aria-label="Edit [label]"` e.g. `aria-label="Edit BCA Utama"`
- Delete button: `aria-label="Hapus [label]"`
- Type segment buttons: `role="radio"` + `aria-checked={active}` within `role="radiogroup"`
- Form inputs: `<label>` elements with `htmlFor` — the `form-label` div should be `<label>`
- Error messages: `role="alert"` + `aria-live="polite"` on the field error container
- Sheet: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to `.sheet-title`
- Delete modal: same `role="dialog"` + `aria-modal="true"` + focus trap
- Masked number: `aria-label="Nomor rekening berakhiran 7890"` on the masked-number div — screen readers should not read "bullet bullet bullet bullet 7890"
- Loading skeleton: `aria-label="Memuat metode pembayaran…"` on the skeleton container
- Empty state CTA: descriptive label, not just "Tambah"

---

## 11. Known Gaps / Next Steps

1. **QRIS image upload UI** — designed as placeholder (frosted overlay). When Phase 4 ships, implement the `qris-zone` / `qris-preview` / `qris-change-btn` pattern from Frame 3 of the form prototype. The pattern matches BuktiTransfer's existing image-pick flow.
2. **Loading skeleton** — not fully prototyped. Use 2× pulse rectangles matching `method-row` height (70px) with `bg-gray-soft animate-pulse`.
3. **Confirmation step in BuktiTransfer** — Frame 4 of `metode-pembayaran-peer.html` shows the desired receipt row layout. The BuktiTransfer developer should match `.prf-row` structure with the "Ke Rekening" label + masked number + holder name.
4. **Primary promotion toast** — when user taps an unselected radio to make a method primary, show: "GoPay dijadikan metode utama ✓".
5. **Error toast (API failure)** — "Gagal menyimpan metode pembayaran. Coba lagi." with retry.
