# Troop 380 · Adventure Activity Guide

A single-page web application for **Scouting America Troop 380** that helps scouts plan their annual activities at the Plan-Stuff-A-Thon. The guide presents 45 curated outdoor adventures — day trips and weekends within reach of Washington DC, BALOO-compliant Cub Scout camping sites, and high adventure bases from Goshen and the Adirondacks to Philmont, Northern Tier, Sea Base, and Alaska — with interactive filtering, an ArcGIS map, photo galleries, cost estimates, gear requirements, and merit badge opportunities.

---

## Live Demo

Open `troop380_activities.html` directly in any modern browser — no build step, no server required.

---

## Features

- **45 activities** ranging from 45-minute day trips to fly-in high adventure expeditions, including 12 BALOO-compliant Cub Scout sites and 16 high adventure programs (age 13/14+)
- **ArcGIS JS SDK 5** interactive map with color-coded distance markers and popup cards
- **Five-axis filtering** — by activity type, trip style (day/overnight), season, Cub Scout / BALOO compliance, and high adventure (show only / hide)
- **Map stays in sync with the filters** — markers for activities that no longer match are greyed out and shrunk rather than removed, so you keep the geographic context
- **Photo galleries** loaded live from the Wikipedia REST API (no API keys required)
- **Detail overlays** with cost breakdown, requirements checklist, and merit badge opportunities
- **Fully static** — one HTML file, zero dependencies to install, works offline except for map tiles, fonts, and photos

---

## Repository Structure

```
plan-stuff-a-thon/
├── index.html                 # Markup only — no inline CSS or JS
├── styles.css                 # All styling, including two print modes
├── data.js                    # The ACTS activity array (ES module export)
├── app.js                     # All application logic (ES module entry point)
├── README.md                  # This file
├── SPECIFICATIONS.md          # Data schema, vocabulary, and design system
├── AGENTS.md                  # Guardrails for AI coding agents
├── openspec/
│   ├── config.yaml            # Project context for spec tooling
│   └── specs/                 # Behaviour specs, one directory per capability
├── tools/
│   └── create_camping_form.py # Provisions the activity-suggestion Google Form
└── .github/
    ├── copilot-instructions.md
    └── workflows/
        └── deploy-gh-pages.yml
```

The application is split across four files and loads as native ES modules, so
it must be served over HTTP — opening `index.html` from the filesystem will not
work, because browsers block module imports over `file://`.

---

## Specifications

Behaviour is documented as [OpenSpec](https://github.com/Fission-AI/OpenSpec)
capability specs in `openspec/specs/`, written as requirements with concrete
scenarios:

| Capability | Covers |
|------------|--------|
| `activity-catalog` | The activity record schema, vocabularies, and data invariants |
| `activity-filtering` | The five filter groups and their combined semantics |
| `activity-map` | Map rendering, markers, popups, and filter dimming |
| `activity-detail-overlay` | The detail modal and how it opens and closes |
| `activity-photo-gallery` | Wikipedia and Commons photo sourcing and navigation |
| `activity-printing` | The full index and single-activity planning sheet |
| `site-delivery` | The no-build static architecture and publication |
| `camping-idea-intake` | The activity-suggestion Google Form tool |

```bash
openspec list --specs                  # list capabilities
openspec show activity-filtering       # read one
openspec validate --specs --strict     # check them
```

Read the specs to learn what the guide is meant to do; read `SPECIFICATIONS.md`
for how it is built.

---

## Getting Started

### View locally
```bash
# Just open the file — no server needed
open troop380_activities.html          # macOS
start troop380_activities.html         # Windows
xdg-open troop380_activities.html      # Linux
```

### Publish to GitHub Pages
1. Push the repository to GitHub
2. Go to **Settings → Pages → Source** and select `main` branch, root folder
3. The file will be live at `https://<org>.github.io/<repo>/troop380_activities.html`

### Publish to any static host
Copy `troop380_activities.html` to any static file host — Netlify, Vercel, S3, or a troop website. The file has no server-side requirements.

---

## Adding or Updating Activities

All activity data lives in the `ACTS` array near the top of the `<script type="module">` block in `troop380_activities.html`. Each object follows this schema:

```js
{
  id:       23,                          // unique integer, increment from last
  lat:      41.335,                      // decimal latitude
  lng:      -76.260,                     // decimal longitude
  dist:     'far',                       // 'near' ≤2hr | 'mid' 2–3.5hr | 'far' 4–5hr
  drive:    '3.5 hr',                    // human-readable drive time string
  style:    'day',                       // 'day' or 'overnight'
  types:    ['hiking'],                  // one or more from the types vocabulary
  seas:     ['Sp','Fa','Wi'],            // subset of ['Sp','Su','Fa','Wi']
  badges:   ['day','over'],              // drives badge colors; parallel with labels[]
  labels:   ['Day or overnight', '...'],// display text for each badge
  title:    'Ricketts Glen — ...',       // card title (Bebas Neue, shows large)
  cost:     '~$5–8/person',             // short cost string shown on card
  costNote: 'PA state park entry...',   // longer cost explanation in overlay
  desc:     'Two-sentence description.', // shown on card and overlay
  wiki:     ['Ricketts_Glen_State_Park', 'Sullivan_County,_Pennsylvania'],
                                         // Wikipedia article titles for gallery photos
  reqs:     ['Falls Trail: 7.2 miles', ...],  // requirement bullets in overlay
  merits:   ['Hiking', 'Environmental Science', 'Nature'],  // merit badge names
  website:  'https://...'               // official site link in overlay
}
```

**Type vocabulary:** `water` | `hiking` | `climbing` | `cave` | `bike` | `beach` | `history` | `multi`

**Badge vocabulary** (determines pill color in overlay):
| Key | Color | Use for |
|-----|-------|---------|
| `day` | blue | Day trips |
| `over` | purple | Overnight / multi-day |
| `bike` | amber | Biking-specific |
| `beach` | teal | Beach activities |
| `merit` | pink | Merit badge programs |
| `bsa` | orange | Official BSA camps |
| `baloo` | gold | BALOO-compliant for Cub Scout pack/den outings |
| `ha` | purple | High adventure trek or base (age 13/14+); toggled by the High adventure filter |

---

## Photo System

Photos are fetched at runtime from the [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) using the article titles in each activity's `wiki` array. The API is free, requires no key, and is open to browser CORS requests.

- Up to 3 photos are fetched per activity (one per `wiki` title)
- If the Wikipedia article has no lead image, that title is skipped silently
- If offline or all fetches fail, a graceful "Photos load when connected" placeholder is shown
- Photos are displayed at 800px wide (upscaled from Wikipedia's thumbnail URL)

To improve photos for an activity, add better Wikipedia article titles to its `wiki` array. Articles with rich lead images (national parks, landmarks, etc.) work best.

---

## External Dependencies

All dependencies are loaded from CDN at runtime. The page degrades gracefully when offline.

| Dependency | URL | Purpose |
|-----------|-----|---------|
| ArcGIS JS SDK 5 CSS | `js.arcgis.com/5.0/esri/themes/light/main.css` | Map widget styles |
| ArcGIS JS SDK 5 modules | `js.arcgis.com/5.0/@arcgis/core/` | Interactive map |
| Bebas Neue | `fonts.googleapis.com` | Display / heading font |
| DM Sans | `fonts.googleapis.com` | Body text font |
| DM Mono | `fonts.googleapis.com` | Labels, badges, monospace |
| Wikipedia REST API | `en.wikipedia.org/api/rest_v1/` | Gallery photos (runtime) |

---

## Browser Support

Requires a browser with ES module support and `fetch`. All modern browsers (Chrome 61+, Firefox 60+, Safari 11+, Edge 16+) are supported. Internet Explorer is not supported.

---

## Troop Information

- **Troop:** 380, Scouting America
- **Activity radius:** 45 min – 2 hr standard; up to 5 hr for exceptional destinations
- **Scout age range:** 10–17
- **Planning event:** Annual Plan-Stuff-A-Thon

---

## Contributing

1. Fork the repository
2. Make your change in the relevant file — `data.js` for activities, `app.js`
   for behaviour, `styles.css` for appearance, `index.html` for markup
3. Serve the directory over HTTP (`python3 -m http.server 8080`) and check it in
   a browser — the console should be clean, cards and markers should render, and
   every filter combination should behave
4. If you changed what the guide *does*, update the matching spec in
   `openspec/specs/` and run `openspec validate --specs --strict`
5. Open a pull request describing what changed and why

See `SPECIFICATIONS.md` for the data schema and design system, `openspec/specs/`
for the behavioural contract, and `AGENTS.md` for guidance on using AI assistants
to make changes.
