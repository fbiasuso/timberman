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
