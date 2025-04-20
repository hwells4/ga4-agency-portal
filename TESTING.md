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
    b.  Runs `npx drizzle-kit migrate --config=drizzle.config.test.ts` to apply all migrations from `db/migrations` to the *test* database inside the Docker container.
4.  Vitest discovers and runs your test files (e.g., `actions/__tests__/db/agency-clients-actions.test.ts`).
5.  Inside a test file:
    a.  `beforeAll` connects a Drizzle client instance (`testDb`) to the test database (`TEST_DATABASE_URL`).
    b.  `beforeEach` cleans up data from previous runs (`cleanupTestData`) and then seeds necessary data for the current test (`seedTestData`), like agencies and clients.
    c.  `beforeEach` also resets any mocks (like the Clerk `auth` mock).
    d.  Individual `it` blocks run:
        i.  The Clerk `auth` mock is configured to simulate a specific logged-in user (`mockAuth.mockReturnValue(...)`).
        ii. The server action under test is called.
        iii. Assertions (`expect(...)`) verify the action's return value and potentially the database state.
    e.  `afterAll` disconnects the Drizzle test client.
6.  After all test files complete, Vitest executes the teardown function returned by `globalSetup`.
7.  The teardown function stops and removes the test database container via `docker compose -f docker-compose.test.yml down -v`.

## 7. Writing Tests

- **Location:** Place test files parallel to the code they test, within an `__tests__` directory (e.g., `actions/__tests__/db/agency-clients-actions.test.ts`).
- **Clerk Mocking:** Use the pattern established in `agency-clients-actions.test.ts`:
  ```typescript
  const mockAuth = vi.fn(() => ({ userId: null as string | null }));
  vi.mock("@clerk/nextjs/server", () => ({
    auth: mockAuth
  }));

  // Inside tests or beforeEach:
  mockAuth.mockReturnValue({ userId: USER_A_ID });
  ```
- **Database Interaction:** Use the helper functions (`connectTestDb`, `disconnectTestDb`, `seedTestData`, `cleanupTestData`) defined in the test file. Use the `testDb` instance for all database operations within tests.
- **Seeding:** Ensure `seedTestData` creates all necessary prerequisite data (including parent records like Agencies) for the actions being tested.
- **Cleanup:** `cleanupTestData` should remove data in the reverse order of creation to avoid foreign key constraint violations.

## 8. Database Management & Syncing

- **Ephemeral Database:** The test database is temporary. It's created from scratch when tests start and destroyed when they finish.
- **Schema Synchronization:** The test database schema is kept synchronized with your production/development schema automatically. This happens because the `globalSetup` script **always runs your existing Drizzle migration files** (`db/migrations/*`) against the fresh test database using `npx drizzle-kit migrate`. Any schema changes you create and migrate for your main database will be automatically reflected in the test database the next time `npm run test` is executed.

## 9. Troubleshooting

- **`Cannot connect to the Docker daemon`:** Ensure Docker Desktop (or the Docker service) is running before executing `npm run test`.
- **`relation "..." does not exist`:** This usually means migrations failed to run correctly against the test database.
  - Check the output logs from `npm run test` for errors during the "Running migrations" step.
  - Verify `drizzle.config.test.ts` is correct and points to the `TEST_DATABASE_URL`.
  - Ensure your migration files in `db/migrations` are valid.
- **`TEST_DATABASE_URL is not set`:** Make sure the `.env.test` file exists in the project root and contains the correct `TEST_DATABASE_URL` variable.
- **`TypeError: ...mockReturnValue is not a function`:** Ensure you are using the `mockAuth` pattern correctly as shown in section 7.
- **Seeding/Cleanup Errors:** Debug the SQL or logic within your `seedTestData` and `cleanupTestData` functions. 