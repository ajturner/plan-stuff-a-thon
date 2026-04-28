# GitHub Copilot Instructions — Troop 380 Activity Guide

These instructions tell Copilot how to assist with this repository. Read them before suggesting any code change.

---

## Project context

This is a **single-file static web application** — `index.html`. There is no build system, no `node_modules`, no TypeScript, and no framework. All HTML, CSS, and JavaScript live in one file. Keep it that way. Do not suggest splitting into multiple files, adding a bundler, or introducing npm dependencies.

The application is used by Scouting America Troop 380 at their annual Plan-Stuff-A-Thon activity planning event. Scouts aged 10–17 browse 23 outdoor adventures near Washington DC.

---

## Architecture rules

### Single-file constraint
- All changes go in `index.html`
- No external `.css`, `.js`, or asset files
- No `package.json`, no build step

### Script type
The main script tag is `<script type="module">`. This means:
- ES module `import` syntax is valid and expected
- Functions are module-scoped — not automatically on `window`
- Any function called from inline HTML attributes (onclick, etc.) **must** be explicitly assigned to `window`: e.g. `window.openOverlay = openOverlay`
- Do not change the script tag to remove `type="module"`

### ArcGIS SDK version
The map uses **ArcGIS JS SDK 5**, loaded as ES modules:
```js
import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';
```
- Do **not** use `require([...], function(){})` — that is the SDK 4 AMD pattern and will throw `ReferenceError: require is not defined`
- Do **not** add a separate `<script src="https://js.arcgis.com/...">` loader tag
- Geometry and symbol objects are passed as **plain autocasted objects** (SDK 5 style) — do not import `Point`, `SimpleMarkerSymbol`, etc. unless a feature genuinely requires it
- The CSS link must point to `https://js.arcgis.com/5.0/esri/themes/light/main.css`

### No AMD, no CommonJS
- Do not use `require()`, `define()`, `module.exports`, or `exports`
- Do not suggest Webpack, Rollup, Vite, or any bundler

---

## Data model

All activity data lives in the `ACTS` array. Each object has these fields:

```js
{
  id:       number,      // unique sequential integer
  lat:      number,      // WGS84 latitude
  lng:      number,      // WGS84 longitude
  dist:     string,      // 'near' | 'mid' | 'far'
  drive:    string,      // e.g. '1.5 hr'
  style:    string,      // 'day' | 'overnight'
  types:    string[],    // from type vocabulary
  seas:     string[],    // subset of ['Sp','Su','Fa','Wi']
  badges:   string[],    // from badge vocabulary — parallel with labels
  labels:   string[],    // display text for each badge + any extras
  title:    string,
  cost:     string,      // short e.g. '~$25/person'
  costNote: string,      // longer explanation
  desc:     string,
  wiki:     string[],    // Wikipedia article titles for gallery photos
  reqs:     string[],    // requirement bullets
  merits:   string[],    // official BSA merit badge names
  website:  string       // URL
}
```

**Type vocabulary:** `water` | `hiking` | `climbing` | `cave` | `bike` | `beach` | `history` | `multi`

**Badge vocabulary:** `day` | `over` | `bike` | `beach` | `merit` | `bsa`

**Season codes:** `Sp` | `Su` | `Fa` | `Wi`

**Distance codes:** `near` (≤2 hr) | `mid` (2–3.5 hr) | `far` (4–5 hr)

---

## CSS conventions

- All design tokens are CSS custom properties on `:root` — use them, don't hardcode color hex values
- Class names follow BEM-lite conventions: component prefix + modifier (e.g. `.c-body`, `.s-near`, `.t-day`, `.sd-sp`)
- Do not add inline styles to elements except in dynamically built HTML strings (map popup content)
- The ArcGIS map container is `#mapView` — do not rename it
- Do not add Tailwind, Bootstrap, or any CSS framework

---

## JavaScript conventions

- No TypeScript — plain JS only
- Prefer `var` in non-module functions for consistency with existing code; `const`/`let` are fine in new additions
- No class syntax for the main application logic — it's procedural
- `async/await` is used for the gallery fetch — this is correct and intentional, don't convert to `.then()` chains
- Closures are used for gallery dot click handlers — respect the pattern:
  ```js
  (function(idx) {
    dot.addEventListener('click', function() { gSetPhoto(idx); });
  }(i));
  ```
- `innerHTML` assignments use **string concatenation**, not template literals — this is intentional to avoid parser ambiguity with nested quotes. Do not convert to template literals.

---

## Photo / gallery system

Photos come from the **Wikipedia REST API** fetched client-side:
```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{articleTitle}
```
- No API key needed
- Max 3 photos per activity
- Failed fetches are silently skipped
- The size segment in the thumbnail URL is replaced: `.replace(/\/\d+px-/, '/800px-')`
- Do not switch to a paid image API or require an API key

---

## Adding a new activity

1. Add a new object to the end of the `ACTS` array with the next sequential `id`
2. Add a map marker — it is automatically created by the `ACTS.forEach` loop, no extra code needed
3. Do not add a new filter button unless introducing a brand-new `type` not in the existing vocabulary

## Adding a new filter type

1. Add the new type string to the relevant activity's `types` array
2. Add a `<button class="fb" data-g="type" data-v="newtype">Label</button>` in the filters HTML
3. The filter logic in `renderCards()` works automatically via `indexOf`

---

## What NOT to do

- Do not add `require()` anywhere
- Do not add a `<script src="https://js.arcgis.com/4.x/...">` tag
- Do not split the file into multiple files
- Do not add a build step or package manager
- Do not add inline `<script>` tags in the `<body>` (all JS is in the single module script at the bottom)
- Do not use template literals inside `innerHTML =` assignments
- Do not hardcode color values — use CSS custom properties
- Do not move `openOverlay` or `closeOverlay` inside the ArcGIS `initMap` function — they must remain at module scope and be assigned to `window`

---

## Testing

There is no automated test suite. Manual testing procedure:
1. Open `index.html` in a browser
2. Open the browser console — zero errors expected on load
3. Click each filter combination and verify card counts change
4. Click a card — overlay opens, gallery spinner appears, photos load
5. Click map markers — popups open, "View details" button works
6. Press Escape — overlay closes
7. Resize to 375px width — layout should not break
