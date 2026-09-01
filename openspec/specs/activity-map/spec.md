# activity-map Specification

## Purpose

Show every activity in its real geographic position so planners can weigh travel against interest — seeing at a glance that three caving options cluster in the Shenandoah Valley, or that a chosen filter leaves nothing within a two-hour drive.

## Requirements

### Requirement: Map rendering

The map SHALL render through the ArcGIS Maps SDK 5, loaded as ES module imports from the ArcGIS CDN, using a topographic basemap centred on the Washington DC region.

#### Scenario: Page load

- **WHEN** the page is served over HTTP and loads
- **THEN** the basemap renders into the map container with no console errors

#### Scenario: Opened from the filesystem

- **WHEN** the page is opened over `file://`
- **THEN** the browser blocks the ES module imports and the map does not render, so the site must be served over HTTP

### Requirement: One marker per activity

Every activity in the catalog SHALL be drawn as a point marker at its coordinates, coloured by its distance band.

#### Scenario: Marker colour follows the distance band

- **WHEN** an activity is banded `near`, `mid`, `far`, or `xfar`
- **THEN** its marker is drawn green, orange, red, or purple respectively

### Requirement: Marker popups

Clicking a marker SHALL open a popup summarising the activity: its title, drive time, trip style, and cost.

#### Scenario: Inspecting a marker

- **WHEN** the planner clicks a marker
- **THEN** a popup shows that activity's title, drive time from DC, whether it is a day trip or overnight, and its cost

### Requirement: Opening details from the map

A planner SHALL be able to reach an activity's full detail overlay from its map popup.

#### Scenario: Opening details from the map

- **WHEN** the planner activates the details affordance in a marker popup
- **THEN** the detail overlay for that activity opens

> **Known deviation — this requirement is not currently met.** The popup content
> is supplied to the SDK as an HTML string, and ArcGIS Maps SDK 5 sanitises that
> string: it strips the `<button>` element and its `onclick` handler, leaving the
> words "View details" as an inert text node. Clicking it does nothing. Verified
> in Chrome — the rendered popup DOM contains no `button` element. Satisfying
> this requirement needs the popup content supplied as a function returning a
> real DOM node with a listener attached, rather than as a string. Card clicks
> are unaffected and remain the working route into the overlay.

### Requirement: Filtered markers are dimmed, not removed

When filters exclude an activity, its marker SHALL be redrawn smaller and grey rather than removed from the map, preserving the geographic context of what was filtered away.

#### Scenario: Narrowing the filters

- **WHEN** a filter change excludes an activity that was previously matching
- **THEN** its marker is redrawn grey at reduced size while matching markers keep their distance-band colour at full size

#### Scenario: Widening the filters

- **WHEN** a filter change re-admits a previously excluded activity
- **THEN** its marker returns to full size in its distance-band colour

#### Scenario: Dimmed markers stay interactive

- **WHEN** the planner clicks a dimmed marker
- **THEN** its popup still opens, so a filtered-out option can still be inspected

### Requirement: Legend

A legend SHALL explain the distance-band colours, the trip style and programme pills, and the meaning of a dimmed marker.

#### Scenario: Interpreting a grey marker

- **WHEN** a planner sees grey markers after applying a filter
- **THEN** the legend identifies them as filtered out on the map
