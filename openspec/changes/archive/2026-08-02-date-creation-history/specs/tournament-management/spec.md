# Delta for Tournament Management

## ADDED Requirements

### Requirement: Match Creation

An admin MUST be able to create a match on a tournament date via `POST /api/admin/matches` (admin role required) with `localTeam`, `visitorTeam`, and optional `localImg`, `visitorImg`, `scheduledAt`. The system MUST reject creation when the parent date is not 'open'.

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

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-match endpoint
- THEN the system returns 403 Forbidden

### Requirement: Match Details Editing

An admin MUST be able to edit a match's `localTeam`, `visitorTeam`, `localImg`, `visitorImg`, and `scheduledAt` via `PATCH /api/admin/matches/:matchId` (admin role required). The update MUST be partial and applied through the immutable `Match.withDetails()` method. Editing MUST be allowed only when the parent date is 'open'; result editing stays on `PATCH /api/admin/matches/:matchId/result`.

#### Scenario: Partial details update

- GIVEN a match on an open date
- WHEN an admin PATCHes only the visitor team
- THEN the visitor team changes
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

## MODIFIED Requirements

### Requirement: Create Tournament Date

An admin MUST be able to create a tournament date via `POST /api/admin/dates` (admin role required), wired to the existing CreateDateUseCase. The system MUST compute `dateNumber` as the maximum existing dateNumber for the tournament plus one, create the date in 'open' status with `betAmount` from system config and `pozo` 0, and reject creation when an 'open' date already exists for the tournament (one betting round at a time).
(Previously: create a date with manually specified teams, scheduled time, and bet amount)

#### Scenario: Create next date after publishing

- GIVEN a tournament whose latest date is 'closed' or 'results' with dateNumber 1
- WHEN an admin creates a new date
- THEN the new date gets dateNumber 2 in 'open' status with pozo 0
- AND betAmount comes from system config
- AND users can place bets on it

#### Scenario: Reject when an open date exists

- GIVEN a tournament with an existing date in 'open' status
- WHEN an admin creates a new date
- THEN the system rejects the request
- AND no new date is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-date endpoint
- THEN the system returns 403 Forbidden
