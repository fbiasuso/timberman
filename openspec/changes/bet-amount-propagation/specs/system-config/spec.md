# Delta for System Configuration

## MODIFIED Requirements

### Requirement: Config Update Persists

Admins MUST be able to update any config value; the update MUST be persisted to the table and reflected immediately in live reads (shared reference, no restart). A `defaultBetAmount` update MUST persist the config row regardless of the date-propagation outcome: blocked ticketed dates MUST NOT fail the update.
(Previously: updates persisted with no propagation semantics)

#### Scenario: Update survives restart

- GIVEN a persisted config with commission 10%
- WHEN an admin updates commission to 15%
- THEN the row is persisted
- AND after a server restart the loaded commission is 15%

#### Scenario: Live reference

- GIVEN config updated to allowRegistration false
- WHEN a registration request arrives immediately after the update
- THEN the request is blocked (see user-auth)

#### Scenario: Config persists when dates are blocked

- GIVEN an open date with tickets
- WHEN an admin updates defaultBetAmount
- THEN the system_config row stores the new amount
- AND the ticketed date keeps its old amount

### Requirement: Default Bet Amount in Cents

The default bet amount MUST be stored and exposed in integer cents. When an admin changes `defaultBetAmount`, the system MUST propagate the new amount to all open dates without tickets across all active tournaments (via `findOpenMatchDates()`); open dates with tickets MUST keep the old amount. Dates created after the change snapshot the new default at creation (see tournament-management).
(Previously: only the cents representation; no propagation)

#### Scenario: Cents representation

- GIVEN config with defaultBetAmount 1000
- WHEN the client reads the default bet amount
- THEN the value is 1000 ($10.00) with no floating-point conversion

#### Scenario: Ticket-free open dates take the new default

- GIVEN open dates A and B without tickets, both with betAmount 1000
- WHEN the default bet amount changes to 1500
- THEN A and B are updated to 1500
- AND the config stores 1500 cents

#### Scenario: Ticketed open date keeps its amount

- GIVEN an open date with tickets and betAmount 1000
- WHEN the default bet amount changes to 1500
- THEN the date's betAmount remains 1000
