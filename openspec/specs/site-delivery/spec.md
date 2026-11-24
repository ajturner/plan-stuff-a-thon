# site-delivery Specification

## Purpose

Keep the guide a plain static site that any troop volunteer can edit and that publishes itself on push — no build step, no package manager, no toolchain to install before changing an activity's cost.

## Requirements

### Requirement: File separation

The application SHALL be split into `index.html` for markup, `styles.css` for all styling, `data.js` for the activity data, and `app.js` for all behaviour. The summer camp page follows the same split: `summer-camp/index.html` (served at `/summer-camp/`), `camps-data.js`, and `camps.js`, sharing `styles.css`. The training page does too: `training/index.html` (served at `/training/`), `training-data.js`, `training-nearby-data.js`, and `training.js`. Markup SHALL carry no inline styles or inline script blocks.

#### Scenario: Adding a style

- **WHEN** a visual change is needed
- **THEN** it is made in `styles.css` rather than as an inline style attribute or a `<style>` block

### Requirement: ES module delivery without a build step

The application SHALL load as native ES modules, with `app.js` as the single module entry point importing the activity data and the ArcGIS SDK directly from the CDN. There SHALL be no bundler, transpiler, package manifest, or installed dependency.

#### Scenario: Editing the guide

- **WHEN** a volunteer edits an activity and serves the directory over HTTP
- **THEN** the change is live with no install or build command

#### Scenario: Module loader constraints

- **WHEN** code is added to the application
- **THEN** it uses ES module `import` syntax, never AMD `require()`, and the entry script tag keeps its module type

### Requirement: Module-scope functions reachable from generated markup

Because module scope is not the global scope, any function invoked from a generated HTML attribute SHALL be explicitly exposed on the window object after it is defined, and generated markup SHALL call it through that explicit reference.

#### Scenario: Opening details from generated markup

- **WHEN** a card rendered from a concatenated HTML string, or a map marker click, invokes the detail overlay
- **THEN** the call resolves, because the function was assigned to the window object at module scope

### Requirement: Automatic publication

Pushing to the default branch SHALL publish the site, excluding repository documentation and metadata from what is served.

#### Scenario: Merging a change

- **WHEN** a change lands on the default branch
- **THEN** the site is rebuilt and published to the pages branch without the version control, workflow, or documentation files

### Requirement: Shared layout and accessibility

The activity guide, the summer camp page and the training page SHALL share one layout: on wide screens a facets pane (map, legend, filters) that stays in view beside the results, and on narrow screens a single column with the filters in a bottom sheet. Every filter in effect SHALL show as a removable chip above the results with a control that clears them all. The pages SHALL meet WCAG 2.2 level AA: text contrast of at least 4.5:1, every control operable by keyboard with a visible focus indicator and a target of at least 24 by 24 CSS pixels, state never conveyed by colour alone, and no horizontal scrolling at 320 CSS pixels wide.

#### Scenario: Filtering on a phone

- **WHEN** a visitor on a narrow screen taps "Filters"
- **THEN** the filters slide up as a sheet, and "Done", the backdrop or Escape closes it

#### Scenario: Clearing filters

- **WHEN** the visitor has set two filters and chooses "Clear all filters"
- **THEN** every result is listed again and the filter buttons show their defaults

### Requirement: Shareable URLs

Every activity, camp and training course SHALL have a durable URL that opens that item when visited, and every combination of filters SHALL have a durable URL that restores it. The address SHALL update as the visitor filters or opens an item, the browser's Back SHALL return from an item to the list, and each page SHALL offer a control that copies the current link. An item's URL SHALL identify it by a name derived from its own content, not by its id or position, so that the URL keeps working when items are added, removed or reordered; an item MAY carry an explicit slug to keep its URL through a rename.

#### Scenario: Sharing an item

- **WHEN** a visitor opens the link `…/summer-camp/?camp=camp-olmsted`
- **THEN** the camp page loads with Camp Olmsted's details open

#### Scenario: Data reordered after sharing

- **WHEN** camps are added or reordered and a visitor later opens that same link
- **THEN** Camp Olmsted's details still open

#### Scenario: Sharing a filtered search

- **WHEN** a visitor opens the link `…/summer-camp/?meals=dh&week=07-04`
- **THEN** the camp page loads listing only dining-hall camps offered the week of July 4, with those filters shown as chips

#### Scenario: Unknown values

- **WHEN** a link carries a filter value or id the page does not recognise
- **THEN** that value is ignored and the rest of the link still applies

### Requirement: Print and pocket map tools

Each page SHALL offer Print and Pocket map controls in the same place, beside the results heading and apart from the links between pages. Both SHALL act on what the current filters show: Print SHALL print the filtered results (or the open item), name the filters in effect, and include a QR code that opens the same view online: the filtered search for a list, the item for an item. Pocket map SHALL open the booklet generator with only the filtered places that have a location, with the filters shown as its subtitle.

#### Scenario: Pocket map of a filtered list

- **WHEN** the visitor filters the camps to dining-hall camps and chooses "Pocket map"
- **THEN** the booklet generator opens in a new tab holding only those camps, with the filters as its subtitle

#### Scenario: Scanning a printed list

- **WHEN** the visitor prints the camps filtered to dining-hall camps and scans the QR code on the printout
- **THEN** the camp page opens with that filter applied

#### Scenario: Scanning a printed item

- **WHEN** the visitor prints one activity's sheet and scans its QR code
- **THEN** the activity guide opens with that activity's details showing

#### Scenario: Nothing to map

- **WHEN** no result with a location matches the filters and the visitor chooses "Pocket map"
- **THEN** the visitor is told there is nothing to map and no tab opens

