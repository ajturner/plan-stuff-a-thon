# activity-detail-overlay Specification

## Purpose

Give a planner everything needed to decide on and organise one trip — photos, cost breakdown, requirements, and merit badge opportunities — without leaving the guide or hunting across council and park websites.

## Requirements

### Requirement: Opening the overlay

The overlay SHALL open from a card click, from a card's details button, from keyboard activation of a focused card, and from a marker popup's "View details" button on the map.

#### Scenario: Clicking a card

- **WHEN** the planner clicks anywhere on an activity card
- **THEN** the overlay opens populated with that activity

#### Scenario: Keyboard activation

- **WHEN** a card has keyboard focus and the planner presses Enter or Space
- **THEN** the overlay opens for that activity

### Requirement: Overlay content

The overlay SHALL show the activity title, a photo gallery, meta pills, the description, cost with its explanatory note, the requirements list, merit badge chips, and a link to the official website.

#### Scenario: Meta pills

- **WHEN** an activity is opened
- **THEN** pills show its drive time and trip style, plus "Merit badge eligible", "BSA camp", "Cub Scout / BALOO", and "High adventure (13/14+)" for each corresponding badge it carries

#### Scenario: Activity without merit badges

- **WHEN** an activity declares no merit badges
- **THEN** the merit badge section is omitted rather than rendered empty

#### Scenario: Activity without a website

- **WHEN** an activity has no `website` value
- **THEN** the official website link is omitted

### Requirement: Closing the overlay

The overlay SHALL close via its close button, a click on the backdrop outside the panel, and the Escape key, restoring page scrolling each time.

#### Scenario: Escape key

- **WHEN** the overlay is open and the planner presses Escape
- **THEN** the overlay closes and the page scrolls normally again

#### Scenario: Backdrop click

- **WHEN** the planner clicks the dimmed area outside the panel
- **THEN** the overlay closes

#### Scenario: Click inside the panel

- **WHEN** the planner clicks content inside the panel
- **THEN** the overlay stays open

### Requirement: Scroll locking

While the overlay is open, background page scrolling SHALL be suppressed so the panel reads as a modal.

#### Scenario: Scrolling behind the overlay

- **WHEN** the overlay is open and the planner scrolls
- **THEN** the page behind the overlay does not move
