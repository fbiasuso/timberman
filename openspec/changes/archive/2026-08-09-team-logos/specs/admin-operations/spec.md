# Delta for Admin Operations

## ADDED Requirements

### Requirement: Team Logo Upload UI

The TeamForm in the Equipos tab MUST render the shield input as a native file picker accepting only PNG, JPEG, and WebP (`accept="image/png,image/jpeg,image/webp"`) with a live preview via `URL.createObjectURL`. The client MUST validate file type and size (1 MiB cap) before upload; an invalid selection MUST show an inline error and block save. On save, the file MUST be uploaded as multipart FormData to the logo endpoint. Teams without a logo MUST be able to add one, and teams with a logo MUST be able to replace it; the server keeping the replaced file orphaned is acceptable.

#### Scenario: Valid selection previews

- GIVEN an admin editing a team
- WHEN a PNG under 1 MiB is selected
- THEN a live preview renders and save is enabled

#### Scenario: Invalid type blocked

- GIVEN an admin editing a team
- WHEN a non-image file is selected
- THEN an inline error is shown and save is blocked

#### Scenario: Oversized file blocked

- GIVEN an admin editing a team
- WHEN a file over 1 MiB is selected
- THEN an inline error is shown and save is blocked

#### Scenario: Save uploads via FormData

- GIVEN a valid selected file
- WHEN the admin saves the team
- THEN the file is posted as multipart/form-data
- AND the updated logo renders after the list refreshes

#### Scenario: Team without logo adds one

- GIVEN a team with logo null
- WHEN the admin picks a valid file and saves
- THEN the team gains the uploaded logo

#### Scenario: Logo replacement

- GIVEN a team with an existing logo
- WHEN the admin picks a valid file and saves
- THEN the logo is replaced
- AND the old file may remain orphaned
