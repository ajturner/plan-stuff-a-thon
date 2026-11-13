# camping-idea-intake Specification

## Purpose

Collect activity suggestions from scouts and parents in a structure that matches the guide's own schema, so a submission can be reviewed and turned into a catalog entry without re-interviewing whoever proposed it.

## Requirements

### Requirement: One-time form provisioning

A script SHALL create the suggestion form and an empty response spreadsheet in a Workspace user's Drive, and SHALL be run once; thereafter the form is edited through the Google Forms interface.

#### Scenario: Initial setup

- **WHEN** the script is run with a service account key and a user to impersonate
- **THEN** the form and response spreadsheet are created in that user's Drive and their identifiers are reported

### Requirement: Questions mirror the catalog schema

The form SHALL collect the fields a catalog entry needs: submitter name and contact, activity title, description, official website, drive time, optional coordinates, activity details, estimated cost with detail, requirements, merit badge opportunities, and optional Wikipedia titles for photographs.

#### Scenario: Turning a submission into an entry

- **WHEN** the committee reviews a completed submission
- **THEN** every field the catalog schema requires is present or explicitly optional, so no follow-up interview is needed

### Requirement: Delegated access scoped to the tool

The script SHALL authenticate as a service account with domain-wide delegation impersonating a real Workspace user, requesting only the scopes needed to author the form, create the spreadsheet, and write the files it creates.

#### Scenario: Credentials are supplied, never committed

- **WHEN** the script runs
- **THEN** the service account key is passed by path at invocation, and no credential is stored in the repository

### Requirement: Documented manual follow-up

The script SHALL document the steps that must be completed by hand afterwards: linking the form's responses to the spreadsheet, adding review columns, and sharing the responder link.

#### Scenario: Completing setup

- **WHEN** the script finishes
- **THEN** the remaining manual steps are stated, since the response-to-sheet link cannot be established through the API
