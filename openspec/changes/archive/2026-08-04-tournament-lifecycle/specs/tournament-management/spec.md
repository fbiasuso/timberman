# Delta for Tournament Management

## ADDED Requirements

### Requirement: Tournament Status Model

`tournaments.status` MUST replace the `isActive` boolean with a three-state enum: `active`, `finished`, `archived`. Every tournament MUST have exactly one status; creation MUST set it to `active`. The migration MUST map existing rows with `is_active = true` to `status = 'active'`. At boot, when NO tournament exists, the system MUST auto-create "Torneo 1" with status `active`, carryover 0, and commission from system config; when at least one exists, boot MUST NOT create a duplicate.

#### Scenario: Boot creates first tournament

- GIVEN an empty tournaments table
- WHEN the server boots
- THEN a tournament named "Torneo 1" is created with status 'active'
- AND its carryover is 0

#### Scenario: Boot keeps existing tournaments

- GIVEN a database with an existing active tournament
- WHEN the server boots
- THEN no additional tournament is created

#### Scenario: Migrated legacy row

- GIVEN a pre-migration tournament with is_active = true
- WHEN the migration runs
- THEN the tournament has status 'active'

### Requirement: Terminate Tournament

An admin MUST be able to terminate an `active` tournament. Terminate MUST transition the status to `finished`, determine the winner(s) as ALL users tied at the maximum total tournament points read from persisted `tournament_points` (only when that maximum is greater than zero), and persist the winner user IDs and `finished_at` on the tournament. Terminate MUST be rejected with HTTP 409 when the tournament has an open date. Prize payment MUST be stubbed: terminate MUST NOT credit balances, split pozo, or change prizes. Terminate MUST be rejected when the tournament is not `active`.

#### Scenario: Terminate freezes finished tournament

- GIVEN an active tournament with all dates paid and one user holding the most points
- WHEN an admin terminates it
- THEN the status becomes 'finished'
- AND the top user is persisted as winner with finished_at set
- AND no balance or prize changes occur

#### Scenario: Tie produces multiple winners

- GIVEN two users tied at the maximum points
- WHEN the tournament is terminated
- THEN both users are persisted as winners

#### Scenario: Open date blocks terminate

- GIVEN a tournament with an open date
- WHEN an admin terminates it
- THEN the system returns HTTP 409
- AND the status stays 'active'

#### Scenario: Terminating a finished tournament

- GIVEN a tournament with status 'finished'
- WHEN an admin terminates it
- THEN the request is rejected

### Requirement: Archive Tournament

An admin MUST be able to archive a tournament with status `finished`. Archive MUST hide the tournament from all active flows (active-tournament resolution, ranking default, Cartelera, "Fechas anteriores", admin Partidos) and MUST auto-create the next tournament named "Torneo N+1" (N = archived tournament's number) with status `active`, carryover 0, and an admin-editable name. The archived tournament's carryover MUST stay frozen — it MUST NOT be transferred to the next tournament. Archive MUST be rejected when the tournament is not `finished`. Archived data MUST remain queryable per Historical Preservation.

#### Scenario: Archive creates next tournament

- GIVEN a finished tournament "Torneo 2"
- WHEN an admin archives it
- THEN its status becomes 'archived'
- AND a tournament named "Torneo 3" is created with status 'active' and carryover 0

#### Scenario: Next tournament name is editable

- GIVEN the auto-created next tournament
- WHEN an admin renames it
- THEN the new name persists

#### Scenario: Carryover stays frozen

- GIVEN a finished tournament with carryover 1500 cents
- WHEN it is archived
- THEN the next tournament starts with carryover 0
- AND the archived tournament keeps its 1500 cents

#### Scenario: Archive of active tournament rejected

- GIVEN a tournament with status 'active'
- WHEN an admin archives it
- THEN the request is rejected

## MODIFIED Requirements

### Requirement: Create Tournament Date

An admin MUST be able to create a tournament date via `POST /api/admin/dates` (admin role required), wired to the existing CreateDateUseCase. The system MUST compute `dateNumber` as the maximum existing dateNumber for the tournament plus one, create the date in 'open' status with `betAmount` from system config and `pozo` 0, and reject creation when an 'open' date already exists for the tournament (one betting round at a time). The system MUST reject creation when the tournament's status is not `active`; 'finished' and 'archived' tournaments accept no new dates.
(Previously: no tournament-status guard)

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

#### Scenario: Reject on non-active tournament

- GIVEN a tournament with status 'finished' or 'archived'
- WHEN an admin creates a date
- THEN the system rejects the request
- AND no date is created

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user posts to the create-date endpoint
- THEN the system returns 403 Forbidden

### Requirement: Date Lifecycle

Tournament dates MUST follow the lifecycle: `open → closed → results-published`. Closing computes pozo and financials (see Close Date Financials); the publish-results action transitions closed → results-published, computes and PERSISTS points per user+tournament+date in `tournament_points` (points are awarded only at this step), and distributes payouts per prize-payouts.
(Previously: publish "distributes points and payouts" with no persistence semantics)

#### Scenario: Close date prevents new bets

- GIVEN a date in "open" status with bets placed
- WHEN an admin closes the date
- THEN the date status changes to "closed"
- AND no new bets can be placed

#### Scenario: Publish results after close

- GIVEN a date in "closed" status with stored results
- WHEN results are published
- THEN the date transitions to "results-published"
- AND points are calculated and persisted per user+tournament+date
- AND payouts are credited per prize-payouts

### Requirement: Set Match Results

An admin MUST be able to set the final score or outcome for each match on a date. Setting results MUST NOT calculate, award, or accumulate points; points are computed and persisted only when the date is published (see Date Lifecycle).
(Previously: setting results updated each user's accumulated points)

#### Scenario: Results update does not award points

- GIVEN a closed date with placed bets
- WHEN an admin sets the final scores for each match
- THEN the scores are stored
- AND no user points change until the date is published

### Requirement: Start New Tournament

An admin MUST be able to start a new tournament while preserving all historical data. On creation the system MUST set `tournament.commission` from the system-config rate (the field is informational and MUST NOT feed pozo calculation) and MUST set the status to `active` with carryover 0. When a tournament is archived, the next tournament is auto-created (see Archive Tournament).
(Previously: creation set isActive=true; no status field)

#### Scenario: New tournament with clean slate

- GIVEN existing tournaments with closed dates and history
- WHEN an admin creates a new tournament
- THEN the new tournament starts with no dates and status 'active'
- AND all previous tournament data remains accessible for ranking queries

#### Scenario: New tournament records config commission

- GIVEN system-config commission 15%
- WHEN an admin creates a new tournament
- THEN the tournament stores commission 15% as informational data
- AND pozo calculation at close uses the live system-config rate, not this field

### Requirement: Match Creation

An admin MUST be able to create a match on a tournament date via `POST /api/admin/matches` (admin role required) with `localTeam`, `visitorTeam`, and optional `localImg`, `visitorImg`, `scheduledAt`. The system MUST reject creation when the parent date is not 'open' or when the tournament's status is not `active`.
(Previously: only the parent-date 'open' guard)

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
