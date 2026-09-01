#!/usr/bin/env python3
"""Bootstrap the Troop 380 'Suggest a Camping Idea' Google Form + response Sheet.

Run ONCE to create the form and an empty destination spreadsheet under the
chosen Workspace user's Drive. After that, leaders edit the live form via the
Google Forms UI; this script does not have to run again.

Auth: a Google Cloud service account with domain-wide delegation, impersonating
a real Workspace user (the form / sheet will live in that user's Drive).

Setup checklist (Workspace admin, one time):
  1. In Google Cloud Console, create a project for the troop.
  2. Enable: Google Forms API, Google Sheets API, Google Drive API.
  3. Create a service account, download its JSON key.
  4. Edit the service account → enable "domain-wide delegation".
  5. In Google Workspace Admin Console → Security → API controls →
     Domain-wide delegation, authorize the service account's client ID for
     these scopes (comma-separated):
        https://www.googleapis.com/auth/forms.body,
        https://www.googleapis.com/auth/drive.file,
        https://www.googleapis.com/auth/spreadsheets

Usage:
    pip install google-api-python-client google-auth
    python tools/create_camping_form.py \\
        --service-account ./service-account.json \\
        --impersonate activities@troop380.org

After the script finishes, the impersonated user does these one-time steps in
the Google Forms UI:
  1. Open the form → Responses tab → Link to Sheets → "Select existing
     spreadsheet" → pick the sheet this script just created.
  2. In the sheet, add columns: "Status" (default "Pending") and
     "Reviewer Notes". Create a filter view named "Approved".
  3. Share the form's responder link with the troop.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = [
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
]

FORM_TITLE = "Troop 380 — Suggest a Camping Idea"
FORM_DOC_TITLE = "Troop 380 Camping Idea Submissions"
SHEET_TITLE = "Troop 380 Camping Idea Submissions (Responses)"

FORM_DESCRIPTION = (
    "Share an outdoor adventure you'd like the troop to consider for the "
    "Plan-Stuff-A-Thon. The Activity Committee reviews submissions before "
    "they appear on the troop's Adventure Activity Guide. "
    "If you don't know an answer, leave it blank — a leader will fill it in "
    "during review."
)

# Ordered list of form items. Each item is one of:
#   {"section": title, "description": ...}
#   {"short": label, "help": ..., "required": bool}
#   {"paragraph": label, "help": ..., "required": bool}
#   {"radio": label, "help": ..., "options": [...], "required": bool}
#   {"checkbox": label, "help": ..., "options": [...], "required": bool}
# Edit here, re-run, get a fresh form. Keep field labels stable so the
# spreadsheet column headers don't drift.
QUESTIONS: list[dict[str, Any]] = [
    {"section": "About you",
     "description": "So a leader can follow up if we have questions."},
    {"short": "Your name", "required": True},
    {"short": "Your email", "required": True,
     "help": "We'll only use this to follow up about your idea."},
    {"short": "Your scout's name and patrol/den (optional)", "required": False},

    {"section": "The activity",
     "description": "What's the adventure?"},
    {"short": "Activity name / title", "required": True,
     "help": "e.g. 'Calvert Cliffs — fossil hunt day hike'"},
    {"paragraph": "Short description", "required": True,
     "help": "2–3 sentences. What is it, why is it cool for scouts?"},
    {"short": "Official website (optional)", "required": False,
     "help": "Park or outfitter URL if you have one."},

    {"section": "Where & how long",
     "description": "Drive time and trip length help us match it to the right calendar slot."},
    {"radio": "How far from DC?", "required": True,
     "options": ["Near (≤ 2 hr)", "Mid (2–3.5 hr)", "Far (4–5 hr)"]},
    {"short": "Approximate drive time", "required": True,
     "help": "e.g. '1.5 hr'"},
    {"radio": "Trip style", "required": True,
     "options": ["Day trip", "Overnight"]},
    {"short": "Latitude (optional)", "required": False,
     "help": "Decimal degrees. Leave blank if you're not sure — a leader will look it up."},
    {"short": "Longitude (optional)", "required": False,
     "help": "Decimal degrees."},

    {"section": "Activity details",
     "description": "Pick everything that applies."},
    {"checkbox": "Activity types", "required": True,
     "options": ["Water / paddling", "Hiking", "Climbing", "Caving",
                 "Biking", "Beach", "History / heritage", "Multi-activity"]},
    {"checkbox": "Best seasons", "required": True,
     "options": ["Spring", "Summer", "Fall", "Winter"]},
    {"radio": "Cub Scout / BALOO friendly?", "required": True,
     "help": "BALOO = Cub Scout pack overnight standards.",
     "options": ["Yes", "No", "Not sure"]},

    {"section": "Cost & logistics",
     "description": "Rough numbers are fine — leaders verify before publishing."},
    {"short": "Estimated cost per person", "required": False,
     "help": "e.g. '~$15/person' or 'Free'"},
    {"paragraph": "Cost details (optional)", "required": False,
     "help": "Park entry, group rate, equipment rental, etc."},
    {"paragraph": "Requirements / what to bring", "required": False,
     "help": "One per line. Permits, gear, age limits, reservations…"},
    {"paragraph": "Merit badge opportunities (optional)", "required": False,
     "help": "Comma-separated. e.g. 'Hiking, Camping, Environmental Science'"},
    {"paragraph": "Wikipedia article titles for photos (optional)", "required": False,
     "help": "One per line. Used by the website to pull a photo gallery. e.g. 'Calvert_Cliffs_State_Park'"},

    {"section": "Anything else?", "description": ""},
    {"paragraph": "Notes for the Activity Committee (optional)",
     "required": False,
     "help": "Personal experience, contacts, why this would be great for the troop."},
]


def build_create_item_requests(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Translate the QUESTIONS list into Forms API batchUpdate requests."""
    requests = []
    for index, q in enumerate(questions):
        item: dict[str, Any] = {}
        if "section" in q:
            item["title"] = q["section"]
            if q.get("description"):
                item["description"] = q["description"]
            item["pageBreakItem"] = {}
        else:
            label, kind = _label_and_kind(q)
            item["title"] = label
            if q.get("help"):
                item["description"] = q["help"]
            question: dict[str, Any] = {"required": bool(q.get("required"))}
            if kind == "short":
                question["textQuestion"] = {"paragraph": False}
            elif kind == "paragraph":
                question["textQuestion"] = {"paragraph": True}
            elif kind in ("radio", "checkbox"):
                question["choiceQuestion"] = {
                    "type": "RADIO" if kind == "radio" else "CHECKBOX",
                    "options": [{"value": o} for o in q["options"]],
                    "shuffle": False,
                }
            else:
                raise ValueError(f"Unknown question kind: {kind}")
            item["questionItem"] = {"question": question}
        requests.append({"createItem": {"item": item, "location": {"index": index}}})
    return requests


def _label_and_kind(q: dict[str, Any]) -> tuple[str, str]:
    for kind in ("short", "paragraph", "radio", "checkbox"):
        if kind in q:
            return q[kind], kind
    raise ValueError(f"Question is missing a kind field: {q!r}")


def get_credentials(service_account_path: str, impersonate: str):
    creds = service_account.Credentials.from_service_account_file(
        service_account_path, scopes=SCOPES,
    )
    return creds.with_subject(impersonate)


def create_form(forms_service) -> dict[str, Any]:
    form = forms_service.forms().create(
        body={"info": {"title": FORM_TITLE, "documentTitle": FORM_DOC_TITLE}},
    ).execute()

    requests: list[dict[str, Any]] = [
        {"updateFormInfo": {
            "info": {"description": FORM_DESCRIPTION},
            "updateMask": "description",
        }},
    ]
    requests.extend(build_create_item_requests(QUESTIONS))

    forms_service.forms().batchUpdate(
        formId=form["formId"], body={"requests": requests},
    ).execute()
    return form


def create_sheet(sheets_service) -> dict[str, Any]:
    return sheets_service.spreadsheets().create(
        body={"properties": {"title": SHEET_TITLE}},
        fields="spreadsheetId,spreadsheetUrl",
    ).execute()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service-account", required=True,
                        help="Path to service account JSON key.")
    parser.add_argument("--impersonate", required=True,
                        help="Workspace user to act as (form/sheet owner).")
    args = parser.parse_args()

    try:
        creds = get_credentials(args.service_account, args.impersonate)
        forms_service = build("forms", "v1", credentials=creds,
                              cache_discovery=False)
        sheets_service = build("sheets", "v4", credentials=creds,
                               cache_discovery=False)

        print("Creating form…")
        form = create_form(forms_service)
        print("Creating destination spreadsheet…")
        sheet = create_sheet(sheets_service)
    except HttpError as e:
        print(f"\nGoogle API error: {e}", file=sys.stderr)
        return 1

    print()
    print("Done.")
    print(f"  Form ID:           {form['formId']}")
    print(f"  Form edit URL:     {form['responderUri'].replace('/viewform', '/edit')}")
    print(f"  Form responder:    {form['responderUri']}")
    print(f"  Spreadsheet ID:    {sheet['spreadsheetId']}")
    print(f"  Spreadsheet URL:   {sheet['spreadsheetUrl']}")
    print()
    print("Next steps (in the Forms UI, signed in as the impersonated user):")
    print("  1. Open the form's edit URL above.")
    print("  2. Responses tab → Link to Sheets → 'Select existing spreadsheet'")
    print("     → pick the spreadsheet this script just created.")
    print("  3. In the sheet, add columns 'Status' (default 'Pending') and")
    print("     'Reviewer Notes'. Create a filter view named 'Approved'.")
    print("  4. Share the responder URL with the troop.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
