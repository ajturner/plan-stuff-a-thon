# summer-camp-comparison Specification

## Purpose

Help the troop pick one summer camp and one week that most Scouts can attend, by comparing Scouts BSA resident camps within about five hours of DC against what each patrol asked for and against the weeks families said they can go.

## Requirements

### Requirement: Separate camp page

The comparison SHALL live on its own page, `camps.html`, backed by `camps-data.js` (data) and `camps.js` (behaviour), and SHALL share `styles.css` with the activity guide. Each page SHALL link to the other.

#### Scenario: Moving between pages

- **WHEN** a planner is on the activity guide
- **THEN** a header link opens the summer camp page, and the summer camp page links back

### Requirement: Patrol preferences and fit score

The page SHALL list each patrol's requests. Each request that maps to a camp feature SHALL be scored, and each camp's fit score SHALL be the number of scored requests it meets. Requests no camp field can check SHALL be shown as not scored.

#### Scenario: Unconfirmed camp details

- **WHEN** a camp feature is `null` in the data (not confirmed)
- **THEN** the request is shown as "?" for that camp and adds nothing to its score

### Requirement: Sort and filter

The planner SHALL be able to sort camps by patrol fit, drive time, youth cost (camps with no posted fee last), number of weeks offered, or name, and filter by meal method (including camps that offer both), week offered (including either survey week), fresh water, and maximum drive time. One predicate SHALL drive the cards, the week table, and the map.

#### Scenario: Filtering by meal method

- **WHEN** the planner chooses "Both at one camp"
- **THEN** only camps offering both dining hall and patrol cooking remain, and the other markers grey out on the map

### Requirement: Week availability

Each camp SHALL show its 2027 weeks with a status of open, almost full, full, or offered (status not published), and the weeks named in the parent survey SHALL be highlighted. A week-by-week table SHALL show the same camps in the same order.

#### Scenario: Comparing weeks

- **WHEN** the planner scrolls to the week table
- **THEN** each row is a camp, each column a Sunday start date, and clicking a row opens that camp's details

### Requirement: Camp details

Opening a camp SHALL show photos (sourced as in activity-photo-gallery), location, meal methods, waterfront, weeks, youth and adult cost with notes, activities, booking notes, links to the camp's own registration pages, and the per-patrol fit breakdown.

#### Scenario: Opening from the map

- **WHEN** the planner clicks a camp marker and then "View details"
- **THEN** the details panel opens for that camp
