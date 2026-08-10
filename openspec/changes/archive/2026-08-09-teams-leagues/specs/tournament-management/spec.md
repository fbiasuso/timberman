# Delta for Tournament Management

## ADDED Requirements

### Requirement: Team Reference Enrichment

Matches MUST store nullable `local_team_id`/`visitor_team_id` foreign keys to the teams registry. A team id is ENRICHMENT only: the free-text `local_team`/`visitor_team` strings remain the source of truth for display and MUST always be populated. Existing matches without team ids MUST keep rendering and editing unchanged (string fallback). Match responses MUST include the team ids so clients can resolve logos.

#### Scenario: Legacy match keeps working

- GIVEN a match with only string teams
- WHEN the match is rendered or edited
- THEN the strings are used for display
- AND the match remains editable with no team id required

#### Scenario: Registry match stores both

- GIVEN a match created from a team selection
- WHEN the match is persisted
- THEN the string equals the team's name
- AND the team id is stored

## MODIFIED Requirements

### Requirement: Match Creation

An admin MUST be able to create a match on a tournament date via `POST /api/admin/matches` (admin role required) with `localTeam`, `visitorTeam`, optional `localImg`, `visitorImg`, `scheduledAt`, and optional `localTeamId`, `visitorTeamId`. When a team id is provided, the system MUST resolve it against the teams registry, persist it as the FK, and persist the string field as that team's name; an unknown team id MUST be rejected (HTTP 422) and no match created. When only free text is provided, the team id MUST be null. The system MUST reject creation when the parent date is not 'open' or when the tournament's status is not `active`.
(Previously: only free-text `localTeam`/`visitorTeam`; no team ids)

#### Scenario: Create match on open date

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with both teams
- THEN the match is created and persisted
- AND the response includes the new match

#### Scenario: Create match on non-open date rejected

- GIVEN a date with status 'closed' or 'results'
- WHEN an admin posts a match for it
- THEN the system returns an error (422)
- AND no match is created

#### Scenario: Create match on non-active tournament rejected

- GIVEN a tournament with status 'finished' or 'archived' and a date in 'open' status
- WHEN an admin posts a match for it
- THEN the system rejects the request
- AND no match is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-match endpoint
- THEN the system returns 403 Forbidden

#### Scenario: Create match from registry teams

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with `localTeamId` and `visitorTeamId`
- THEN the match stores both team ids
- AND the string fields are set to the teams' names

#### Scenario: Unknown team id rejected

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with a non-existent team id
- THEN the system returns 422
- AND no match is created

#### Scenario: Free text without team id stays legacy

- GIVEN an admin and a date with status 'open'
- WHEN the admin posts a match with only free-text teams
- THEN the match is created with null team ids
- AND the strings are stored as written

### Requirement: Match Details Editing

An admin MUST be able to edit a match's `localTeam`, `visitorTeam`, `localImg`, `visitorImg`, `scheduledAt`, and optional `localTeamId`, `visitorTeamId` via `PATCH /api/admin/matches/:matchId` (admin role required). Providing a team id MUST resolve it against the registry, set the FK, and set the string to the team's name; updating a string without a team id MUST set the FK to null. The update MUST be partial and applied through the immutable `Match.withDetails()` method. Editing MUST be allowed only when the parent date is 'open'; result editing stays on `PATCH /api/admin/matches/:matchId/result`.
(Previously: no team ids; strings only)

#### Scenario: Partial details update

- GIVEN a match on an open date
- WHEN an admin PATCHes only the visitor team (free text, no team id)
- THEN the visitor team string changes
- AND the visitor team id becomes null
- AND all other fields remain unchanged

#### Scenario: Edit on non-open date rejected

- GIVEN a match on a date with status 'closed' or 'results'
- WHEN an admin PATCHes its details
- THEN the system returns an error (422)
- AND no fields change

#### Scenario: Unknown match

- GIVEN a matchId that does not exist
- WHEN an admin PATCHes it
- THEN the system returns 404 Not Found

#### Scenario: Update team via registry

- GIVEN a match on an open date with a free-text local team
- WHEN an admin PATCHes `localTeamId` for a registry team
- THEN the FK is stored
- AND the local team string becomes that team's name

#### Scenario: Free text clears the team id

- GIVEN a match with a stored local team id
- WHEN an admin PATCHes only free-text `localTeam`
- THEN the local team id becomes null
- AND the string is stored as written
