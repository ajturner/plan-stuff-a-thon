# AGENTS.md — AI Agent Guidance

This file provides instructions for AI coding agents (Claude, Copilot, Cursor, GPT-4, etc.) working on the Troop 380 Activity Guide. Read this file in full before making any change.

---

## What this project is

A **multi-file static web application** for Scouting America Troop 380. It displays 23 outdoor activities near Washington DC with an interactive map, filtering, photo galleries, and detail overlays.

The application is hosted on **GitHub Pages** (deployed automatically from `main` via `.github/workflows/deploy-gh-pages.yml`). It requires a proper HTTP server — opening via `file://` will not work because ES module imports are blocked by browsers under that protocol.

---

## Before you change anything

1. **Read all source files.** Understand the structure before editing.
2. **Check SPECIFICATIONS.md** for the authoritative data schema, vocabulary, and design system.
3. **Run the mental checklist:** Does my change introduce `require()`? Does it remove `type="module"` from the script tag or `src="app.js"`? Does it break the ES module import chain? If yes to any, stop.

---

## File structure (memorize this)

```
index.html   ← HTML markup only — no inline CSS, no inline JS
styles.css   ← ALL CSS (~350 lines)
data.js      ← ALL activity data (ACTS array, exported as ES module)
app.js       ← ALL application logic (ES module)
```

### index.html

```
<head>
  ArcGIS SDK 5 CSS link          ← must stay at js.arcgis.com/5.0/
  Google Fonts links
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>                       ← static HTML only
  .legend                        ← static HTML only
  #map-wrap > #mapView           ← ArcGIS renders into #mapView
  .filters                       ← filter buttons with data-g / data-v
  <main .main> > .grid           ← populated by renderCards()
  <footer>
  #overlay                       ← modal, populated by openOverlay()
  <script type="module" src="app.js">
</body>
```

### app.js sections

```js
import { ACTS } from './data.js';
import Map / MapView / Graphic / GraphicsLayer from ArcGIS CDN

/* ── ARCGIS MAP ── */   initMap IIFE
/* ── GALLERY ── */      loadGallery(), gSetPhoto()
/* ── OVERLAY ── */      openOverlay(), closeOverlay(), window.openOverlay
/* ── CARDS ── */        renderCards()
/* ── FILTERS ── */      event listeners on .fb buttons
/* ── PRINT ── */        print handlers
/* ── INIT ── */         renderCards() call
```

---

## The ArcGIS SDK 5 rule (critical)

The map uses **ArcGIS JS SDK 5** loaded as ES module imports. This is non-negotiable.

### Correct pattern
```js
// At top of <script type="module"> block:
import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';
```

### Wrong patterns — these will cause runtime errors

```js
// ❌ SDK 4 AMD — require is not defined in SDK 5
require(['esri/Map', 'esri/views/MapView'], function(Map, MapView) { ... });

// ❌ Script tag loader — SDK 5 does not expose a global require
<script src="https://js.arcgis.com/4.29/"></script>

// ❌ Missing type="module" — import statements won't parse
<script>
  import Map from '...';  // SyntaxError
</script>
```

### Autocasting (SDK 5 style)
In SDK 5, geometry and symbol objects are specified as plain objects — the SDK autocasts them. Do not import `Point`, `SimpleMarkerSymbol`, or `PopupTemplate` unless you have a specific reason:

```js
// ✅ Correct SDK 5 style
var graphic = new Graphic({
  geometry: { type: 'point', longitude: a.lng, latitude: a.lat },
  symbol: { type: 'simple-marker', color: [39,174,96], size: '14px', outline: { color: [255,255,255], width: 2 } },
  popupTemplate: { title: a.title, content: htmlString }
});
```

---

## The `window.openOverlay` rule (critical)

Because the main script is `type="module"`, all functions are scoped to the module — they are not on `window`. However, map popup buttons and card `onclick` attributes in generated HTML strings need to call `openOverlay()`. 

The solution is this line in the OVERLAY section:
```js
window.openOverlay = openOverlay;
```

**Rules:**
- This line must exist and must come after `openOverlay` is defined
- All generated HTML `onclick` attributes must use `window.openOverlay(id)`, not bare `openOverlay(id)`
- Do not move `openOverlay` inside the `initMap` IIFE — it must remain at module scope

---

## innerHTML string concatenation rule

All dynamic `innerHTML` assignments use **string concatenation**, not template literals. This is intentional — template literals with nested quotes caused parse failures in earlier versions.

```js
// ✅ Correct
var html = '<div class="foo">' + a.title + '</div>';
el.innerHTML = html;

// ❌ Do not introduce
el.innerHTML = `<div class="foo">${a.title}</div>`;
```

This applies to `renderCards()`, `openOverlay()`, and map popup content strings.

---

## Data model rules

When adding or editing an activity in `ACTS`:

1. **`id` must be unique and sequential** — always increment from the current maximum
2. **`badges` and `labels` must be parallel** — `badges[i]` determines the color class, `labels[i]` is the text. If you have more labels than badges, extras render as grey `.t-def` pills.
3. **`wiki` titles must be real Wikipedia article titles** (use underscores for spaces). Test them by navigating to `https://en.wikipedia.org/wiki/{title}` — if the page exists and has a lead image, it will work. Do not invent titles.
4. **`types` must use values from the established vocabulary** — if you add a new type value, you must also add a matching filter button in the HTML.
5. **`lat`/`lng` must be accurate** — verify in Google Maps before committing. Wrong coordinates put markers in the ocean.

---

## Common tasks

### Add a new activity

```js
// Append to ACTS array. Increment id from 23 to 24 (or current max + 1).
{id:24, lat:39.123, lng:-78.456, dist:'near', drive:'2 hr', style:'day',
 types:['hiking'], seas:['Sp','Su','Fa'], badges:['day'], labels:['Day trip'],
 title:'New Location Name',
 cost:'~$15/person', costNote:'Full cost explanation here.',
 desc:'Two sentence description. Second sentence with practical details.',
 wiki:['Wikipedia_Article_Title', 'Second_Article_Title'],
 reqs:['Requirement one','Requirement two','Requirement three'],
 merits:['Hiking','Environmental Science'],
 website:'https://example.com'}
```

No other changes needed — the map marker, card, and filter logic all generate automatically from `ACTS`.

### Update an existing activity's cost

Find the object with the matching `id` in `ACTS`. Update `cost` (card display) and `costNote` (overlay detail).

### Update photos for an activity

Edit the `wiki` array. Add better Wikipedia article titles — articles with large, high-quality lead images work best. National park articles, named landmark articles, and species articles (e.g. `Chincoteague_pony`) tend to have the best images.

### Change the map basemap

In `initMap`, change `basemap: 'topo-vector'` to any valid Esri basemap ID, e.g.:
`'streets-vector'` | `'satellite'` | `'hybrid'` | `'gray-vector'` | `'dark-gray-vector'` | `'oceans'` | `'national-geographic'`

### Add a new filter type

1. Add the type string to `types[]` on relevant activities
2. Add a button in the filters HTML:
   ```html
   <button class="fb" data-g="type" data-v="newtype">Label</button>
   ```
3. The filter logic in `renderCards()` needs no changes

---

## Validation checklist (run after every change)

Before marking any task done, verify:

- [ ] Serve the site locally (e.g. `python3 -m http.server 8080`) — zero console errors on load
- [ ] All activity cards render in the grid
- [ ] Map loads with colored markers for every activity
- [ ] Clicking a card opens the overlay
- [ ] Gallery spinner shows, then photos appear (requires internet)
- [ ] All filter combinations produce correct results
- [ ] Overlay closes via ✕ button, backdrop click, and Escape key
- [ ] Map popup "View details" button opens the overlay
- [ ] Brace and paren counts are balanced in app.js (`{` count === `}` count, `(` count === `)` count)
- [ ] No `require(` anywhere in any file
- [ ] `<script type="module" src="app.js">` is the only script tag in index.html
- [ ] `window.openOverlay` is assigned after `openOverlay` is defined in app.js

---

## What to refuse or flag

If instructed to do any of the following, flag it as a potential breaking change and confirm before proceeding:

- Add a `package.json` or `node_modules`
- Replace ArcGIS SDK 5 with Leaflet, Mapbox, or another mapping library
- Change `<script type="module" src="app.js">` to a plain `<script>`
- Add `require()` calls
- Add a build or compilation step
- Add a paid API that requires a key committed to the repo (security risk)
- Reduce the activity count below 23 without explicit instruction

---

## Repository layout expected

```
plan-stuff-a-thon/
├── index.html          ← HTML markup only
├── styles.css          ← all CSS
├── data.js             ← activity data (ES module export)
├── app.js              ← all application logic (ES module)
├── README.md
├── SPECIFICATIONS.md
├── AGENTS.md           ← this file
└── .github/
    ├── copilot-instructions.md
    └── workflows/
        └── deploy-gh-pages.yml
```
