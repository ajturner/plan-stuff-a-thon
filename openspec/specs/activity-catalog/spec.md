# activity-catalog Specification

## Purpose

Hold the troop's curated set of outdoor activities — from 45-minute day hikes near DC to fly-in high adventure expeditions — as one structured, reviewable dataset, so that cards, map markers, filters, and printed sheets are all generated from a single source rather than maintained separately.

## Requirements

### Requirement: Activity record schema

Every activity SHALL be an object in the exported `ACTS` array carrying: `id`, `lat`, `lng`, `dist`, `drive`, `style`, `types`, `seas`, `badges`, `labels`, `title`, `cost`, `costNote`, `desc`, `wiki`, `reqs`, `merits`, and `website`.

#### Scenario: Adding an activity

- **WHEN** a new activity is appended to `ACTS` with every schema field populated
- **THEN** its card, map marker, filter behaviour, detail overlay, and print sheet are all produced automatically with no further code changes

### Requirement: Unique identifiers

Each activity SHALL carry an `id` that is unique across the catalog, and new activities SHALL take the next value above the current maximum.

#### Scenario: Looking up an activity

- **WHEN** the interface requests an activity by `id`
- **THEN** exactly one record matches

### Requirement: Distance bands

`dist` SHALL be one of `near` (up to 2 hours), `mid` (2–3.5 hours), `far` (4–5 hours), or `xfar` (6+ hours or fly-in). The band SHALL drive the card stripe colour, the drive-time badge colour, and the map marker colour.

#### Scenario: Fly-in destination

- **WHEN** an activity requires air travel, such as Philmont or Sea Base
- **THEN** it is banded `xfar` and rendered in purple across the stripe, badge, and marker

### Requirement: Controlled vocabularies

`types` SHALL draw from `water`, `hiking`, `climbing`, `cave`, `bike`, `beach`, `history`, and `multi`. `seas` SHALL draw from `Sp`, `Su`, `Fa`, and `Wi`. `style` SHALL be either `day` or `overnight`. `badges` SHALL draw from `day`, `over`, `bike`, `beach`, `merit`, `bsa`, `baloo`, and `ha`.

#### Scenario: Introducing a new type value

- **WHEN** an activity uses a `types` value with no corresponding filter button
- **THEN** that value is unreachable from the interface, so a matching filter button must be added alongside it

### Requirement: Badges paired with labels

`badges[i]` SHALL select the colour class for the pill whose text is `labels[i]`. `labels` MAY be longer than `badges`; the surplus entries SHALL render as neutral grey pills.

#### Scenario: More labels than badges

- **WHEN** an activity declares three badges and five labels
- **THEN** the first three pills take their badge colours and the remaining two render grey

### Requirement: Verifiable location and photo references

`lat` and `lng` SHALL place the marker at the real destination, and every entry in `wiki` SHALL be an existing Wikipedia article title using underscores for spaces.

#### Scenario: Photo lookup for a title without a lead image

- **WHEN** a `wiki` title names a real article that has no representative image
- **THEN** the gallery falls back to a Wikimedia Commons search for that title rather than showing a broken image

### Requirement: Cost transparency

`cost` SHALL carry a short at-a-glance figure and `costNote` SHALL explain what the figure covers. Where a provider publishes pricing only behind a registration flow, the figure SHALL be marked as approximate and `costNote` SHALL name the contact for confirmation.

#### Scenario: Estimated price

- **WHEN** a high adventure base does not publish a public per-person rate
- **THEN** `cost` is prefixed with `~` and `costNote` names the council or camp contact to confirm with before the figure is relied on
