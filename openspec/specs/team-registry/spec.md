# Team Registry — Specification

## Purpose

A registry of leagues and teams that gives matches real team identity: matches reference teams by id while free-text names remain as a legacy display fallback. Leagues are sports entities (with country and format), separate from betting tournaments. Teams are flat entities that participate in one or more leagues through many-to-many memberships; a team MUST belong to at least one league.

## Requirements

### Requirement: League Creation

An admin MUST be able to create a league via `POST /api/admin/leagues` (admin role required) with `name`, `country`, and `format` (`liga` | `copa`). League names MUST be unique under a normalized key (lowercase, whitespace stripped); a collision MUST return HTTP 409. Empty or whitespace-only names MUST be rejected with HTTP 400. Leagues MUST be independent from betting tournaments.

#### Scenario: Create league

- GIVEN an authenticated admin
- WHEN the admin creates a league "Primera División" with country "Argentina" and format "liga"
- THEN the league is created
- AND the response includes the new league

#### Scenario: Normalized duplicate name rejected

- GIVEN a league named "Primera División"
- WHEN an admin creates a league named "primera division"
- THEN the system returns HTTP 409
- AND no league is created

#### Scenario: Empty name rejected

- GIVEN an authenticated admin
- WHEN the admin creates a league with a whitespace-only name
- THEN the system returns HTTP 400
- AND no league is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-league endpoint
- THEN the system returns 403 Forbidden

### Requirement: League Listing

An admin MUST be able to list leagues ordered by name; the list MUST feed the Equipos tab and the match forms.

#### Scenario: List leagues

- GIVEN two leagues exist
- WHEN an admin requests the league list
- THEN the system returns both leagues ordered by name

### Requirement: League Editing

An admin MUST be able to edit a league's `name`, `country`, and `format` via `PATCH /api/admin/leagues/:leagueId` (admin role required). Renames MUST respect normalized uniqueness; a collision MUST return HTTP 409.

#### Scenario: Rename league

- GIVEN a league "Primera División"
- WHEN an admin renames it to "Torneo Apertura"
- THEN the new name persists

#### Scenario: Rename collision rejected

- GIVEN leagues "Primera División" and "Copa Argentina"
- WHEN an admin renames "Primera División" to "copa argentina"
- THEN the system returns HTTP 409
- AND the name is unchanged

### Requirement: League Deletion Guard

An admin MUST be able to delete a league via `DELETE /api/admin/leagues/:leagueId` (admin role required). Deleting a league that still has team memberships MUST be rejected with HTTP 409; the league and its teams MUST remain untouched.

#### Scenario: Delete empty league

- GIVEN a league with no team memberships
- WHEN an admin deletes it
- THEN the league is removed

#### Scenario: League with teams blocked

- GIVEN a league with team memberships
- WHEN an admin tries to delete it
- THEN the system returns HTTP 409
- AND the league and its teams remain

### Requirement: Team Creation

An admin MUST be able to create a team via `POST /api/admin/teams` (admin role required) with `name`, optional `aliases` (list of strings), optional shield input, and at least one league membership (`leagueIds`). The team name MUST be unique globally under a normalized key (lowercase, whitespace stripped); a collision MUST return HTTP 409. Empty or whitespace-only names MUST be rejected with HTTP 400. A request with no league memberships MUST be rejected with HTTP 400 because a team MUST belong to at least one league.

#### Scenario: Create team

- GIVEN a league "Primera División"
- WHEN an admin creates team "River Plate" with alias "El Millonario" and a membership in the league
- THEN the team is created with the league membership

#### Scenario: Duplicate name globally rejected

- GIVEN a team "River Plate" in "Primera División"
- WHEN an admin creates another team named "river plate" in any league
- THEN the system returns HTTP 409
- AND no team is created

#### Scenario: Membership required

- GIVEN an authenticated admin
- WHEN the admin creates a team without league memberships
- THEN the system returns HTTP 400
- AND no team is created

#### Scenario: Empty name rejected

- GIVEN an authenticated admin
- WHEN the admin creates a team with an empty name
- THEN the system returns HTTP 400

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-team endpoint
- THEN the system returns 403 Forbidden

### Requirement: Team Editing

An admin MUST be able to edit a team's `name`, `aliases`, logo, and league memberships via `PATCH /api/admin/teams/:teamId` (admin role required). Renames MUST respect global normalized uniqueness; a collision MUST return HTTP 409. A membership update MUST leave the team with at least one league membership; removing the last membership MUST be rejected with HTTP 400.

#### Scenario: Rename team

- GIVEN a team "River Plate"
- WHEN an admin renames it to "River Plate FC"
- THEN the new name persists
- AND fields not provided are unchanged

#### Scenario: Rename collision rejected

- GIVEN teams "River Plate" and "Boca Juniors" in any leagues
- WHEN an admin renames "River Plate" to "boca juniors"
- THEN the system returns HTTP 409
- AND the name is unchanged

#### Scenario: Add league membership

- GIVEN a team with a membership in "Primera División"
- WHEN an admin adds a membership in "Copa Argentina"
- THEN the team participates in both leagues

#### Scenario: Remove last membership rejected

- GIVEN a team whose only membership is "Primera División"
- WHEN an admin removes that membership
- THEN the system returns HTTP 400
- AND the membership is unchanged

### Requirement: Team Deletion Guard

An admin MUST be able to delete a team via `DELETE /api/admin/teams/:teamId` (admin role required). Deleting a team referenced by any match MUST be rejected with HTTP 409; the team and the referencing matches MUST remain untouched. A team with no match references MAY be deleted, and the system MUST remove its league memberships as part of the deletion.

#### Scenario: Delete unreferenced team

- GIVEN a team not referenced by any match
- WHEN an admin deletes it
- THEN the team is removed
- AND its league memberships are removed

#### Scenario: Referenced team blocked

- GIVEN a team referenced by a match
- WHEN an admin tries to delete it
- THEN the system returns HTTP 409
- AND the team remains

### Requirement: Team Autocomplete

The system MUST expose team listing/autocomplete via `GET /api/admin/leagues/:id/teams` (admin role required) returning teams with a membership in the given league, ordered by name. Teams without a membership in that league MUST NOT be returned. A team participating in multiple leagues MUST appear in each league's list.

#### Scenario: Filter teams by league

- GIVEN teams with memberships in two leagues
- WHEN an admin requests teams for league A
- THEN only league A's member teams are returned, ordered by name

#### Scenario: Empty league

- GIVEN a league with no team memberships
- WHEN an admin requests its teams
- THEN an empty list is returned

#### Scenario: Team in multiple leagues

- GIVEN a team with memberships in leagues A and B
- WHEN an admin requests teams for league A and for league B
- THEN the team is returned by both requests

### Requirement: Seeded Rosters

The seed script MUST load real current rosters of Argentine Primera A and Primera B (Primera Nacional) with aliases into the registry, creating each team's league membership. Re-running the seed MUST NOT create duplicates (global normalized uniqueness applies). Shield download failures during seeding MUST NOT block roster creation (teams get no logo; see team-image-hosting).

#### Scenario: Seed loads rosters

- GIVEN an empty registry
- WHEN the seed script runs
- THEN the leagues and their teams are created with aliases and league memberships

#### Scenario: Re-run is idempotent

- GIVEN a registry already seeded
- WHEN the seed script runs again
- THEN no duplicate teams or leagues are created

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
