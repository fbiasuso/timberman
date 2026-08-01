# Delta for Tournament Management

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Date Lifecycle

Tournament dates MUST follow the lifecycle: `open → closed → results-published`. Closing computes pozo and financials (see Close Date Financials); the publish-results action transitions closed → results-published and distributes points and payouts.
(Previously: entering results directly transitioned the date)

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

### Requirement: Start New Tournament

An admin MUST be able to start a new tournament while preserving all historical data. On creation the system MUST set `tournament.commission` from the system-config rate; the field is informational and MUST NOT feed pozo calculation.
(Previously: per-tournament commission could be set or overridden and directly fed the pozo)

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
