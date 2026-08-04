# Delta for Prize Payouts

## ADDED Requirements

### Requirement: Points Awarded Only on Paid Dates

Points MUST be computed and persisted ONLY when publish-results transitions a date to 'results'. The system MUST write one `tournament_points` row per user+tournament+date with the points computed by the points calculator. No points MUST be awarded, accumulated, or persisted for open or closed dates, regardless of stored match results.

#### Scenario: Publish persists points

- GIVEN a closed date with bets
- WHEN results are published
- THEN one tournament_points row per user is written for user+tournament+date
- AND the rows store the computed points

#### Scenario: No points before publish

- GIVEN a date with match results but status 'closed'
- WHEN the date is queried for points
- THEN no tournament_points rows exist for it

### Requirement: Terminate Winner Determination

At terminate (see tournament-management), the system MUST determine winners as ALL users tied at the maximum total tournament points read from persisted `tournament_points` rows, only when that maximum is greater than zero. The winner user IDs MUST be persisted on the tournament. Prize payment is a future stub: terminate MUST NOT credit balances, split pozo, or change prizes.

#### Scenario: Single winner at terminate

- GIVEN a finished tournament where one user holds the maximum points
- WHEN the tournament is terminated
- THEN that user is persisted as the sole winner

#### Scenario: Tied users all win

- GIVEN three users tied at the maximum points
- WHEN the tournament is terminated
- THEN all three are persisted as winners

#### Scenario: No points, no winners

- GIVEN no user has points greater than zero
- WHEN the tournament is terminated
- THEN no winners are persisted

#### Scenario: Terminate pays nothing

- GIVEN a terminated tournament with persisted winners
- THEN no user balance or prize field changes
