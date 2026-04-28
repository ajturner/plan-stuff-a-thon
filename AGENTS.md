# AGENTS.md — AI Agent Guidance

This file provides instructions for AI coding agents (Claude, Copilot, Cursor, GPT-4, etc.) working on the Troop 380 Activity Guide. Read this file in full before making any change.

---

## What this project is

A **single-file static web application** (`index.html`) for Scouting America Troop 380. It displays 23 outdoor activities near Washington DC with an interactive map, filtering, photo galleries, and detail overlays.

**The single-file constraint is intentional and must not be broken.** The file must be shareable by email, openable by double-click in any browser, and hostable without a server.

---

## Before you change anything

1. **Read the full file.** It is ~730 lines. Understand the structure before editing.
2. **Check SPECIFICATIONS.md** for the authoritative data schema, vocabulary, and design system.
3. **Run the mental checklist:** Does my change break the single-file constraint? Does it introduce `require()`? Does it remove `type="module"` from the script? If yes to any, stop.

---

## File structure (memorize this)

```
<head>
  ArcGIS SDK 5 CSS link          ← must stay at js.arcgis.com/5.0/
  Google Fonts links
  <style> block                  ← ALL CSS is here, ~350 lines
</head>
<body>
  <header>                       ← static HTML only
  .legend                        ← static HTML only
  #map-wrap > #mapView           ← ArcGIS renders into #mapView
  .filters                       ← filter buttons with data-g / data-v
  <main .main> > .grid           ← populated by renderCards()
  <footer>
  #overlay                       ← modal, populated by openOverlay()
  <script type="module">
    var ACTS = [...]              ← ALL activity data (23 objects)
    /* ── ARCGIS MAP ── */        ← ES module imports + initMap IIFE
    /* ── GALLERY ── */           ← loadGallery(), gSetPhoto()
    /* ── OVERLAY ── */           ← openOverlay(), closeOverlay(), window.openOverlay
    /* ── CARDS ── */             ← renderCards()
    /* ── FILTERS ── */           ← event listeners on .fb buttons
    /* ── INIT ── */              ← renderCards() call
  </script>
</body>
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

- [ ] Open the file in a browser — zero console errors on load
- [ ] All activity cards render in the grid
- [ ] Map loads with colored markers for every activity
- [ ] Clicking a card opens the overlay
- [ ] Gallery spinner shows, then photos appear (requires internet)
- [ ] All filter combinations produce correct results
- [ ] Overlay closes via ✕ button, backdrop click, and Escape key
- [ ] Map popup "View details" button opens the overlay
- [ ] Brace and paren counts are balanced (`{` count === `}` count, `(` count === `)` count)
- [ ] No `require(` anywhere in the file
- [ ] Only one `<script` tag in the file, and it has `type="module"`
- [ ] `window.openOverlay` is assigned after `openOverlay` is defined

---

## What to refuse or flag

If instructed to do any of the following, flag it as a potential breaking change and confirm before proceeding:

- Split the single HTML file into multiple files
- Add a `package.json` or `node_modules`
- Replace ArcGIS SDK 5 with Leaflet, Mapbox, or another mapping library
- Change `<script type="module">` to a plain `<script>`
- Add `require()` calls
- Add a build or compilation step
- Add a paid API that requires a key embedded in the file (security risk)
- Reduce the activity count below 23 without explicit instruction

---

## Repository layout expected

```
troop380-activities/
├── index.html     ← the entire application
├── README.md
├── SPECIFICATIONS.md
├── AGENTS.md                    ← this file
└── .github/
    └── copilot-instructions.md
```

Do not create additional files or directories unless explicitly instructed.
