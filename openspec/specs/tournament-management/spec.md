# Tournament Management — Specification

## Purpose

Tournament date lifecycle: create, set results, close dates, and start new tournaments with full historical preservation.

## Requirements

### Requirement: Create Tournament Date

An admin MUST be able to create a tournament date with teams, scheduled time, and bet amount.

#### Scenario: Create date in open tournament

- GIVEN an active tournament
- WHEN an admin creates a new date with two teams, a scheduled datetime, and a bet amount
- THEN the date is created in "open" status
- AND users can place bets on it

### Requirement: Date Lifecycle

Tournament dates MUST follow the lifecycle: `open → closed → results-published`.

#### Scenario: Close date prevents new bets

- GIVEN a date in "open" status with bets placed
- WHEN an admin closes the date
- THEN the date status changes to "closed"
- AND no new bets can be placed

#### Scenario: Publish results after close

- GIVEN a date in "closed" status
- WHEN an admin enters match results
- THEN the date transitions to "results-published"
- AND points are calculated and awarded

### Requirement: Set Match Results

An admin MUST be able to set the final score or outcome for each match on a date.

#### Scenario: Results update triggers points

- GIVEN a closed date with placed bets
- WHEN an admin sets the final scores for each match
- THEN the system calculates points per bet based on correct predictions
- AND updates each user's accumulated points

### Requirement: Start New Tournament

An admin MUST be able to start a new tournament while preserving all historical data.

#### Scenario: New tournament with clean slate

- GIVEN existing tournaments with closed dates and history
- WHEN an admin creates a new tournament
- THEN the new tournament starts with no dates
- AND all previous tournament data remains accessible for ranking queries

#### Scenario: New tournament inherits config

- GIVEN an existing tournament with commission and bet amount configured
- WHEN an admin creates a new tournament
- THEN the new tournament MAY inherit the previous configuration
- OR the admin MAY override defaults per-tournament

### Requirement: Historical Preservation

Closed tournaments and their associated bets, results, and rankings MUST be preserved and queryable.

#### Scenario: Historical data survives new tournament

- GIVEN a closed tournament with dates, bets, and points
- WHEN a new tournament is started
- THEN the closed tournament's data is still available via the ranking API
- AND bet records remain intact
