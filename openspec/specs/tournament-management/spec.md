# Tournament Management — Specification

## Purpose

Tournament date lifecycle: create, set results, close dates, and start new tournaments with full historical preservation.

## Requirements

### Requirement: Create Tournament Date

An admin MUST be able to create a tournament date via `POST /api/admin/dates` (admin role required), wired to the existing CreateDateUseCase. The system MUST compute `dateNumber` as the maximum existing dateNumber for the tournament plus one, create the date in 'open' status with `betAmount` from system config and `pozo` 0, and reject creation when an 'open' date already exists for the tournament (one betting round at a time).

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

### Requirement: Date Lifecycle

Tournament dates MUST follow the lifecycle: `open → closed → results-published`. Closing computes pozo and financials (see Close Date Financials); the publish-results action transitions closed → results-published and distributes points and payouts.

#### Scenario: Close date prevents new bets

- GIVEN a date in "open" status with bets placed
- WHEN an admin closes the date
- THEN the date status changes to "closed"
- AND no new bets can be placed

#### Scenario: Publish results after close

- GIVEN a date in "closed" status with stored results
- WHEN results are published
- THEN the date transitions to "results-published"
- AND points are calculated and awarded
- AND payouts are credited per prize-payouts

### Requirement: Set Match Results

An admin MUST be able to set the final score or outcome for each match on a date.

#### Scenario: Results update triggers points

- GIVEN a closed date with placed bets
- WHEN an admin sets the final scores for each match
- THEN the system calculates points per bet based on correct predictions
- AND updates each user's accumulated points

### Requirement: Start New Tournament

An admin MUST be able to start a new tournament while preserving all historical data. On creation the system MUST set `tournament.commission` from the system-config rate; the field is informational and MUST NOT feed pozo calculation.

#### Scenario: New tournament with clean slate

- GIVEN existing tournaments with closed dates and history
- WHEN an admin creates a new tournament
- THEN the new tournament starts with no dates
- AND all previous tournament data remains accessible for ranking queries

#### Scenario: New tournament records config commission

- GIVEN system-config commission 15%
- WHEN an admin creates a new tournament
- THEN the tournament stores commission 15% as informational data
- AND pozo calculation at close uses the live system-config rate, not this field

### Requirement: Historical Preservation

Closed tournaments and their associated bets, results, and rankings MUST be preserved and queryable.

#### Scenario: Historical data survives new tournament

- GIVEN a closed tournament with dates, bets, and points
- WHEN a new tournament is started
- THEN the closed tournament's data is still available via the ranking API
- AND bet records remain intact

### Requirement: Close Date Financials

When closing a date the system MUST compute `pozo = tournament.carryover + (gross − commission)`, consume the carryover (reset to 0), credit the commission to the closing admin's balance (from the authenticated JWT), and write a `commission_payout` audit_log entry.

#### Scenario: Close with carryover

- GIVEN a date with gross 5000 cents, config commission 10%, and tournament carryover 1200 cents
- WHEN an admin closes the date
- THEN pozo = 1200 + 4500 = 5700 cents is stored
- AND carryover resets to 0

#### Scenario: Commission credited to closing admin

- GIVEN an admin with balance 0 closing a date with commission 500 cents
- WHEN the date closes
- THEN the admin's balance is credited 500 cents
- AND an audit_log entry `commission_payout` records admin, amount, and timestamp

#### Scenario: Close with no bets

- GIVEN a date with no bets and carryover 0
- WHEN the date closes
- THEN pozo and commission are zero

### Requirement: Carryover Lifecycle

`tournaments.carryover` (integer cents, default 0) MUST accumulate unpaid pozo on publish (see prize-payouts) and be consumed on the next date close.

#### Scenario: Carryover feeds next date

- GIVEN a tournament with carryover 1500 cents
- WHEN the next date is closed
- THEN the new pozo includes the 1500 cents
- AND the carryover is consumed (reset to 0)

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

### Requirement: Bet Amount Propagation Boundary

Bet amount propagation MUST run only when an admin changes the config default (see system-config); it MUST NOT run on date creation. Date-creation rules MUST remain unchanged: `POST /api/admin/dates` still snapshots `betAmount` from system config and still rejects when an open date already exists for the tournament. Propagation MUST NOT create, close, or delete dates, and MUST NOT affect the one-open-date-per-tournament rule.

#### Scenario: Propagation never creates dates

- GIVEN a tournament with no open date
- WHEN the admin changes the default bet amount
- THEN no date is created
- AND no open-date conflict is raised

#### Scenario: Creation snapshots config at creation time

- GIVEN a tournament whose open date was created before a default change
- WHEN an admin later creates a new date after the open one is closed
- THEN the new date snapshots the current default
- AND no propagation runs during creation
