# Troop 380 · Adventure Activity Guide

A single-page web application for **Scouting America Troop 380** that helps scouts plan their annual activities at the Plan-Stuff-A-Thon. The guide presents 23 curated outdoor adventures within reach of Washington DC, with interactive filtering, an ArcGIS map, photo galleries, cost estimates, gear requirements, and merit badge opportunities.

---

## Live Demo

Open `troop380_activities.html` directly in any modern browser — no build step, no server required.

---

## Features

- **23 activities** ranging from 45-minute day trips to 5-hour exceptional adventures
- **ArcGIS JS SDK 5** interactive map with color-coded distance markers and popup cards
- **Three-axis filtering** — by activity type, trip style (day/overnight), and season
- **Photo galleries** loaded live from the Wikipedia REST API (no API keys required)
- **Detail overlays** with cost breakdown, requirements checklist, and merit badge opportunities
- **Fully static** — one HTML file, zero dependencies to install, works offline except for map tiles, fonts, and photos

---

## Repository Structure

```
troop380-activities/
├── troop380_activities.html   # The entire application (single file)
├── README.md                  # This file
├── SPECIFICATIONS.md          # Detailed technical and content specifications
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot workspace instructions
└── AGENTS.md                  # Guidance for AI coding agents (Copilot, Claude, etc.)
```

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
2. Edit `troop380_activities.html` — all content and logic is in this single file
3. Test by opening the file locally in a browser
4. Open a pull request with a description of what changed and why

See `SPECIFICATIONS.md` for detailed content and technical requirements, and `AGENTS.md` for guidance on using AI assistants to make changes.
