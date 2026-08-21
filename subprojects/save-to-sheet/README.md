# Save To Sheet

This subproject adds a `Save Job` action to the extension. It saves the current job page to a Google Sheet using Chrome extension OAuth and the Google Sheets API.

## Setup

1. Create or choose a Google Sheet.
2. Copy the spreadsheet ID from the Sheet URL, or paste the full Google Sheets URL into the extension.
3. In the extension popup, open `Edit`.
4. Paste the spreadsheet ID into `Google Sheet ID`.
5. Set `Google Sheet range`, such as `'Full Time'!A:D`.
6. Save the profile.

The target table should have these columns, in this order:

```text
Company | Position | Link | Applied?
```

`Save Job` appends one row to the bottom of that table:

```text
Company | Position | Current page URL | today's date as MM/DD/YYYY
```

The default target range is:

```text
'Full Time'!A:D
```

After a successful save, the popup status shows the updated range returned by Google Sheets, such as `'Full Time'!A12:D12`. If the visible sheet does not change, check that `Google Sheet ID` points to the expected spreadsheet, the signed-in Google account can access it, and `Google Sheet range` points to the expected tab.

## Google API Configuration

This feature uses `chrome.identity.getAuthToken` and the Google Sheets API `spreadsheets.values.append` endpoint.

Before this can work, replace the placeholder `oauth2.client_id` in `manifest.json` with a Chrome extension OAuth client ID from Google Cloud Console.

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Copy this unpacked extension's extension ID.
4. In Google Cloud Console, create or choose a project.
5. Enable the Google Sheets API.
6. Configure the OAuth consent screen.
7. Create an OAuth client ID for a Chrome extension.
8. Paste the Chrome extension ID into the OAuth client setup.
9. Copy the generated client ID into `manifest.json`.
10. Reload the extension in `chrome://extensions`.

The manifest value must look like a real Google OAuth client ID, not the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_REAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/spreadsheets"]
}
```

The OAuth scope is:

```text
https://www.googleapis.com/auth/spreadsheets
```

Do not commit personal spreadsheet IDs, OAuth secrets, resume data, job application details, screenshots with private information, or local machine paths.
