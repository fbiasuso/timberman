# Prize Payouts — Specification

## Purpose

Winner determination, equal pozo split, balance credits, unpaid-pozo carryover, and payout visibility for real-money prode prizes.

## Requirements

### Requirement: Winner Determination

On publish-results the system MUST determine winners as the ticket(s) with the maximum correct-prediction count, only when that maximum is greater than zero.

#### Scenario: Single winner

- GIVEN a closed date where one ticket has 3 correct predictions and all others fewer
- WHEN results are published
- THEN the 3-correct ticket is the only winner

#### Scenario: Tied winners

- GIVEN two tickets with the same maximum of 2 correct predictions
- WHEN results are published
- THEN both tickets are winners

#### Scenario: No correct predictions

- GIVEN no ticket has more than 0 correct predictions
- WHEN results are published
- THEN there are no winners
- AND no balance is credited

### Requirement: Equal Pozo Split

The pozo MUST be split equally among winners in integer cents; the leftover remainder MUST go to the first winning ticket.

#### Scenario: Odd split with remainder

- GIVEN a pozo of $10.00 (1000 cents) and 3 winners
- WHEN payouts are computed
- THEN the first winner receives 334 cents and the other two receive 333 cents each
- AND the sum of payouts equals the full pozo (1000 cents)

#### Scenario: Exact division

- GIVEN a pozo of $9.00 (900 cents) and 3 winners
- WHEN payouts are computed
- THEN each winner receives exactly 300 cents

#### Scenario: Single winner receives full pozo

- GIVEN a pozo of $7.50 (750 cents) and one winner
- WHEN payouts are computed
- THEN the winner receives the full 750 cents

### Requirement: Balance Credits

Winners MUST have the payout credited to their balance. Points keep working independently (money and points coexist).

#### Scenario: Winner credited

- GIVEN a winner with balance 500 cents and payout 334 cents
- WHEN results are published
- THEN the winner's balance is 834 cents

### Requirement: Publish Idempotency

Re-submitting publish-results for an already-published date MUST NOT double-pay winners or re-credit anything.

#### Scenario: Duplicate publish rejected

- GIVEN a date already in results-published status with payouts credited
- WHEN publish-results is submitted again
- THEN the request is rejected or has no effect
- AND no balance is credited twice

### Requirement: Carryover on No Winners

When no ticket has correct predictions, the pozo MUST NOT be paid; it MUST be added to `tournaments.carryover` (integer cents, default 0) and shown as accumulated pozo in the Cartelera.

#### Scenario: Pozo rolls to carryover

- GIVEN a closed date with pozo 1500 cents and zero correct predictions
- WHEN results are published
- THEN no balances change
- AND the tournament's carryover increases by 1500 cents

### Requirement: Payout Visibility

Winning tickets MUST show "Premio ganado" with the credited amount in the user's "Mis Tickets" view.

#### Scenario: Premio ganado displayed

- GIVEN a user with a winning ticket on a published date
- WHEN the user opens Mis Tickets
- THEN the ticket shows "Premio ganado" and the credited amount

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
