# activity-filtering Specification

## Purpose

Let a troop narrow the activity catalog to the trips that fit a given outing — by activity type, trip length, season, Cub Scout readiness, and high adventure status — so planners can answer "what can we do in February with Webelos?" without reading every card.

## Requirements

### Requirement: Filter groups

The filter bar SHALL expose five independent filter groups: Type, Style, Season, Cub Scout, and High adventure. Each group SHALL be single-select, with exactly one active button at a time, indicated by a group-specific active class (`on`, `on-t`, `on-s`, `on-b`, `on-h`).

#### Scenario: Selecting a value within a group

- **WHEN** the planner clicks a filter button
- **THEN** every other button in that group loses its active class, the clicked button gains its group's active class, and the catalog re-renders

#### Scenario: Groups are independent

- **WHEN** the planner selects a value in one group
- **THEN** the active selections in the other four groups are preserved

### Requirement: Combined filter semantics

An activity SHALL be shown only when it satisfies every filter group simultaneously (logical AND). A group set to `all` SHALL impose no constraint.

#### Scenario: Default state shows everything

- **WHEN** the page first loads with all five groups set to `all`
- **THEN** every activity in the catalog is rendered

#### Scenario: Two groups combined

- **WHEN** Type is `cave` and Season is `Wi`
- **THEN** only activities whose `types` include `cave` **and** whose `seas` include `Wi` are shown

### Requirement: High adventure filter

The High adventure group SHALL offer three values — `all`, `yes`, and `no` — keyed on the presence of the `ha` badge, so planners can either focus on high adventure or remove it from view.

#### Scenario: Show only high adventure

- **WHEN** High adventure is set to `yes`
- **THEN** only activities whose `badges` include `ha` are shown

#### Scenario: Hide high adventure

- **WHEN** High adventure is set to `no`
- **THEN** only activities whose `badges` do not include `ha` are shown

#### Scenario: Partition is exhaustive

- **WHEN** the counts for `yes` and `no` are added together with all other groups set to `all`
- **THEN** the sum equals the total number of activities in the catalog

### Requirement: Single filter predicate

A single predicate SHALL decide whether an activity matches the current filter state, and both the card grid and the map SHALL consult that same predicate, so the two views can never disagree.

#### Scenario: Map and grid agree

- **WHEN** any filter changes
- **THEN** the set of activities rendered as cards is exactly the set of activities drawn as active markers on the map

### Requirement: Result count

A count badge SHALL report the number of matching activities, pluralised as "activity" for one result and "activities" otherwise.

#### Scenario: Count reflects the filters

- **WHEN** the filters match 16 activities
- **THEN** the badge reads "16 activities"

#### Scenario: Single result

- **WHEN** the filters match exactly one activity
- **THEN** the badge reads "1 activity"

### Requirement: Empty result state

When no activity matches, the grid SHALL show a message inviting the planner to broaden the filters rather than rendering an empty page.

#### Scenario: No matches

- **WHEN** a filter combination matches no activities
- **THEN** the grid shows "No activities match — try broadening your filters." and no cards
