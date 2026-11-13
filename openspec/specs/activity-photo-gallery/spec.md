# activity-photo-gallery Specification

## Purpose

Show scouts what a destination actually looks like, sourced from Wikipedia and Wikimedia Commons, so the guide carries real photography without the troop hosting, licensing, or maintaining an image library.

## Requirements

### Requirement: Photo sourcing

The gallery SHALL fetch up to three photographs for an activity by querying the Wikipedia API for each of its `wiki` titles in order, and SHALL fall back to a Wikimedia Commons file search for any title with no representative page image.

#### Scenario: Title with a lead image

- **WHEN** a `wiki` title names an article with a representative image
- **THEN** that image is used

#### Scenario: Title without a lead image

- **WHEN** a `wiki` title names a real article that has no representative image
- **THEN** a Wikimedia Commons search supplies images for that title instead

#### Scenario: Unusable file types

- **WHEN** a Commons search returns SVG diagrams, animations, or icons
- **THEN** those results are skipped in favour of photographs

### Requirement: Loading and empty states

The gallery SHALL show a spinner while fetching, and SHALL show an explanatory message when no photograph could be retrieved.

#### Scenario: Fetch in progress

- **WHEN** the overlay opens
- **THEN** a spinner and "Loading photos…" appear until the photographs resolve

#### Scenario: Offline

- **WHEN** no photographs can be fetched because there is no network
- **THEN** the gallery shows a message explaining that photos load when connected to the internet, and the rest of the overlay remains fully usable

#### Scenario: Individual image fails to load

- **WHEN** a fetched image URL fails to render
- **THEN** that image is hidden rather than showing a broken-image icon

### Requirement: Gallery navigation

When more than one photograph is available, the gallery SHALL offer previous and next controls plus one dot per photograph, and SHALL wrap around at both ends. A caption SHALL name the source article or file.

#### Scenario: Advancing past the last photo

- **WHEN** the planner clicks next on the final photograph
- **THEN** the gallery wraps to the first photograph

#### Scenario: Jumping to a photo

- **WHEN** the planner clicks a dot
- **THEN** the corresponding photograph is shown and that dot becomes the active one

### Requirement: Gallery reset between activities

Opening an activity SHALL clear the previously loaded photographs, dots, and caption before loading its own.

#### Scenario: Opening a second activity

- **WHEN** the planner closes one activity and opens another
- **THEN** the gallery shows only the second activity's photographs
