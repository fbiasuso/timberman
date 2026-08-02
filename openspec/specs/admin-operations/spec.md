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

Admins MUST be able to enter or update match results for a closed tournament date. Entering results stores the scores; the date remains "closed" until the publish-results action transitions it to "results-published" and distributes points and payouts.

#### Scenario: Enter match results

- GIVEN a tournament date in "closed" status
- WHEN an admin submits final scores for each match
- THEN the scores are stored
- AND the date stays in "closed" status

#### Scenario: Re-enter results before publish

- GIVEN a closed date with stored results
- WHEN an admin submits corrected results before publishing
- THEN the previous scores are replaced

### Requirement: System Configuration

Admins MUST be able to view and update system-wide configuration; updates MUST be persisted to the `system_config` table (see system-config) and take effect immediately.

#### Scenario: Update commission percentage

- GIVEN an authenticated admin
- WHEN the admin updates the commission percentage setting
- THEN all future closes use the new rate
- AND existing closed dates retain their snapshot

#### Scenario: Toggle registration mode

- GIVEN an authenticated admin
- WHEN the admin toggles between self-registration and admin-only
- THEN the change is persisted
- AND registration is blocked or permitted immediately (live)
- AND existing users are unaffected

### Requirement: Publish Results Route

The system MUST expose `POST /api/admin/dates/:dateId/publish-results` (admin role required) wired to the publish-results use case; it pays winners or rolls the pozo into carryover.

#### Scenario: Publish from closed status

- GIVEN a date in "closed" status with stored results
- WHEN an admin posts to the publish-results endpoint
- THEN the date transitions to "results-published"
- AND winners are paid per prize-payouts

#### Scenario: Re-submit is harmless

- GIVEN a date already in "results-published" status
- WHEN an admin posts to publish-results again
- THEN the request is rejected without any duplicate credits

#### Scenario: Non-admin rejected

- GIVEN a JWT with role "user"
- WHEN the user calls publish-results
- THEN the system returns 403 Forbidden

### Requirement: Payout Breakdown and Publish Button

After publishing, the admin Resultados view MUST show winners with amounts and the house commission; a "Publish results and pay out" button MUST appear when the date status is "closed".

#### Scenario: Breakdown after publish

- GIVEN a published date with 2 winners and commission 500 cents
- WHEN an admin opens Resultados
- THEN the view lists each winner with their credited amount
- AND shows the house commission

#### Scenario: Publish button on closed dates

- GIVEN a date with status "closed"
- WHEN an admin opens Resultados
- THEN a "Publish results and pay out" button is available

#### Scenario: Button hidden after publish

- GIVEN a date with status "results-published"
- WHEN an admin opens Resultados
- THEN the publish button is not shown

### Requirement: Partidos Date Accordion

The admin Partidos view MUST render an accordion of ALL tournament dates (from `useAdminTournaments` → TournamentDateDTO) with a "Nueva fecha" button at the top. Each date header MUST show the date number and a lock icon for 'closed' dates or a "$" icon for 'results' (paid) dates.

#### Scenario: Accordion lists all dates

- GIVEN a tournament with closed and results dates
- WHEN an admin opens Partidos
- THEN every date appears as an accordion row
- AND each header shows the date number with its status icon

#### Scenario: Nueva fecha button creates date

- GIVEN the Partidos accordion with no open date
- WHEN an admin clicks "Nueva fecha"
- THEN the system calls the create-date endpoint
- AND the new date appears in the accordion

### Requirement: Open Date Match Editing

In Partidos, expanding a date in 'open' status MUST render editable match fields with a real save via PATCH match details, plus an "Agregar partido" form that creates matches via POST. Expanding 'closed' or 'results' dates MUST render matches and results as view-only.

#### Scenario: Edit open-date match and save

- GIVEN the accordion expanded on the open date
- WHEN an admin edits a match field and saves
- THEN the system calls the match-details PATCH endpoint
- AND the updated value persists

#### Scenario: Add match to open date

- GIVEN the accordion expanded on the open date
- WHEN an admin submits the "Agregar partido" form
- THEN the system calls the create-match endpoint
- AND the new match appears in the expanded date

#### Scenario: Closed date is view-only

- GIVEN the accordion expanded on a 'closed' date
- WHEN an admin views its matches
- THEN matches render read-only with results
- AND no edit or add controls appear
