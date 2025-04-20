# Testing Guide

This document describes the testing setup for the GA4 Agency Portal backend, focusing on unit and integration tests for server actions, especially those involving Row Level Security (RLS).

## 1. Overview

The goal of this testing setup is to ensure the correctness and security of our server-side logic, particularly database interactions and authentication/authorization rules enforced by Clerk and RLS policies.

We use Vitest as our test runner, Docker Compose to manage an isolated PostgreSQL test database, and Drizzle ORM for database interactions within tests.

## 2. Technology Stack

- **Test Runner:** [Vitest](https://vitest.dev/)
- **Test Database:** [PostgreSQL](https://www.postgresql.org/) (via Docker)
- **Container Orchestration:** [Docker Compose](https://docs.docker.com/compose/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication Mocking:** Vitest's mocking features (`vi.mock`)

## 3. Prerequisites

Before running tests, ensure you have the following installed and running:

- **Node.js:** (Version compatible with the project)
- **npm:** (Or your preferred package manager)
- **Docker Desktop:** (Or Docker Engine + Docker Compose CLI) - Must be running.

## 4. Configuration

Several files configure the testing environment:

- **`.env.test`:** (Create this file in the project root)
  - Must contain the database connection string for the *test* database:
    ```env
    TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5433/test_db"
    ```
- **`vitest.config.ts`:** (Project root)
  - Configures Vitest, sets the test environment (node), enables global test functions, configures path aliases (`@/*`), and points to the global setup file.
- **`docker-compose.test.yml`:** (Project root)
  - Defines the PostgreSQL service (`postgres_test`) used for testing.
  - Specifies the Docker image, environment variables (DB name, user, password), port mapping (5433:5432), and health checks.
- **`drizzle.config.test.ts`:** (Project root)
  - Drizzle Kit configuration specifically for the test environment.
  - Reads `TEST_DATABASE_URL` from `.env.test` to ensure migration commands target the correct test database.
- **`tests/setup/globalSetup.ts`:**
  - A script run *once* by Vitest before all tests.
  - Loads `.env.test`.
  - Uses `docker compose` to start the test database container.
  - Uses `drizzle-kit migrate` (with `drizzle.config.test.ts`) to apply migrations to the test database.
  - Exports a teardown function.
- **Teardown Function (within `globalSetup.ts`):**
  - Run *once* by Vitest after all tests.
  - Uses `docker compose` to stop and remove the test database container and its volume.

## 5. Running Tests

Use the following npm scripts defined in `package.json`:

- **Run all tests once:**
  ```bash
  npm run test
  ```
- **Run tests in watch mode (reruns on file changes):**
  ```bash
  npm run test:watch
  ```

## 6. How It Works (The Flow)

1.  You execute `npm run test`.
2.  Vitest starts and executes the script defined in `globalSetup` (`tests/setup/globalSetup.ts`).
3.  `globalSetup.ts`:
    a.  Starts the `postgres_test` container via `docker compose -f docker-compose.test.yml up -d --wait`.
    b.  Runs `npx drizzle-kit migrate --config=drizzle.config.test.ts` to apply all migrations from `db/migrations` to the *test* database inside the Docker container. This includes applying the RLS policies defined in your schema.
4.  Vitest discovers and runs your unit test files (e.g., `actions/__tests__/db/agency-clients-actions.test.ts`).
5.  Inside a unit test file (like `agency-clients-actions.test.ts`):
    a.  `beforeAll` connects a Drizzle client instance (`testDb`) to the test database (`TEST_DATABASE_URL`). This `testDb` is used primarily for *seeding and cleanup* within the tests.
    b.  `vi.mock` is used to intercept imports for external dependencies like `@clerk/nextjs/server`, `next/cache`, and critically, `@/actions/db/rls-helpers`.
    c.  The Clerk mock (`mockAuthFn`) allows simulating different logged-in users.
    d.  The RLS helper mock simulates the outcome of RLS checks (e.g., determining the user's agency ID, simulating blocks based on logic within the mock).
    e.  `beforeEach` cleans up data (`cleanupTestData`) and then seeds necessary data (`seedTestData`) using the `testDb` instance.
    f.  Individual `it` blocks run:
        i.  The Clerk mock is configured (`mockAuthFn.mockReturnValue(...)`).
        ii. The server action under test is called.
        iii. Because the RLS helpers are mocked, the action runs the mocked wrapper logic. This logic determines the agency ID based on the mocked user and then executes the core database operation logic *passed into the wrapper* using the `testDb` instance.
        iv. Assertions (`expect(...)`) verify the action's return value based on the *simulated* RLS behavior provided by the mocks.
    g.  `afterAll` disconnects the Drizzle test client.
6.  After all test files complete, Vitest executes the teardown function returned by `globalSetup`.
7.  The teardown function stops and removes the test database container.

## 7. Writing Unit Tests

- **Location:** Place test files parallel to the code they test, within an `__tests__` directory.
- **Clerk Mocking:** Use the pattern with `vi.fn()` defined before `vi.mock("@clerk/nextjs/server", ...)`.
- **RLS Helper Mocking:** The mock for `@/actions/db/rls-helpers` simulates the outcome of RLS checks based on the mocked user ID. See `agency-clients-actions.test.ts` for the pattern. Note the limitations described below.
- **Database Interaction:** Use helper functions (`connectTestDb`, `disconnectTestDb`, `seedTestData`, `cleanupTestData`) and the `testDb` instance for setup and teardown within tests. The actual database operations within the actions run via the mocked RLS wrappers using this `testDb`.
- **Seeding & Cleanup:** Ensure `seedTestData` creates necessary prerequisite data and `cleanupTestData` removes it correctly.

## 8. Database Management & Syncing

- **Ephemeral Database:** The test database is temporary and reset for each full test run.
- **Schema Synchronization:** The test database schema is kept synchronized automatically via migrations run by `globalSetup.ts`.

## 9. Troubleshooting

- **`Cannot connect to the Docker daemon`:** Ensure Docker Desktop is running.
- **`relation "..." does not exist`:** Check migration status and `drizzle.config.test.ts`.
- **`TEST_DATABASE_URL is not set`:** Ensure `.env.test` exists and is configured.
- **Mocking Errors (`ReferenceError`, etc.):** Review `vi.mock` syntax, variable hoisting, and ensure mocks are correctly defined before use.
- **Seeding/Cleanup Errors:** Debug SQL/logic in helper functions.

## 10. Limitations & Required Integration Tests

While these unit tests provide valuable feedback on the internal logic of server actions in isolation, they have limitations, particularly regarding Row Level Security (RLS):

- **RLS Simulation:** The mock for `@/actions/db/rls-helpers` *simulates* the outcome of RLS checks based on the mocked user ID. It does *not* involve the actual database RLS mechanism (`SET app.current_agency_id = ...`) being invoked via the real `executeWithAgencyContext` function.
- **Mock Accuracy:** The accuracy of the RLS simulation depends entirely on the mock implementation. If the real RLS helpers or database policies change, the mock must be updated manually.
- **Delete Operation Gap:** As observed in `agency-clients-actions.test.ts` (specifically tests 10 and the corresponding User B test), reliably simulating the RLS block for DELETE operations within the unit test mock is challenging without making the mock overly complex or brittle. These specific unit tests are currently skipped.

**Therefore, it is CRUCIAL to supplement these unit tests with Integration Tests that specifically validate the RLS functionality end-to-end.**

### Required Integration Tests:

Integration tests should:
1.  Use the same test database setup (Docker, migrations via `globalSetup`).
2.  Use the **real** RLS helper functions (`withRLS`, `withRLSRead`) and the underlying `executeWithAgencyContext`. **Do NOT mock `@/actions/db/rls-helpers`.**
3.  Mock Clerk minimally (just enough to provide a `userId`).
4.  Seed data for multiple distinct agencies and their clients.
5.  Test scenarios like:
    -   User A attempting to read/update/**delete** clients belonging to User B (should fail).
    -   User B attempting to read/update/**delete** clients belonging to User A (should fail).
    -   Users successfully performing actions on their *own* agency's clients.
    -   Actions performed by a user not associated with any agency (should fail writes, reads return empty/fail depending on policy).

These integration tests are necessary to confirm that the database RLS policies and the `executeWithAgencyContext` function work together correctly to enforce data isolation. 