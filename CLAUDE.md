# CLAUDE.md

Guidance for Claude (and other AI coding agents) working in this repository. Read this in full before making any change. For deeper detail, see `AGENTS.md` and `SPECIFICATIONS.md` — this file is the fast on-ramp.

---

## What this repo is

A **multi-file static web app** — Scouting America Troop 380's Adventure Activity Guide. Used at the annual *Plan-Stuff-A-Thon* to browse, filter, and pick outdoor activities for the upcoming year.

- **No build system.** No `package.json`, no bundler, no TypeScript.
- **Hosted on GitHub Pages**, deployed automatically from `main` via `.github/workflows/deploy-gh-pages.yml`.
- **Must be served over HTTP** (e.g. `python3 -m http.server`). ES module imports do not work under `file://`.

---

## Repository layout

```
index.html      HTML markup only (no inline CSS/JS)
styles.css      All CSS, ~1000 lines, design tokens on :root
data.js         The ACTS array — every activity is a record here (ES module export)
app.js          All application logic (ES module: imports ACTS + ArcGIS SDK 5)
README.md       User-facing project overview
SPECIFICATIONS.md   Authoritative schema, design system, vocabulary
AGENTS.md       Detailed AI-agent guidance (longer than this file)
.github/
  copilot-instructions.md
  workflows/deploy-gh-pages.yml
```

### app.js section map

```
IMPORTS              ACTS + ArcGIS SDK 5 modules
ARCGIS MAP           initMap IIFE — markers, popups
GALLERY              loadGallery(), gSetPhoto() — Wikipedia + Wikimedia Commons fetch
OVERLAY              openOverlay(), closeOverlay(), window.openOverlay = openOverlay
CARDS                renderCards() — filter logic + DOM build
FILTERS              .fb click handlers — fType / fTrip / fSeas / fBaloo
PRINT HANDLERS       printIndexBtn / printActivityBtn, afterprint cleanup
INIT                 renderCards() call
```

---

## Current state (verify before relying on counts)

- **29 activities** in `ACTS` (ids 1–29), 12 of which are BALOO-compliant Cub Scout sites
- **Four filter axes**: Type, Style (day/overnight), Season, Cub Scout/BALOO
- Photo gallery uses **Wikipedia Action API** (`pageimages` with `pithumbsize=800`) with **Wikimedia Commons** as a fallback
- Print stylesheet supports both *full index* and *single activity* modes via the `print-single` body class

> **Heads-up:** older paragraphs in `README.md`/`AGENTS.md`/`SPECIFICATIONS.md` may still mention 23 activities or describe only three filter axes. The data file and `app.js` are the source of truth.

---

## Non-negotiable rules

These break the app if violated. Treat any instruction to do them as a flag-and-confirm event.

1. **Keep `<script type="module" src="app.js">`.** Removing `type="module"` breaks `import` syntax.
2. **ArcGIS SDK 5, ES modules only.** No `require([...], cb)` (SDK 4 AMD), no separate `<script src="https://js.arcgis.com/...">` loader. CSS link must point to `https://js.arcgis.com/5.0/esri/themes/light/main.css`.
3. **`window.openOverlay = openOverlay;`** must remain after `openOverlay` is defined. Map popup buttons and card `onclick` attributes call `window.openOverlay(id)` from outside the module scope.
4. **String concatenation, not template literals**, inside any `innerHTML` assignment. This is intentional — earlier template-literal versions broke on nested quotes.
5. **No build step, no `package.json`, no `node_modules`.** Static files only.
6. **No API keys committed.** Photo system runs on free, key-less APIs.

---

## Data model (ACTS)

Each entry in `data.js`:

```js
{
  id, lat, lng,
  dist:   'near' | 'mid' | 'far',          // ≤2 hr | 2–3.5 hr | 4–5 hr
  drive:  '1.5 hr',                        // human string
  style:  'day' | 'overnight',
  types:  ['water'|'hiking'|'climbing'|'cave'|'bike'|'beach'|'history'|'multi'],
  seas:   subset of ['Sp','Su','Fa','Wi'],
  badges: ['day'|'over'|'bike'|'beach'|'merit'|'bsa'|'baloo'],   // parallel with labels
  labels: ['display text', ...],           // extras render as grey .t-def pills
  title, cost, costNote, desc,
  wiki:    ['Wikipedia_Article_Title', ...], // underscores for spaces; real titles only
  reqs:    [...], merits: [...],
  website: 'https://...'
}
```

Rules when editing:

- `id` is unique and sequential — increment from current max (next is **30**)
- `badges[i]` ↔ `labels[i]` — keep in sync; extra labels become grey pills
- `wiki` titles must resolve at `https://en.wikipedia.org/wiki/<title>` (underscores)
- `lat`/`lng` accuracy matters — wrong values put markers in the ocean
- A new `types` value requires a matching `<button class="fb" data-g="type" data-v="...">` in `index.html`
- `'baloo'` in `badges` is what the Cub Scout filter (`data-g="baloo"`) checks for

---

## Common tasks

### Add an activity
Append a new object to `ACTS` in `data.js` with the next sequential `id`. The map marker, card, filter logic, and overlay all generate from `ACTS` — no other files need changing unless you introduce a new `types` value.

### Update photos
Edit the `wiki` array. Articles with strong lead images (national parks, named landmarks, species pages) work best. Test the title manually at `https://en.wikipedia.org/wiki/<title>` first. The loader falls back to Wikimedia Commons image search if the Wikipedia page has no thumbnail.

### Change the basemap
In `app.js → initMap`, change `basemap: 'topo-vector'` to any Esri basemap id (`streets-vector`, `satellite`, `hybrid`, `gray-vector`, `dark-gray-vector`, `oceans`, `national-geographic`).

### Add a filter axis
1. Add filter buttons in `index.html` with `data-g="<group>"` `data-v="<value>"`
2. Add a module-scoped state var (`var fNew = 'all';`) in the FILTERS section of `app.js`
3. Extend the filter predicate inside `renderCards()`
4. Add the group to the `ON_CLS` map for the active-class swap

---

## Conventions

- **Plain JS only.** No TypeScript, no class syntax for app logic.
- **Existing functions use `var`** for consistency; `const`/`let` are fine in new code.
- **`async/await`** is used for the gallery — keep it; don't convert to `.then()` chains.
- **Closures** capture index in dot-click handlers — preserve the pattern when adding similar code.
- **CSS design tokens** live on `:root` in `styles.css`. Use them, don't hardcode hex values. Class names are BEM-lite (`.c-body`, `.s-near`, `.t-day`, `.sd-sp`).
- **Keep `#mapView` as the map container id.**

---

## Local development

```bash
# from the repo root
python3 -m http.server 8080
# then open http://localhost:8080
```

No `file://` opens — module imports will fail.

### Pre-merge checklist

- [ ] Zero console errors on load
- [ ] All cards render in the grid
- [ ] Every activity has a colored map marker
- [ ] Card click → overlay opens; gallery spinner shows then photos load
- [ ] All filter combinations produce correct counts (`#countBadge`)
- [ ] Overlay closes via ✕ button, backdrop click, **and** Escape
- [ ] Map popup "View details" opens the overlay
- [ ] Brace/paren counts in `app.js` are balanced
- [ ] No `require(` anywhere
- [ ] `<script type="module" src="app.js">` is the only script tag in `index.html`
- [ ] `window.openOverlay` assignment is present after `openOverlay` is defined
- [ ] 375px-wide mobile viewport doesn't break layout

---

## Deploy

Pushes to `main` trigger `.github/workflows/deploy-gh-pages.yml`, which rsyncs the source files (excluding docs) to the `gh-pages` branch. No manual deploy step.

---

## Flag-and-confirm requests

If asked to do any of these, raise it with the user before proceeding — they materially change the project's architecture or constraints:

- Adding `package.json`, `node_modules`, or a build step
- Replacing ArcGIS SDK 5 with a different mapping library
- Removing `type="module"` from the script tag
- Reintroducing `require()` or AMD-style loaders
- Adding a paid/keyed API
- Reducing the activity count below the current 29 without explicit instruction
- Merging `index.html`, `styles.css`, `data.js`, `app.js` back into a single file
