# User Authentication — Specification

## Purpose

User registration, login, JWT session management, and admin-only registration mode for the timberman betting pool.

## Requirements

### Requirement: User Registration

The system MUST allow new users to register with a unique username and a password hashed with bcrypt.

#### Scenario: Successful self-registration

- GIVEN the system is in self-registration mode
- WHEN a new user submits a username and password meeting validation rules
- THEN the system creates the user with a bcrypt-hashed password
- AND returns a success response without exposing the password

#### Scenario: Duplicate username rejected

- GIVEN an existing user with username "player1"
- WHEN a new registration request uses "player1"
- THEN the system MUST reject with a 409 Conflict error
- AND the existing account MUST remain unchanged

#### Scenario: Registration disabled in admin-only mode

- GIVEN the system is configured with admin-only registration mode
- WHEN an unauthenticated user attempts to register
- THEN the system MUST reject with a 403 Forbidden error

### Requirement: User Login

The system MUST authenticate users by verifying the password against the stored bcrypt hash and issue a signed JWT.

#### Scenario: Successful login

- GIVEN a registered user with correct credentials
- WHEN the user submits their username and password
- THEN the system returns a JWT containing user ID, username, and role
- AND the JWT MUST have a configurable expiration time

#### Scenario: Invalid credentials rejected

- GIVEN a registered user
- WHEN the user submits an incorrect password
- THEN the system MUST reject with 401 Unauthorized
- AND MUST NOT reveal whether the username exists

### Requirement: JWT Session Validation

The system MUST validate the JWT on every protected route and reject expired or malformed tokens.

#### Scenario: Valid token grants access

- GIVEN a valid non-expired JWT
- WHEN a protected route is called with the token in the Authorization header
- THEN the request proceeds with the authenticated user context

#### Scenario: Expired token rejected

- GIVEN an expired JWT
- WHEN a protected route is called with the expired token
- THEN the system MUST return 401 Unauthorized with an expiry message

#### Scenario: Malformed token rejected

- GIVEN a string that is not a valid JWT
- WHEN a protected route is called with this string
- THEN the system MUST return 401 Unauthorized

### Requirement: Admin Registration Toggle

The system SHOULD support a configuration toggle to switch between self-registration and admin-only registration.

#### Scenario: Toggle from self-registration to admin-only

- GIVEN the system is in self-registration mode
- WHEN an admin updates the registration mode config
- THEN new self-registrations are blocked
- AND existing users remain unaffected
