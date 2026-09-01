# site-delivery Specification

## Purpose

Keep the guide a plain static site that any troop volunteer can edit and that publishes itself on push — no build step, no package manager, no toolchain to install before changing an activity's cost.

## Requirements

### Requirement: File separation

The application SHALL be split into `index.html` for markup, `styles.css` for all styling, `data.js` for the activity data, and `app.js` for all behaviour. Markup SHALL carry no inline styles or inline script blocks.

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

- **WHEN** a card or map popup rendered from a concatenated HTML string invokes the detail overlay
- **THEN** the call resolves, because the function was assigned to the window object at module scope

### Requirement: Automatic publication

Pushing to the default branch SHALL publish the site, excluding repository documentation and metadata from what is served.

#### Scenario: Merging a change

- **WHEN** a change lands on the default branch
- **THEN** the site is rebuilt and published to the pages branch without the version control, workflow, or documentation files
