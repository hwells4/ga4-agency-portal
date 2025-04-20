import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import {
  getMyAgencyClientsAction,
  createAgencyClientAction,
  updateAgencyClientAction,
  deleteAgencyClientAction
} from "@/actions/db/agency-clients-actions" // Adjust path if needed
import { InsertAgencyClient, SelectAgencyClient, agencyClientsTable } from "@/db/schema/agency-clients-schema" // Adjust path if needed
import { agenciesTable } from "@/db/schema/agencies-schema" // Needed for seeding
import { db as realDb } from "@/db/db" // Assuming this is your configured Drizzle client
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Need to import all tables used in the main db schema
import {
  profilesTable,
  todosTable,
  credentialsTable
} from "@/db/schema"

// --- Test Setup ---

// Real Clerk User IDs provided by user
const USER_A_ID = "user_2vyrgCUhbrEWtju2x2ewANSDiHv"
const USER_B_ID = "user_2vyrigSIaJkvfros8cKrhmLcr3j"
const USER_C_ID = "user_c_clerk_id_no_agency" // Placeholder for a user without an agency

// Placeholder IDs - These should be generated/managed by your seeding logic
// Using simple strings for now, replace with actual UUIDs if needed by your logic
const AGENCY_A_ID = "test-agency-a-id"
const AGENCY_B_ID = "test-agency-b-id"

const CLIENT_A1_ID = "test-client-a1-id"
const CLIENT_A2_ID = "test-client-a2-id"
const CLIENT_B1_ID = "test-client-b1-id"

// Mock Clerk's auth function
// We'll set the userId dynamically in beforeEach/it blocks
const mockAuth = vi.fn(() => ({ userId: null as string | null }))
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth // Use the mock function instance directly
}))

// Mock the RLS helpers if necessary, or ensure they work with the test DB/context
// vi.mock("@/actions/db/rls-helpers", async () => { ... }); // If deep mocking is needed

// Database Client for Tests
let testDb: typeof realDb // Use the same type as your main db client
let testSqlClient: postgres.Sql

// --- Helper Functions for DB Interaction (Implement these!) ---

async function connectTestDb() {
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL environment variable is not set.")
  }
  testSqlClient = postgres(connectionString, { max: 1 }) // Use max 1 for simplicity in tests
  // Ensure the schema here matches the one used in the main db export
  testDb = drizzle(testSqlClient, { schema: {
    profiles: profilesTable,
    todos: todosTable,
    agencies: agenciesTable,
    agencyClients: agencyClientsTable,
    credentials: credentialsTable
  } })
  console.log("Connected to test database.")
}

async function disconnectTestDb() {
  if (testSqlClient) {
    await testSqlClient.end()
    console.log("Disconnected from test database.")
  }
}

// You MUST implement this based on your needs
async function seedTestData() {
  console.log("Seeding test data...")
  if (!testDb) throw new Error("Test DB not connected for seeding")

  try {
    // Seed Agency A linked to User A
    await testDb.insert(agenciesTable).values({
      id: AGENCY_A_ID,
      userId: USER_A_ID,
      name: "Agency A",
      // Add other required agency fields
    }).onConflictDoNothing() // Prevent errors if run multiple times

    // Seed Agency B linked to User B
    await testDb.insert(agenciesTable).values({
      id: AGENCY_B_ID,
      userId: USER_B_ID,
      name: "Agency B",
      // Add other required agency fields
    }).onConflictDoNothing()

    // Seed Client A1 for Agency A
    await testDb.insert(agencyClientsTable).values({
      id: CLIENT_A1_ID,
      agencyId: AGENCY_A_ID,
      clientIdentifier: "client-a1",
      clientName: "Client A1 Name",
      ga4PropertyId: "prop-a1",
      credentialStatus: "pending"
    }).onConflictDoNothing()

    // Seed Client A2 for Agency A
    await testDb.insert(agencyClientsTable).values({
      id: CLIENT_A2_ID,
      agencyId: AGENCY_A_ID,
      clientIdentifier: "client-a2",
      clientName: "Client A2 Name",
      ga4PropertyId: "prop-a2",
      credentialStatus: "pending"
    }).onConflictDoNothing()

    // Seed Client B1 for Agency B
    await testDb.insert(agencyClientsTable).values({
      id: CLIENT_B1_ID,
      agencyId: AGENCY_B_ID,
      clientIdentifier: "client-b1",
      clientName: "Client B1 Name",
      ga4PropertyId: "prop-b1",
      credentialStatus: "pending"
    }).onConflictDoNothing()

    console.log("Test data seeded.")
  } catch (error) {
    console.error("Error seeding test data:", error)
    throw error // Fail the test run if seeding fails
  }
}

// You MUST implement this to clean up data between tests
async function cleanupTestData() {
  console.log("Cleaning up test data...")
   if (!testDb) throw new Error("Test DB not connected for cleanup")
  try {
    // Delete in reverse order of creation due to potential FK constraints
    await testDb.delete(agencyClientsTable)
    await testDb.delete(agenciesTable)
    console.log("Test data cleaned up.")
  } catch (error) {
      console.error("Error cleaning up test data:", error)
      throw error
  }
}

describe("Agency Client Server Actions RLS Tests", () => {
  // --- Database Setup & Teardown ---

  beforeAll(async () => {
    // Connect to the test database (Ensure globalSetup ran first)
    await connectTestDb()
  })

  afterAll(async () => {
    // Disconnect from the test database
    await disconnectTestDb()
  })

  beforeEach(async () => {
    // Clean up *before* seeding to ensure a fresh state for each test
    await cleanupTestData()
    // Seed the database with test data
    await seedTestData()
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Optional: Cleanup after each test if needed, but cleanup before is often safer
    // await cleanupTestData();

    // Reset the auth mock to default (no user)
    mockAuth.mockReturnValue({ userId: null }) // Reset the original mock instance
  })

  // --- Test Cases ---

  describe("getMyAgencyClientsAction", () => {
    it("Test 1: User A should only retrieve clients for Agency A", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await getMyAgencyClientsAction()

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(2) // Assuming Client A1 and A2 are seeded
      expect(result.data?.some(c => c.id === CLIENT_A1_ID)).toBe(true)
      expect(result.data?.some(c => c.id === CLIENT_A2_ID)).toBe(true)
      expect(result.data?.some(c => c.id === CLIENT_B1_ID)).toBe(false)
    })

    it("Test 2: User B should only retrieve clients for Agency B", async () => {
      // Context: Simulate login as User B
      mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance

      // Action
      const result = await getMyAgencyClientsAction()

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(1) // Assuming Client B1 is seeded
      expect(result.data?.some(c => c.id === CLIENT_B1_ID)).toBe(true)
      expect(result.data?.some(c => c.id === CLIENT_A1_ID)).toBe(false)
      expect(result.data?.some(c => c.id === CLIENT_A2_ID)).toBe(false)
    })

    it("Test 3: User C (no agency) should retrieve nothing", async () => {
      // Context: Simulate login as User C
      mockAuth.mockReturnValue({ userId: USER_C_ID }) // Update the original mock instance

      // Action
      const result = await getMyAgencyClientsAction()

      // Expected Result (Option 1: Empty array)
      // Adjust based on your withRLSRead implementation if it errors
      expect(result.isSuccess).toBe(true) // Or false if it throws an error
      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(0)
      // If it errors: expect(result.message).toContain("Unauthorized");
    })
  })

  describe("createAgencyClientAction", () => {
    const newClientData: Omit<InsertAgencyClient, "agencyId" | "id" | "createdAt" | "updatedAt"> = {
      clientIdentifier: "new-client-test",
      clientName: "New Test Client",
      ga4PropertyId: "123456789",
      // Add other required fields as needed
    }

    it("Test 4: User A should successfully create a client for Agency A", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await createAgencyClientAction(newClientData)

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.clientIdentifier).toBe(newClientData.clientIdentifier)
      expect(result.data?.agencyId).toBe(AGENCY_A_ID) // CRITICAL: Verify agencyId is set correctly by withRLS

      // Verification (Optional: direct DB check if needed)
      // const dbCheck = await queryDbDirectly(result.data?.id);
      // expect(dbCheck?.agencyId).toBe(AGENCY_A_ID);
    })

    it("Test 5: User B should successfully create a client for Agency B", async () => {
      // Context: Simulate login as User B
      mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance

      // Action
      const result = await createAgencyClientAction(newClientData)

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.agencyId).toBe(AGENCY_B_ID) // CRITICAL: Verify agencyId

      // Verification (Optional)
    })

    // Optional: Test case for User C trying to create (should fail if withRLS checks agency association)
  })

  describe("updateAgencyClientAction", () => {
    const updateData: Partial<InsertAgencyClient> = {
      clientName: "Updated Client Name"
    }

    it("Test 6: User A should successfully update their own agency's client (Client A1)", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await updateAgencyClientAction(CLIENT_A1_ID, updateData)

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.clientName).toBe(updateData.clientName)
      expect(result.data?.id).toBe(CLIENT_A1_ID)

      // Verification (Optional: check DB)
    })

    it("Test 7: User A should FAIL to update another agency's client (Client B1)", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await updateAgencyClientAction(CLIENT_B1_ID, updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i) // Or similar RLS error message

      // Verification (Optional: check DB that B1 is unchanged)
    })

    it("Test 8: User A should FAIL to update a non-existent client", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await updateAgencyClientAction("non-existent-uuid", updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i)
    })

    // Add similar tests for User B (can update B1, cannot update A1)
    it("User B should successfully update their own agency's client (Client B1)", async () => {
      mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance
      const result = await updateAgencyClientAction(CLIENT_B1_ID, { clientName: "User B Update" })
      expect(result.isSuccess).toBe(true)
      expect(result.data?.clientName).toBe("User B Update")
    })

    it("User B should FAIL to update another agency's client (Client A1)", async () => {
        mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance
        const result = await updateAgencyClientAction(CLIENT_A1_ID, updateData)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })

  })

  describe("deleteAgencyClientAction", () => {
    it("Test 9: User A should successfully delete their own agency's client (Client A2)", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await deleteAgencyClientAction(CLIENT_A2_ID)

      // Expected Result
      expect(result.isSuccess).toBe(true)
      expect(result.message).toMatch(/deleted successfully/i)

      // Verification (Optional: Query DB or call getMyAgencyClientsAction again)
      // const checkResult = await getMyAgencyClientsAction(); // Still logged in as User A
      // expect(checkResult.data?.some(c => c.id === CLIENT_A2_ID)).toBe(false);
    })

    it("Test 10: User A should FAIL to delete another agency's client (Client B1)", async () => {
      // Context: Simulate login as User A
      mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

      // Action
      const result = await deleteAgencyClientAction(CLIENT_B1_ID)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i)

      // Verification (Optional: check DB that B1 still exists)
    })

    it("Test 11: User A should FAIL to delete a non-existent client", async () => {
       // Context: Simulate login as User A
       mockAuth.mockReturnValue({ userId: USER_A_ID }) // Update the original mock instance

       // Action
       const result = await deleteAgencyClientAction("non-existent-uuid")

       // Expected Result
       expect(result.isSuccess).toBe(false)
       expect(result.message).toMatch(/not found or access denied/i)
    })

    // Add similar tests for User B (can delete B1, cannot delete A1/A2)
     it("User B should successfully delete their own agency's client (Client B1)", async () => {
        mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance
        const result = await deleteAgencyClientAction(CLIENT_B1_ID)
        expect(result.isSuccess).toBe(true)
     })

      it("User B should FAIL to delete another agency's client (Client A1)", async () => {
        mockAuth.mockReturnValue({ userId: USER_B_ID }) // Update the original mock instance
        const result = await deleteAgencyClientAction(CLIENT_A1_ID)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })
  })
}) 