# System Configuration — Specification

## Purpose

Persisted system-wide configuration (commission rate, registration mode, default bet amount) loaded at boot and updated live by admins.

## Requirements

### Requirement: Persisted SystemConfig

The system MUST persist system configuration in a single-row `system_config` table (id=1) holding commission percent, allowRegistration flag, and default bet amount in integer cents. At boot the system MUST load the row and fall back to built-in DEFAULTS when absent.

#### Scenario: Boot loads persisted config

- GIVEN a database with an existing system_config row (commission 15, allowRegistration false, defaultBet 1000)
- WHEN the server boots
- THEN the loaded config matches the persisted values
- AND all downstream reads use this loaded config

#### Scenario: Empty table falls back to defaults

- GIVEN a database with no system_config row
- WHEN the server boots
- THEN the system uses built-in DEFAULTS
- AND seeds a default row (see Seed Default Config Row)

### Requirement: Seed Default Config Row

On boot the system MUST ensure the default config row exists (upsert id=1) so databases created before this feature never crash.

#### Scenario: Old database bootstrapped

- GIVEN an existing database that predates the system_config table
- WHEN the server boots after migration
- THEN the default row (id=1) is inserted automatically
- AND the server serves requests without manual seeding

### Requirement: Config Update Persists

Admins MUST be able to update any config value; the update MUST be persisted to the table and reflected immediately in live reads (shared reference, no restart).

#### Scenario: Update survives restart

- GIVEN a persisted config with commission 10%
- WHEN an admin updates commission to 15%
- THEN the row is persisted
- AND after a server restart the loaded commission is 15%

#### Scenario: Live reference

- GIVEN config updated to allowRegistration false
- WHEN a registration request arrives immediately after the update
- THEN the request is blocked (see user-auth)

### Requirement: Default Bet Amount in Cents

The default bet amount MUST be stored and exposed in integer cents.

#### Scenario: Cents representation

- GIVEN config with defaultBetAmount 1000
- WHEN the client reads the default bet amount
- THEN the value is 1000 ($10.00) with no floating-point conversion
