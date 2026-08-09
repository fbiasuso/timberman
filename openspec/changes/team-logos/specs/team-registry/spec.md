# Delta for Team Registry

## ADDED Requirements

### Requirement: Shield Logo Upload Endpoint

The system MUST accept shield input on `POST /api/admin/teams/:teamId/logo` (admin role required) as either a JSON body `{url}` (existing behavior, unchanged) or a multipart/form-data upload with field `file`, with multipart enabled via `@fastify/multipart`. The server MUST enforce the 1 MiB file size cap and validate format by magic-byte sniff (PNG/JPEG/WebP). A failed upload — oversized, invalid format, or unreachable source — MUST NOT change the team: the existing logo (or null) is kept and the error is surfaced to the client.

#### Scenario: JSON body still accepted

- GIVEN an authenticated admin
- WHEN the admin POSTs `{url}` to the logo endpoint
- THEN the URL is downloaded and stored via downloadAndStore

#### Scenario: Valid multipart upload

- GIVEN an authenticated admin and a valid PNG file under 1 MiB
- WHEN the admin POSTs multipart field `file` to the logo endpoint
- THEN the buffer is validated and stored through the active backend
- AND teams.logo is updated

#### Scenario: Oversized file keeps team unchanged

- GIVEN a file over 1 MiB
- WHEN the admin uploads it to the logo endpoint
- THEN the request fails and the team keeps its existing logo

#### Scenario: Invalid format keeps team unchanged

- GIVEN a text file
- WHEN the admin uploads it to the logo endpoint
- THEN the request fails and the team keeps its existing logo

#### Scenario: Unreachable URL keeps existing logo

- GIVEN a team with an existing logo
- WHEN the admin POSTs `{url}` pointing to an unreachable source
- THEN the team keeps its existing logo
- AND the error is surfaced to the client
