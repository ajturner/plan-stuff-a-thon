# activity-detail-overlay Specification

## Purpose

Give a planner everything needed to decide on and organise one trip — photos, cost breakdown, requirements, and merit badge opportunities — without leaving the guide or hunting across council and park websites.

## Requirements

### Requirement: Opening the overlay

The overlay SHALL open from a card click, from a card's details button, from keyboard activation of a card's title, and from a click on the activity's map marker. The details SHALL replace the list in the results pane rather than cover the page, so the map stays in view with only that activity's marker lit. Opening SHALL move focus to the title; a "Back to all results" control or Escape SHALL restore the list at its previous scroll position and return focus to the control that opened the details.

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

### Requirement: Returning to the results

The details SHALL close via the "Back to all results" control, the Escape key, or a change of filter, and the list SHALL return each time.

#### Scenario: Back control

- **WHEN** the details are open and the planner clicks "Back to all results"
- **THEN** the list returns at its previous scroll position and the map returns to its starting view

#### Scenario: Escape key

- **WHEN** the details are open and the planner presses Escape
- **THEN** the list returns

#### Scenario: Changing a filter

- **WHEN** the details are open and the planner changes a filter
- **THEN** the list returns, filtered, at its top

