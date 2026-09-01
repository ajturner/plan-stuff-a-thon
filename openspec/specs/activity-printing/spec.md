# activity-printing Specification

## Purpose

Support the Plan-Stuff-A-Thon as it actually runs — around tables with paper — by producing both a full catalog to browse and a per-activity worksheet that a chair can annotate and hand back.

## Requirements

### Requirement: Full index printing

The guide SHALL print the whole filtered catalog as a two-column card layout, omitting the interactive furniture: filter bar, legend, map, footer, overlay, and buttons.

#### Scenario: Printing the index

- **WHEN** the planner chooses to print the full index
- **THEN** any open overlay is closed and the cards print two per row without the map, filters, legend, or buttons

#### Scenario: Cards are not split

- **WHEN** a card would straddle a page boundary
- **THEN** it moves whole onto the next page

### Requirement: Single activity sheet

The guide SHALL print the open activity on its own as a planning sheet, suppressing the header, card grid, and legend, and titling the page as a Troop 380 activity planning sheet.

#### Scenario: Printing one activity

- **WHEN** the planner prints from within an open overlay
- **THEN** only that activity's panel prints, headed "Troop 380 · Activity Planning Sheet", with the gallery reduced to a single image and the navigation controls hidden

#### Scenario: Returning to the screen

- **WHEN** the print dialog closes
- **THEN** the single-activity print mode is cleared, so a subsequent index print is unaffected

### Requirement: Planning notes block

The single activity sheet SHALL include a notes block, visible only in print, with fields for proposed dates, activity chair, estimated scouts and adults, plus ruled space for scout preferences, logistics and transportation, and action items.

#### Scenario: Annotating at the planning event

- **WHEN** a chair prints an activity sheet
- **THEN** the sheet carries blank fields and ruled lines for capturing dates, headcounts, preferences, logistics, and action items by hand

#### Scenario: Notes hidden on screen

- **WHEN** the overlay is viewed on screen
- **THEN** the notes block is not shown

### Requirement: Colour fidelity in print

Distance stripes, badges, pills, and season dots SHALL retain their colours when printed, since colour carries the distance band and programme meaning.

#### Scenario: Printing on a colour printer

- **WHEN** the guide is printed
- **THEN** background colours are forced to print rather than being dropped by the browser's default background suppression
