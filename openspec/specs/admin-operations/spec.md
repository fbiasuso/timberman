# Admin Operations — Specification

## Purpose

Administrative functions: user management, balance adjustments, match results entry, and system configuration.

## Requirements

### Requirement: Admin Authorization

All admin operations MUST require a JWT with the `admin` role. Non-admin tokens MUST be rejected.

#### Scenario: Admin access granted

- GIVEN a JWT with role "admin"
- WHEN an admin endpoint is called
- THEN the system processes the request

#### Scenario: Non-admin access denied

- GIVEN a JWT with role "user"
- WHEN an admin endpoint is called
- THEN the system returns 403 Forbidden

### Requirement: User Management

Admins MUST be able to list all users, and create user accounts when admin-only registration mode is active.

#### Scenario: List all users

- GIVEN an authenticated admin
- WHEN the admin requests the user list
- THEN the system returns all users with username, role, balance, and registration date
- AND passwords are never included in the response

#### Scenario: Admin creates user

- GIVEN admin-only registration mode is active
- WHEN an admin creates a user account with username and initial balance
- THEN the system creates the user with a temporary password or invite token
- AND the user can log in and change their password

### Requirement: Balance Adjustment

Admins MUST be able to add or subtract balance from any user's account, with an audit trail.

#### Scenario: Admin adjusts user balance

- GIVEN an authenticated admin and a target user
- WHEN the admin submits a balance adjustment with amount and reason
- THEN the target user's balance is updated
- AND the adjustment is recorded in an audit log with admin ID, timestamp, amount, and reason

### Requirement: Match Results Entry

Admins MUST be able to enter or update match results for a closed tournament date.

#### Scenario: Enter match results

- GIVEN a tournament date in "closed" status
- WHEN an admin submits final scores for each match on that date
- THEN the date transitions to "results-published"
- AND points are calculated and distributed

#### Scenario: Re-enter results

- GIVEN a date in "results-published" status
- WHEN an admin submits corrected results
- THEN the system recalculates points for all affected bets
- AND the previous results are replaced

### Requirement: System Configuration

Admins MUST be able to view and update system-wide configuration settings.

#### Scenario: Update commission percentage

- GIVEN an authenticated admin
- WHEN the admin updates the commission percentage setting
- THEN all future pozo calculations use the new rate
- AND existing closed dates retain their original pozo

#### Scenario: Toggle registration mode

- GIVEN an authenticated admin
- WHEN the admin toggles between self-registration and admin-only
- THEN the change takes effect immediately
- AND does not affect existing users
