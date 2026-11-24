# training-calendar Specification

## Purpose

Help Troop 380 Scouts and leaders find youth and adult training courses they can reach from DC, across the troop's own council and nearby councils, and see when and where each one runs.

## Requirements

### Requirement: Separate training page

The calendar SHALL live on its own page at the path `/training/` (`training/index.html`), backed by `training-data.js` and `training-nearby-data.js` (data) and `training.js` (behaviour), and SHALL share `styles.css` with the activity guide. The page SHALL link back to the activity guide.

#### Scenario: Opening the page

- **WHEN** a visitor opens `/training/`
- **THEN** a map, a calendar and a card for every upcoming course are shown with no console errors

### Requirement: Course data

Each dated course SHALL record its course type, audience (youth, adult or both), council, host, sessions, venue, cost, registration link and notes. A course held in several parts SHALL be one entry with several sessions. Anything a source does not state SHALL be recorded as not posted, never guessed. Where a council calendar and a registration page disagree on a date, the registration page date SHALL be shown and the difference noted on the course.

#### Scenario: A course with no posted location

- **WHEN** a council lists a course date without a location
- **THEN** the course shows "Location not posted", has no map marker, and never matches a drive-time filter

### Requirement: Filters

The visitor SHALL be able to filter upcoming courses by audience, course type, location, council, and maximum drive time from Capitol Hill. A course for both audiences SHALL match the youth filter and the adult filter. One predicate SHALL drive the course list and the map. On narrow screens the filters SHALL open as a bottom sheet.

#### Scenario: Filtering for youth

- **WHEN** the visitor chooses "Youth"
- **THEN** only youth courses and courses open to both remain, and venues with no matching course grey out on the map

#### Scenario: Filtering on a phone

- **WHEN** the visitor taps "Filters" on a narrow screen
- **THEN** the filters slide up as a sheet, and "Done", the backdrop or Escape closes it

### Requirement: Calendar

The page SHALL show a month grid for every month from now to the last course, colouring each day that has a course matching the filters and showing a count when a day has more than one. Choosing a day or a month name SHALL narrow the course list and the map to it, and the choice SHALL be clearable. The calendar is the only date filter.

#### Scenario: Choosing a day

- **WHEN** the visitor clicks a coloured day
- **THEN** only courses running that day are listed, the day is outlined, and a removable chip names the day

### Requirement: Map

The map SHALL stay pinned at the top of the facets pane and show one marker per venue, sized by the number of matching courses and coloured by audience, plus a marker for Capitol Hill. Clicking a venue marker SHALL filter the course list to that venue; clicking it again SHALL clear the filter.

#### Scenario: Filtering from the map

- **WHEN** the visitor clicks a venue marker
- **THEN** only that venue's courses are listed, the marker is outlined, and a removable chip names the venue

### Requirement: Course details

Opening a course SHALL replace the course list in the results pane with its details: audience, host, council, every session with day of week, times, cost, venue address with drive time and a map link, the registration link (or the council training page when none is posted), and its notes. While a course is open the map SHALL show only its venue and the calendar only its dates. A back control SHALL return to the full results.

#### Scenario: Returning to the results

- **WHEN** the visitor clicks "Back to all results" or presses Escape
- **THEN** the course list returns at its previous scroll position with the earlier filters intact

### Requirement: Side-by-side layout

On wide screens the map, filters and calendar SHALL sit in a left pane that stays in view while the course results scroll on the right. On narrow screens they SHALL stack in one column.

#### Scenario: Scrolling the results

- **WHEN** the visitor scrolls down the course list on a wide screen
- **THEN** the map, filters and calendar remain visible beside it

### Requirement: Learn more link

Each course SHALL link to the Scouting America page about that kind of training, from its card and from its details.

#### Scenario: Learning about a course

- **WHEN** the visitor follows a course's "About … at Scouting America" link
- **THEN** the Scouting America page opens in a new tab and the course details do not open

### Requirement: Courses without dates

Courses that appear on a council calendar without an upcoming date SHALL be listed separately, following the audience and council filters.

#### Scenario: Viewing undated courses

- **WHEN** the visitor scrolls past the cards
- **THEN** the undated courses are listed with any note or link the council gave
