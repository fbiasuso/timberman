# Date History — Specification

## Purpose

Read-only access for any authenticated user to historical tournament dates and their matches, with server-side sanitization of unpublished results.

## Requirements

### Requirement: Date History Endpoint

The system MUST expose `GET /api/matches/dates/:dateId/history` for any authenticated user (admin NOT required). The response MUST include the date and its matches.

#### Scenario: User fetches date history

- GIVEN an authenticated non-admin user and an existing date
- WHEN the user requests the history endpoint for that date
- THEN the system returns the date with its matches

#### Scenario: Unauthenticated request rejected

- GIVEN no valid JWT
- WHEN the history endpoint is requested
- THEN the system returns 401 Unauthorized

#### Scenario: Unknown date

- GIVEN a dateId that does not exist
- WHEN the history endpoint is requested
- THEN the system returns 404 Not Found

### Requirement: Results Sanitization by Date Status

For the history endpoint the system MUST return matches with `result` and `score` null when the date status is 'closed', and MUST return full results when the status is 'results'. Admins MUST receive full data via the existing admin-only `GET /api/matches/dates/:dateId`.

#### Scenario: Closed date hides results

- GIVEN a date with status 'closed' and stored scores
- WHEN a non-admin user fetches its history
- THEN each match is returned with result and score null

#### Scenario: Results date shows full results

- GIVEN a date with status 'results' and stored scores
- WHEN a non-admin user fetches its history
- THEN each match is returned with its stored result and score

### Requirement: Cartelera Fechas Anteriores Section

The user Cartelera MUST render a "Fechas anteriores" section below the active date content, or below the "No hay cartelera disponible" message when no active date exists. Each row MUST show "Fecha N" with a lock icon for 'closed' dates and a "$" / "Resultados" marker for 'results' dates. Expanding a row MUST fetch the history endpoint and render read-only match rows; results MUST be hidden for 'closed' dates per sanitization.

#### Scenario: Section below active date content

- GIVEN an active date with content
- WHEN the Cartelera renders
- THEN the active date content appears
- AND "Fechas anteriores" rows appear below it

#### Scenario: Section below no-cartelera message

- GIVEN no active (open) date
- WHEN the Cartelera renders
- THEN "No hay cartelera disponible" appears
- AND "Fechas anteriores" rows appear below it

#### Scenario: Expand closed date row

- GIVEN a 'closed' date row in Fechas anteriores
- WHEN the user expands it
- THEN the system fetches the history endpoint
- AND read-only match rows render with teams only, no results

#### Scenario: Expand results date row

- GIVEN a 'results' date row in Fechas anteriores
- WHEN the user expands it
- THEN the system fetches the history endpoint
- AND read-only match rows render with teams and results
