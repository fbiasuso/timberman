# Delta for System Configuration

## MODIFIED Requirements

### Requirement: Default Bet Amount in Cents

The default bet amount MUST be stored and exposed in integer cents. When an admin changes `defaultBetAmount`, the system MUST propagate the new amount to all open ticket-free dates of the ACTIVE tournament (status 'active') via `findOpenMatchDates()`; open dates of 'finished' or 'archived' tournaments MUST keep their amount and MUST NOT be listed as updated or blocked. Open dates with tickets MUST keep the old amount. Dates created after the change snapshot the new default at creation (see tournament-management).
(Previously: propagated to open ticket-free dates across all tournaments)

#### Scenario: Cents representation

- GIVEN config with defaultBetAmount 1000
- WHEN the client reads the default bet amount
- THEN the value is 1000 ($10.00) with no floating-point conversion

#### Scenario: Ticket-free open dates in the active tournament take the new default

- GIVEN open dates A and B without tickets in the active tournament, both with betAmount 1000
- WHEN the default bet amount changes to 1500
- THEN A and B are updated to 1500
- AND the config stores 1500 cents

#### Scenario: Ticketed open date keeps its amount

- GIVEN an open date with tickets and betAmount 1000
- WHEN the default bet amount changes to 1500
- THEN the date's betAmount remains 1000

#### Scenario: Non-active tournament dates untouched

- GIVEN an open ticket-free date in a 'finished' tournament
- WHEN the default bet amount changes
- THEN that date keeps its amount
- AND it is neither updated nor reported as blocked
