# Troop 380 Activity Guide — Specifications

Version 2.0 · Multi-file static web application — hosted on GitHub Pages

---

## 1. Purpose & Audience

The Activity Guide is a planning tool used at Troop 380's annual **Plan-Stuff-A-Thon**, where scouts browse, compare, and vote on activities for the upcoming year. It is also distributed as a shareable link to scouts, parents, and troop committee members.

**Primary users:** Scouts aged 10–17  
**Secondary users:** Scoutmasters, committee members, parents  
**Usage context:** Desktop browser at meetings; mobile browser for personal review

---

## 2. File Architecture

The application is a **multi-file static web application** hosted on **GitHub Pages**. There is no build toolchain and no `package.json`. The site is served from the `gh-pages` branch via the workflow in `.github/workflows/deploy-gh-pages.yml`.

```
index.html   ← HTML markup only
styles.css   ← all CSS (~350 lines)
data.js      ← activity data array (ES module export)
app.js       ← all application logic (ES module, imports data.js + ArcGIS SDK 5)
```

### index.html structure

```
<head>
  ArcGIS JS SDK 5 CSS (CDN)
  Google Fonts (CDN) — Bebas Neue, DM Sans, DM Mono
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>       — branding, title, troop metadata
  .legend        — distance and badge key
  #map-wrap      — ArcGIS MapView container
  .filters       — sticky filter bar (type / trip style / season)
  <main .main>   — card grid
  <footer>
  #overlay       — modal detail panel with gallery
  <script type="module" src="app.js">
</body>
```

### app.js structure

```js
import { ACTS } from './data.js';
import Map / MapView / Graphic / GraphicsLayer from ArcGIS SDK 5 CDN

/* ── ARCGIS MAP ── */   initMap IIFE — ES module imports + MapView init
/* ── GALLERY ── */      loadGallery(), gSetPhoto()
/* ── OVERLAY ── */      openOverlay(), closeOverlay(), window.openOverlay
/* ── CARDS ── */        renderCards() with filter logic
/* ── FILTERS ── */      event listeners on .fb buttons
/* ── PRINT ── */        print handlers
/* ── INIT ── */         renderCards() call
```

---

## 3. Activity Data Schema

Each entry in the `ACTS` array must conform to the following schema. All fields are required unless marked optional.

### 3.1 Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `number` | Unique positive integer, sequential | Primary key. Used in DOM `onclick` attributes. |
| `lat` | `number` | Valid WGS84 latitude (-90 to 90) | Map marker position. |
| `lng` | `number` | Valid WGS84 longitude (-180 to 180) | Map marker position. |
| `dist` | `string` | `'near'` \| `'mid'` \| `'far'` | Distance band from DC. Controls marker color and badge color. |
| `drive` | `string` | Short human string e.g. `'1.5 hr'` | Displayed on card and map popup. |
| `style` | `string` | `'day'` \| `'overnight'` | Trip style. Controls trip-style filter and overlay badge. |
| `types` | `string[]` | One or more from type vocabulary | Drives the Type filter. |
| `season` | `string[]` | Subset of `['Sp','Su','Fa','Wi']` | Active season dots on card. |
| `badges` | `string[]` | From badge vocabulary | Parallel with `labels`. Controls pill color. |
| `labels` | `string[]` | Same length as `badges` + any extras | Display text for each badge/tag pill. |
| `title` | `string` | Max ~50 chars recommended | Card heading. Rendered in Bebas Neue. |
| `cost` | `string` | Short e.g. `'~$25/person'` or `'Free'` | Displayed on card face and overlay. |
| `costNote` | `string` | 1–3 sentences | Full cost breakdown in overlay. |
| `desc` | `string` | 2–3 sentences, max ~200 chars | Shown on card and overlay intro. |
| `wiki` | `string[]` | Wikipedia article titles (underscores for spaces) | Used to fetch gallery photos via Wikipedia REST API. Order matters — first successful image shows first. |
| `reqs` | `string[]` | 4–8 bullet strings | Requirements / logistics in overlay. |
| `merits` | `string[]` | Official BSA merit badge names | Shown as pink chips in overlay. Optional — empty array ok. |
| `website` | `string` | Valid URL | Official site link. Optional — omit or empty string to hide. |

### 3.2 Vocabulary

**`dist` values and visual treatment:**
| Value | Drive time | Stripe color | Badge color |
|-------|-----------|--------------|-------------|
| `near` | ≤ 2 hours | `#27ae60` green | `.d-near` green |
| `mid` | 2 – 3.5 hours | `#e67e22` orange | `.d-mid` orange |
| `far` | 4 – 5 hours | `#c0392b` red | `.d-far` red |

**`types` vocabulary:**
`water` | `hiking` | `climbing` | `cave` | `bike` | `beach` | `history` | `multi`

Each value corresponds to a filter button. Adding a new type requires adding a matching `<button class="fb" data-g="type" data-v="...">` to the filter bar HTML.

**`season` vocabulary:**
| Code | Season | Dot color |
|------|--------|-----------|
| `Sp` | Spring | `.sd-sp` green |
| `Su` | Summer | `.sd-su` amber |
| `Fa` | Fall | `.sd-fa` orange |
| `Wi` | Winter | `.sd-wi` blue |

**`badges` vocabulary and colors:**
| Key | CSS class | Color | Semantic use |
|-----|-----------|-------|--------------|
| `day` | `.t-day` | blue | Day trip |
| `over` | `.t-over` | purple | Overnight / multi-day |
| `bike` | `.t-bike` | amber | Biking activity |
| `beach` | `.t-beach` | teal | Beach destination |
| `merit` | `.t-merit` | pink | Merit badge program available |
| `bsa` | `.t-bsa` | orange | Official BSA camp/program |
| `baloo` | `.t-baloo` | gold | BALOO-compliant for Cub Scout pack/den outings and recruiting |

Extra `labels` beyond the `badges` array length are rendered as `.t-def` (grey) pills.

---

## 4. Map Specification

### 4.1 Library
ArcGIS JS SDK 5, loaded as ES modules from `https://js.arcgis.com/5.0/@arcgis/core/`.

### 4.2 Modules used
| Module | Import path |
|--------|-------------|
| `Map` | `@arcgis/core/Map.js` |
| `MapView` | `@arcgis/core/views/MapView.js` |
| `Graphic` | `@arcgis/core/Graphic.js` |
| `GraphicsLayer` | `@arcgis/core/layers/GraphicsLayer.js` |

Geometry and symbol objects are passed as **autocasted plain objects** (SDK 5 style) — do not import `Point`, `SimpleMarkerSymbol`, or `PopupTemplate` separately.

### 4.3 Configuration
- **Basemap:** `topo-vector` (Esri hosted, no API key required for basic use)
- **Initial center:** `[-77.8, 38.95]` (lon, lat — centered on the DC/Shenandoah area)
- **Initial zoom:** `7`
- **Container:** `<div id="mapView">`
- **Height:** 400px desktop, 260px mobile (set in CSS)

### 4.4 Markers
Each activity gets a `simple-marker` circle with:
- Color from `distColor` map: `{ near: [39,174,96], mid: [230,126,34], far: [192,57,43] }`
- Size: `14px`
- White outline, width `2`

### 4.5 Popups
Each graphic's `popupTemplate.content` is an HTML string containing:
1. Activity title (Bebas Neue, styled inline)
2. Drive time + trip style
3. Cost string
4. `<button onclick="window.openOverlay(id)">View details</button>`

**Critical:** The button must call `window.openOverlay()` (not bare `openOverlay()`) because the popup content executes in a context outside the ES module scope. `openOverlay` is explicitly assigned to `window` in the OVERLAY section.

### 4.6 `window.openOverlay` contract
```js
window.openOverlay = openOverlay;  // assigned once, in the OVERLAY section
```
This line must remain after the `openOverlay` function definition and before any code that adds map graphics.

---

## 5. Gallery Specification

### 5.1 Photo source
Photos are fetched at runtime from the Wikipedia Summary REST API:
```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```
Response field used: `data.thumbnail.source`

The thumbnail URL is upscaled by replacing the size segment:
```js
src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
```

### 5.2 Fetch behavior
- Up to 3 photos fetched per activity (stops early once 3 found)
- Titles iterated in order from the `wiki` array
- Failed fetches (network error or non-ok response) are silently skipped
- If zero photos load: shows `.g-empty` placeholder text
- Images that 404 after load (onerror): hidden with `display:none`

### 5.3 DOM lifecycle
On `openOverlay(id)`:
1. Remove all `.g-img`, `.g-loader`, `.g-empty` elements from `#gallery`
2. Clear `#gDots` and `#gCap`
3. Insert `.g-loader` spinner
4. `await` Wikipedia fetches
5. Remove `.g-loader`
6. Insert `<img class="g-img">` elements and `<button class="g-dot">` dots
7. Set first image `.on` (visible) and first dot `.on`

Navigation: prev/next buttons (`#gPrev`, `#gNext`) and dots call `gSetPhoto(idx)` which toggles `.on` class on images and dots and updates caption.

---

## 6. Overlay Specification

### 6.1 Trigger
Any `.card` click, any `.detail-btn` click, or any map popup "View details" button calls `window.openOverlay(id)`.

### 6.2 Open behavior
1. Gallery load initiated (async, non-blocking)
2. Title, meta badges, description, cost/requirements grid, merit chips populated synchronously
3. `#overlay` gets class `open` (changes `display:none` → `display:flex`)
4. `document.body.style.overflow = 'hidden'` (prevent background scroll)

### 6.3 Close behavior
Three triggers: close button `#olClose` click, overlay backdrop click (`e.target === overlay`), `Escape` keydown. All call `closeOverlay()` which removes `.open` and restores `body.overflow`.

### 6.4 Overlay sections (in DOM order)
| Element | ID | Content |
|---------|----|---------|
| Gallery | `#gallery` | Async photo carousel |
| Title | `#olTitle` | `a.title` |
| Meta badges | `#olMeta` | Drive badge, style badge, merit/bsa if applicable |
| Description | `#olDesc` | `a.desc` |
| Detail grid | `#olGrid` | Cost box (left) + Requirements box (right) |
| Merit chips | `#olMerits` | Pink chip row, omitted if `a.merits` empty |

---

## 7. Filter Specification

### 7.1 Filter state
Three module-scoped variables: `fType`, `fTrip`, `fSeason`. Default `'all'`.

### 7.2 Filter logic (inside `renderCards`)
An activity passes all three filters if:
```
(fType === 'all' || a.types.indexOf(fType) !== -1) &&
(fTrip === 'all' || a.style === fTrip) &&
(fSeason === 'all' || a.seas.indexOf(fSeason) !== -1)
```

### 7.3 Button active states
| Filter group | Active class | Color |
|-------------|--------------|-------|
| `type` | `.on` | Dark forest green |
| `trip` | `.on-t` | Pine green |
| `season` | `.on-s` | Bark brown |

Each button carries `data-g` (group) and `data-v` (value) attributes. Click handler removes all active classes from the group then adds the correct one to the clicked button.

### 7.4 Count display
`#countBadge` updated after every filter change with `N activit(y|ies)`.

---

## 8. Design System

### 8.1 CSS custom properties (design tokens)
```css
--forest: #1a3a2a   /* darkest green — headers, text */
--pine:   #2d5a3d   /* mid green — interactive elements */
--moss:   #6b9c78   /* medium — list markers */
--fern:   #9dc4a0   /* light — header labels */
--cream:  #f5f0e8   /* page background */
--sand:   #e8dcc8   /* card borders, filter bar */
--bark:   #8b6f47   /* brown — secondary labels */
--slate:  #34495e   /* dark grey — body text */
--c-near: #27ae60   /* near distance — green */
--c-mid:  #e67e22   /* mid distance — orange */
--c-far:  #c0392b   /* far distance — red */
```

### 8.2 Typography
| Role | Font | Weight | Where |
|------|------|--------|-------|
| Display headings | Bebas Neue | 400 | `<h1>`, card titles, overlay title |
| Body text | DM Sans | 300, 400, 500 | Descriptions, buttons, UI |
| Labels & badges | DM Mono | 400, 500 | All badges, cost values, filter labels |

### 8.3 Card anatomy
```
┌─────────────────────────────────────┐
│ [5px color stripe — dist color]     │  .c-stripe .s-{near|mid|far}
├─────────────────────────────────────┤
│ Title                   [drive]     │  .c-title + .dbadge.d-{near|mid|far}
│ [Sp][Su][Fa][Wi]                    │  .season .sd .sd-{sp|su|fa|wi}
│ [Tag][Tag][Tag]                     │  .tags .tag .t-{...}
│ Description text...                 │  .c-desc
│ Cost: ~$X/person                    │  .c-cost
├─────────────────────────────────────┤
│ [Details + Photos →]                │  .c-foot .detail-btn
└─────────────────────────────────────┘
```

### 8.4 Responsive breakpoints
Single breakpoint at `600px`:
- Map height: 400px → 260px
- Filter/header/main padding: 2rem → 1rem
- Detail grid: 2-column → 1-column
- Gallery height: 270px → 200px

---

## 9. Content Standards

### 9.1 Activity selection criteria
- Must be accessible to scouts aged 10–17
- Must be within 5 hours driving of Washington DC (Tysons, VA area)
- Preference for activities with BSA merit badge opportunities
- Must have a verifiable public website

### 9.2 Cost format
- Lead with the per-person estimate: `'~$25/person'` or `'Free'`
- `costNote` must explain what is and isn't included
- Ranges preferred over single figures when pricing varies

### 9.3 Description format
- 2–3 sentences maximum
- First sentence: what you do and why it's notable
- Second sentence: practical context (difficulty, age, special features)
- No first-person language

### 9.4 Requirements format
- 4–8 bullets
- Actionable: what scouts/leaders must do or bring
- Include any permit or reservation requirements
- Flag any seasonal closures

### 9.5 Merit badge names
Use official BSA merit badge names exactly as they appear on scouting.org. Common ones used in this guide:
`Hiking`, `Camping`, `Backpacking`, `Cycling`, `Kayaking`, `Canoeing`, `Swimming`, `Climbing`, `Environmental Science`, `Nature`, `Geology`, `American Heritage`, `Citizenship in the Nation`, `Wilderness Survival`, `Physical Fitness`, `Whitewater`

---

## 10. Quality Checklist

Before merging any change:

- [ ] File opens without console errors in Chrome, Firefox, and Safari
- [ ] All 23 (or updated count) activity cards render
- [ ] Map loads with markers for every activity
- [ ] Clicking a card opens the overlay without errors
- [ ] Gallery spinner appears and photos load (when online)
- [ ] All three filter axes work correctly in combination
- [ ] Overlay closes via button, backdrop click, and Escape key
- [ ] New activity has all required schema fields
- [ ] `id` is unique and sequential
- [ ] `lat`/`lng` places marker in the correct geographic location
- [ ] `wiki` titles load real images (test by opening overlay)
- [ ] `badges` and `labels` arrays are the same length (or labels is longer)
- [ ] Page is usable on a 375px-wide mobile viewport
