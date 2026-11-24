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
| `xfar` | 6+ hours or fly-in (high adventure bases) | `#5b3a8c` purple | `.d-xfar` purple |

Markers for activities excluded by the current filters are redrawn grey (`#b0b0b0` at 45% alpha) and shrunk from 14px to 9px by `applyMapFilter()`, which `renderCards()` calls on every filter change. They stay on the map and remain clickable.

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
| `ha` | `.t-ha` | purple | High adventure trek/base (age 13/14+). Drives the High adventure filter (`data-g="ha"`, values `all` / `yes` = show only / `no` = hide). |

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

### 4.5 Marker hover card and click
The map has no popups (`popupEnabled: false`). `bindMarkers()` in `shared.js`
reads each graphic's `attributes.key` and:
1. on hover, shows the shared hover card (`#hoverTip`) with drive time, trip style, title and cost;
2. on click, calls `window.openOverlay(id)`.

**Critical:** the click goes through `window.openOverlay()` rather than the bare module-scope `openOverlay`, so that the print handler's wrapper — which records the currently open activity — still runs. `openOverlay` is explicitly assigned to `window` in the OVERLAY section.

The map also carries the SDK's `Home` and `Search` widgets, added by `addMapControls()`.

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
Any `.card` click, the card title button, any `.detail-btn` click, or a map marker click calls `window.openOverlay(id)`. The details are not a modal: they replace the list in the results pane (`#listView` hidden, `#detailView` shown), so the map stays visible with only that item's marker lit and the view zoomed to it. Opening moves focus to the title; "Back to all results" or Escape restores the list at its previous scroll position and returns focus to whatever opened it. Changing a filter also returns to the list. The markup keeps the `.overlay` / `.ol-panel` classes for the single-sheet print styles.

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
(fHA === 'all' || (fHA === 'yes') === (a.badges.indexOf('ha') !== -1)) &&
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


---

## 8. Summer Camp Page (`summer-camp/`)

Files: `summer-camp/index.html` (markup; served at `/summer-camp/`), `camps.html` (redirect for old links, with `redirect-camps.js`), `camps-data.js` (data), `camps.js` (behaviour); styles in the "SUMMER CAMP PAGE" section of `styles.css`.

`camps-data.js` exports:

| Export | Meaning |
|--------|---------|
| `WEEKS` | Sunday start dates compared on the page, as `'MM-DD'` |
| `PATROLS` | `{code, name, asks:[{text, key}]}`; `key` is a `FIT_KEYS` name or `null` |
| `CAMPS` | One object per camp (fields below) |

Camp fields: `id`, `name`, `site`, `council`, `place`, `lat`, `lng`, `dist` (`near`/`mid`/`far`), `drive`, `mins` (for sorting), `weeks` (`{'MM-DD': 'open'|'almost'|'full'|'listed'}`; a missing week is not offered), `youth` (number for sorting, or `null`), `youthLabel`, `adult`, `costNote`, `meals` (`dh`/`pc`/`hs`; empty = not confirmed), `water`, `fresh` (`true`/`false`/`null`), `flags` (`shoot`, `craft`, `nature`, `stem`, `climb`, `bike`: `true`/`false`/`null`), `desc`, `programs`, `notes`, `wiki`, `links` (`[{label, url}]`), `merits` (`{source, url, partial, areas:[{area, badges}]}`, or `null` when the camp publishes no list).

`null` always means "not confirmed" and renders as "?". Fit keys: `fresh`, `dh`, `pc`, `shoot`, `craft`, `nature`, `short` (drive of 2.5 hours or less).

### 8.1 Pocket map (`camps.geojson`)

`camps.geojson` is a point layer of the camps for the PocketMaps booklet generator (https://ajturner.github.io/pocketmaps/). It is generated from `camps-data.js`; regenerate it after changing camp data. Properties: `Name`, `Place`, `Drive`, `Meals`, `Youth`, `Weeks`, `Water`, `Badges`, `Council`, `Link` (camp registration page, used for each page's QR code), and `Summary` (one line used as the page description). The static file remains for direct use, but the pages no longer link to it: see 10.2.

---

## 9. Training Page (`training/`)

Files: `training/index.html` (markup; served at `/training/`), `training-data.js` (NCAC data and the merged exports), `training-nearby-data.js` (courses from nearby councils within about 3 hours, exported as `NEARBY_*` and merged in by `training-data.js`), `training.js` (behaviour); styles in the "TRAINING PAGE" section of `styles.css`. Each page's header links to the other two.

`training-data.js` exports:

| Export | Meaning |
|--------|---------|
| `DATA_AS_OF` | Date of the council calendar the data was taken from |
| `COUNCILS` | `{KEY: {name, short, url}}`; the council filter appears once there are two or more |
| `COURSES` | `{KEY: {name, full, aud, learn, desc}}`; `aud` is `youth`, `adult` or `both`; `learn` is the scouting.org page about the course |
| `VENUES` | `{key: {name, addr, lat, lng, mins}}`; `mins` is the estimated drive from Capitol Hill |
| `EVENTS` | One object per dated course (fields below). Only courses with a posted date are listed: a course a council names without a date is left out of the data, the page, the print and the pocket map |

Event fields: `id` (unique, sequential), `course` (a `COURSES` key), `council` (a `COUNCILS` key), `host` (district or "Council"), `venue` (a `VENUES` key, or `null` when the location is not posted), `sessions` (`[{s, e, label?}]` as `'YYYY-MM-DD'`; a course in two parts is one event with two sessions), `time`, `cost` (`null` = not listed), `url` (registration page, or `null`), `notes`, and optionally `title` (overrides the course name), `aud` (overrides the course's audience) and `virtual` (`true` when a session is online).

On screens wider than 900px the page is split: the map, filters and calendar sit in a left pane that stays in view and scrolls on its own (the map stays pinned at its top), and the results scroll on the right. On narrower screens they stack in one column, the calendar becomes a sideways-scrolling row, and the filters open as a bottom sheet from a "Filters" button. Every card and detail view links to the course's Scouting America page.

There is no date filter in the filter bar: clicking a calendar day or a month name narrows the list, and clicking a map marker sets the location filter (clicking it again, or clicking empty map, clears it). Shift-clicking markers or calendar days adds to the picks instead of replacing them, and a course matches if it is at any picked location and runs on any picked day. Hovering a marker shows the same hover card as a calendar day, listing that venue's matching courses. The map also carries the SDK's `Home` widget (back to the starting view) and `Search` widget (find a place or address). Every filter in effect, from the filter bar, the calendar or the map, shows as a removable chip above the course list, with a "Clear all filters" chip after them; changing any filter scrolls the results back to the top. Hovering or focusing a calendar day shows a hover card naming that day's courses, and hovering or focusing a result outlines its venue on the map and its dates on the calendar. Opening a course replaces the list in the results pane with its details (`openTraining(id)`, there is no modal overlay); while it is open the map shows only its venue and the calendar only its dates, and "Back to all results" or Escape returns to the list. Past courses are never listed. A course's details lead with a "What" box describing the training.

Accessibility (WCAG 2.2 AA) rules for this page: text colors are overridden under `.training-page` to reach 4.5:1 (`--bark`, `--tr-youth`, `--tr-adult`, calendar day numbers, links), and `AUD_COLOR` in `training.js` must match the `--tr-*` values; every control is a real `<button>`, `<select>` or `<a>` with a visible focus ring and a target of at least 24 by 24 CSS pixels; a card is not itself a control (its title is the button that opens it); toggle buttons carry `aria-pressed`; decorative emoji and arrows are `aria-hidden`; links that open a new tab say so in `.sr-only` text; the course count is a live region; focus moves to a course's heading when it opens and back to its card on return; the phone filter sheet is a modal dialog that traps Tab and closes on Escape; and the map's marker click has a keyboard equivalent in the Location filter.

A "both" course matches the Youth and the Adult filter. A course with no venue never matches a drive-time filter. The map has one marker per venue, sized by the number of matching courses; the calendar colours each day that has a matching course, and clicking a day narrows the cards and the map to that day.

Where a council calendar and a registration page disagree on a date, use the registration page and record the difference in the event's `notes`. Do not publish volunteers' personal email addresses; link to the council training page instead.

---

## 10. Shared Layout and Accessibility (`shared.js`, `body.app-page`)

The activity guide, the summer camp page and the training page share one layout, styled in the "SHARED APP LAYOUT" and training sections of `styles.css`:

- `.tr-split`: on screens wider than 900px, `aside.tr-left` (map pinned at its top, legend, filters, and on the camp page the patrol requests) stays in view and scrolls on its own beside `main.tr-right#results` (heading, live count, filter chips, cards). Narrower screens stack them and turn the `.filters` block into a bottom sheet opened by `#filterOpen`.
- `shared.js` (used by `app.js` and `camps.js`; `training.js` has its own copy of the same behaviour): `showTip` / `hideTip` / `bindDataTips` (hover card), `addMapControls` (Home and Search), `bindMarkers` (marker hover and click), `renderChips` (removable chip per filter plus "Clear all filters"), `syncButtons` (`aria-pressed` and the `on*` class), `resultsToTop`, `trapTab` (used by the filter sheet), and `initSheet`.
- Changing a filter re-renders, updates the chips and scrolls the results to the top. Hovering or focusing a card rings its marker on the map.

Accessibility target: WCAG 2.2 AA. The rules are listed in AGENTS.md ("The shared layout and accessibility rules"). Text colors that failed 4.5:1 are overridden under `.app-page` (`--bark`, link blue, week-status and season cells, photo captions). Printing hides `.tr-left` and the results heading, so both print modes look as before.

### 10.1 Shareable URLs

Each page keeps its filters and its open item in the query string, so any view can be bookmarked or shared. `setUrl()` in `shared.js` rewrites the address after every state change (`replaceState`; opening an item from the list uses `pushState`, so the browser's Back returns to the list). On load and on back/forward each page's `applyUrl()` reads the query string, ignoring any value it does not recognise. A "Copy link" button in the results heading and in the details heading copies the current address.

| Page | Parameters |
|------|------------|
| Activity guide (`/`) | `type`, `style` (`day`/`overnight`), `season` (`Sp`/`Su`/`Fa`/`Wi`), `baloo=yes`, `ha` (`yes`/`no`), `activity` (slug) |
| Summer camp (`/summer-camp/`) | `sort`, `meals`, `week` (`MM-DD`), `water=fresh`, `drive` (minutes), `badge` (text), `view=calendar`, `camp` (slug) |
| Training (`/training/`) | `for` (`youth`/`adult`), `course`, `loc` (venue keys, comma-separated), `council`, `drive` (minutes), `month` (`YYYY-MM`), `day` (`YYYY-MM-DD`, comma-separated), `training` (slug) |

An item is named in a link by a **slug** built from its own text, not by its id or position, so links survive items being added, removed or reordered. `assignSlugs()` in `shared.js` builds them at load: the activity title (`billy-goat-trail-great-falls`), the camp name (`camp-olmsted`), and for a course its council, course name, first date and title (`ncac-nylt-2027-06-20-nylt-courses-27-3-and-27-4`). Renaming an item changes its slug; to keep old links working through a rename, give the item an explicit `slug` field with the old value. Numeric ids are still accepted in links (`?camp=3`) for links shared before slugs, so avoid renumbering ids.

On the camp page, `view=calendar` shows the same filtered, sorted camps as the week-by-week table instead of the card grid (the Grid / Calendar switch in the results heading).

### 10.2 Print and pocket map tools

Every page has the same tool group at the right of the results heading (`.tr-tools`): **Copy link**, **Print** and **Pocket map**. The page header holds only links to the other pages. With an item open, the details heading has Copy link and Print.

- **Print** prints what the results pane shows: the filtered list (on the camp page, the grid or the calendar, whichever is selected), or the open item. A print-only heading at the top of the results (`.tr-print-head`) names the filters in effect (`#printFilters`, filled by `setPrintFilters()`) and carries a QR code for the page's current address (`#printQr`, drawn by `refreshPrintQr()` whenever the address changes), so a printed list leads back to the same filtered search and a printed item to that item. The QR library (`qrcode-generator` 1.4.4) is loaded on demand from jsDelivr; if it cannot load, the printout has no code. On the activity guide the list button is `#printIndexBtn` and the item button is `#printActivityBtn`, which prints the single-sheet layout with planning notes.
- **Pocket map** calls `openPocketMap()` in `shared.js` with the places the current filters show (title, a subtitle naming the filters, and `Name` / `Summary` / `Link` per place) and opens the PocketMaps generator in a new tab. The places are sent as GeoJSON in a `data:` URL inside the address. When that address would exceed about 7,000 characters (roughly 25 places), a `blob:` URL is used instead, which only works where the page shares PocketMaps' origin (the published site); elsewhere the visitor is asked to narrow the filters. Courses with no posted location are left out. The generator's own index QR is switched off (`indexqr=0`) because it would encode the whole data-carrying address; each place still gets a QR code for its `Link`.

