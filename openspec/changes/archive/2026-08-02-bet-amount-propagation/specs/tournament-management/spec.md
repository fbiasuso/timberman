# Delta for Tournament Management

## ADDED Requirements

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
