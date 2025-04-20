import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import {
  getMyAgencyClientsAction,
  createAgencyClientAction,
  updateAgencyClientAction,
  deleteAgencyClientAction
} from "@/actions/db/agency-clients-actions" // Adjust path if needed
import { InsertAgencyClient, SelectAgencyClient, agencyClientsTable } from "@/db/schema/agency-clients-schema" // Adjust path if needed
import { agenciesTable } from "@/db/schema/agencies-schema" // Needed for seeding
// We will mock the main db instance used by helpers
// import { db as realDb } from "@/db/db" 
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Import the full schema object
import * as schema from "@/db/schema"

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
// Using simple strings for now, replace with actual UUIDs if needed
const AGENCY_A_ID = "test-agency-a-id"
const AGENCY_B_ID = "test-agency-b-id"

// Replace string IDs with valid UUIDs
const CLIENT_A1_ID = "11111111-1111-4111-a111-111111111111"
const CLIENT_A2_ID = "22222222-2222-4222-a222-222222222222"
const CLIENT_B1_ID = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb"
// Add a valid UUID format for the non-existent ID tests
const NON_EXISTENT_CLIENT_ID = "00000000-0000-0000-0000-000000000000"; 

// --- Mocking Clerk Auth --- 
const mockAuthFn = vi.fn(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  get auth() { return mockAuthFn; }
}));

// --- Mocking Next.js Cache --- 
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(), // Mock revalidatePath as a no-op
}));

// --- Mocking RLS Helpers --- 
vi.mock("@/actions/db/rls-helpers", async () => {
  // Define the mock logic for determining agencyId based on clerkUserId
  const determineAgencyId = (clerkUserId: string | null): string | null => {
      if (clerkUserId === USER_A_ID) return AGENCY_A_ID;
      if (clerkUserId === USER_B_ID) return AGENCY_B_ID;
      return null;
  };

  // Return the mocked implementations for the exported functions
  return {
    withRLS: vi.fn(async (operation) => {
      const authResult = await mockAuthFn(); // Use mocked auth
      const clerkUserId = authResult?.userId;
      if (!clerkUserId) return { isSuccess: false, message: "Unauthorized: No user logged in." };

      const agencyId = determineAgencyId(clerkUserId);
      if (!agencyId) {
        return { isSuccess: false, message: "Unauthorized: User not associated with an agency." };
      }
      
      // Directly execute the operation using the testDb instance
      // The operation function itself expects a transaction-like object (tx)
      // and potentially agencyId/clerkUserId depending on its signature.
      // We provide testDb as the tx object.
      console.log(`Mock withRLS: Running operation for agency: ${agencyId}`); // Debug log
      try {
        // Pass testDb as the 'tx' object to the original operation function
        return await operation(testDb, agencyId, clerkUserId); 
      } catch (error: any) { 
         console.error("Error within mocked withRLS operation:", error);
         // Return a more specific error message based on the caught error if possible
         const message = error.code === '23505' ? "Client Identifier already exists." : `Operation failed: ${error.message}`;
         return { isSuccess: false, message };
      }
    }),
    withRLSRead: vi.fn(async (operation) => {
      const authResult = await mockAuthFn(); // Use mocked auth
      const clerkUserId = authResult?.userId;
      if (!clerkUserId) return { isSuccess: false, message: "Unauthorized: No user logged in." };

      const agencyId = determineAgencyId(clerkUserId);
      if (!agencyId) {
         console.warn(`Mock withRLSRead: User ${clerkUserId} has no agency. Returning empty data.`);
         return { isSuccess: true, message: "No agency association.", data: [] }; 
      }

      // Directly execute the operation using the testDb instance
      console.log(`Mock withRLSRead: Running operation for agency: ${agencyId}`); // Debug log
       try {
         // Pass testDb as the 'tx' object to the original operation function
         return await operation(testDb);
       } catch (error: any) { 
          console.error("Error within mocked withRLSRead operation:", error);
          return { isSuccess: false, message: `Read operation failed: ${error.message}` };
       }
    }),
  };
});

// This will hold our test database instance, accessible by the mock above
let testDb: PostgresJsDatabase<typeof schema>; 

// --- REMOVED MOCK FOR @/db/db --- 

// Database Client Connection
let testSqlClient: postgres.Sql

// --- Helper Functions for DB Interaction --- 

// Connects to TEST_DATABASE_URL and initializes testDb
// Note: testDb is now only used for seeding/cleanup, not for mocking the main db
async function connectTestDb(): Promise<PostgresJsDatabase<typeof schema>> { 
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL environment variable is not set.")
  }
  testSqlClient = postgres(connectionString, { max: 1 })
  const connectedDb = drizzle(testSqlClient, { schema })
  console.log("Connected to test database.")
  return connectedDb; // Return the connected instance
}

// Disconnects the test database client
async function disconnectTestDb(db: PostgresJsDatabase<typeof schema>) { 
  if (testSqlClient) {
    await testSqlClient.end()
    console.log("Disconnected from test database.")
  }
}

// Seeds data into the provided test database instance
async function seedTestData(db: PostgresJsDatabase<typeof schema>) { 
  console.log("Seeding test data...")
  if (!db) throw new Error("Test DB not connected for seeding")

  try {
    // Seed Agency A linked to User A
    await db.insert(schema.agenciesTable).values({
      id: AGENCY_A_ID,
      userId: USER_A_ID,
      name: "Agency A",
      // Add other required agency fields
    }).onConflictDoNothing() // Prevent errors if run multiple times

    // Seed Agency B linked to User B
    await db.insert(schema.agenciesTable).values({
      id: AGENCY_B_ID,
      userId: USER_B_ID,
      name: "Agency B",
      // Add other required agency fields
    }).onConflictDoNothing()

    // Seed Client A1 for Agency A
    await db.insert(schema.agencyClientsTable).values({
      id: CLIENT_A1_ID,
      agencyId: AGENCY_A_ID,
      clientIdentifier: "client-a1",
      clientName: "Client A1 Name",
      ga4PropertyId: "prop-a1",
      credentialStatus: "pending"
    }).onConflictDoNothing()

    // Seed Client A2 for Agency A
    await db.insert(schema.agencyClientsTable).values({
      id: CLIENT_A2_ID,
      agencyId: AGENCY_A_ID,
      clientIdentifier: "client-a2",
      clientName: "Client A2 Name",
      ga4PropertyId: "prop-a2",
      credentialStatus: "pending"
    }).onConflictDoNothing()

    // Seed Client B1 for Agency B
    await db.insert(schema.agencyClientsTable).values({
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

// Cleans up data from the provided test database instance
async function cleanupTestData(db: PostgresJsDatabase<typeof schema>) { 
  console.log("Cleaning up test data...")
   if (!db) throw new Error("Test DB not connected for cleanup")
  try {
    // Delete in reverse order of creation due to potential FK constraints
    await db.delete(schema.agencyClientsTable)
    await db.delete(schema.agenciesTable)
    console.log("Test data cleaned up.")
  } catch (error) {
      console.error("Error cleaning up test data:", error)
      throw error
  }
}

describe("Agency Client Server Actions RLS Tests", () => {
  // --- Database Setup & Teardown ---

  beforeAll(async () => {
    // Connect and assign the instance to testDb for seeding/cleanup
    testDb = await connectTestDb()
    if (!testDb) {
        throw new Error("Failed to connect to the test database.");
    }
  })

  afterAll(async () => {
    // Disconnect from the test database
    await disconnectTestDb(testDb)
  })

  beforeEach(async () => {
    // Reset mocks before each test
    mockAuthFn.mockReset(); // Use the new function name
    mockAuthFn.mockReturnValue({ userId: null }); // Default to no user

    // Clean up *before* seeding to ensure a fresh state for each test
    await cleanupTestData(testDb)
    // Seed the database with test data
    await seedTestData(testDb)
  })

  afterEach(async () => {
    // Optional: Cleanup after each test if needed, but cleanup before is often safer
    // await cleanupTestData();

    // Reset the auth mock to default (no user)
    mockAuthFn.mockReturnValue({ userId: null }) // Reset the mock function
  })

  // --- Test Cases ---

  describe("getMyAgencyClientsAction", () => {
    it("Test 1: User A should only retrieve clients for Agency A", async () => {
      // Context: Simulate login as User A
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_C_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

      // Action
      const result = await updateAgencyClientAction(CLIENT_B1_ID, updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i) // Or similar RLS error message

      // Verification (Optional: check DB that B1 is unchanged)
    })

    it("Test 8: User A should FAIL to update a non-existent client", async () => {
      // Context: Simulate login as User A
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

      // Action
      // Use the validly formatted non-existent UUID
      const result = await updateAgencyClientAction(NON_EXISTENT_CLIENT_ID, updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or update failed/i) // Adjusted expectation based on action's return
    })

    // Add similar tests for User B (can update B1, cannot update A1)
    it("User B should successfully update their own agency's client (Client B1)", async () => {
      mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name
      const result = await updateAgencyClientAction(CLIENT_B1_ID, { clientName: "User B Update" })
      expect(result.isSuccess).toBe(true)
      expect(result.data?.clientName).toBe("User B Update")
    })

    it("User B should FAIL to update another agency's client (Client A1)", async () => {
        mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name
        const result = await updateAgencyClientAction(CLIENT_A1_ID, updateData)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })

  })

  describe("deleteAgencyClientAction", () => {
    it("Test 9: User A should successfully delete their own agency's client (Client A2)", async () => {
      // Context: Simulate login as User A
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

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
      mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

      // Action
      const result = await deleteAgencyClientAction(CLIENT_B1_ID)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i)

      // Verification (Optional: check DB that B1 still exists)
    })

    it("Test 11: User A should FAIL to delete a non-existent client", async () => {
       // Context: Simulate login as User A
       mockAuthFn.mockReturnValue({ userId: USER_A_ID }) // Use the new function name

       // Action
       // Use the validly formatted non-existent UUID
       const result = await deleteAgencyClientAction(NON_EXISTENT_CLIENT_ID)

       // Expected Result
       expect(result.isSuccess).toBe(false)
       expect(result.message).toMatch(/not found or delete failed/i) // Adjusted expectation based on action's return
    })

    // Add similar tests for User B (can delete B1, cannot delete A1/A2)
     it("User B should successfully delete their own agency's client (Client B1)", async () => {
        mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name
        const result = await deleteAgencyClientAction(CLIENT_B1_ID)
        expect(result.isSuccess).toBe(true)
     })

      it("User B should FAIL to delete another agency's client (Client A1)", async () => {
        mockAuthFn.mockReturnValue({ userId: USER_B_ID }) // Use the new function name
        const result = await deleteAgencyClientAction(CLIENT_A1_ID)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })
  })
}) 