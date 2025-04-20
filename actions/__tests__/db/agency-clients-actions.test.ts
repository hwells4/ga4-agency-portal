import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import {
  getMyAgencyClientsAction,
  createAgencyClientAction,
  updateAgencyClientAction,
  deleteAgencyClientAction
} from "@/actions/db/agency-clients-actions" // Adjust path if needed
import { InsertAgencyClient } from "@/db/schema/agency-clients-schema" // Adjust path if needed

// --- Test Setup ---

// Placeholder IDs - Replace with actual IDs from your seeding logic
const USER_A_ID = "user_a_clerk_id"
const USER_B_ID = "user_b_clerk_id"
const USER_C_ID = "user_c_clerk_id" // User without an agency

const AGENCY_A_ID = "agency_a_uuid"
const AGENCY_B_ID = "agency_b_uuid"

const CLIENT_A1_ID = "client_a1_uuid"
const CLIENT_A2_ID = "client_a2_uuid"
const CLIENT_B1_ID = "client_b1_uuid"

// Mock Clerk's auth function
// We'll set the userId dynamically in beforeEach/it blocks
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => ({ userId: null }))
}))

// Mock the RLS helpers if necessary, or ensure they work with the test DB/context
// vi.mock("@/actions/db/rls-helpers", async () => { ... }); // If deep mocking is needed

describe("Agency Client Server Actions RLS Tests", () => {
  // --- Database Setup & Teardown ---

  beforeAll(async () => {
    // Connect to the test database
    // Ensure migrations are run
    console.log("Connecting to test database...")
    // Example: await connectTestDb();
    // Example: await runMigrations();
  })

  afterAll(async () => {
    // Disconnect from the test database
    console.log("Disconnecting from test database...")
    // Example: await disconnectTestDb();
  })

  beforeEach(async () => {
    // Seed the database with test data (Agencies, Clients for A and B)
    console.log("Seeding test data...")
    // Example: await seedTestData({ USER_A_ID, USER_B_ID, AGENCY_A_ID, AGENCY_B_ID, CLIENT_A1_ID, ... });

    // Reset mocks if needed
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up the database (delete seeded data)
    console.log("Cleaning up test data...")
    // Example: await cleanupTestData();

    // Reset the auth mock to default (no user)
    vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: null })
  })

  // --- Test Cases ---

  describe("getMyAgencyClientsAction", () => {
    it("Test 1: User A should only retrieve clients for Agency A", async () => {
      // Context: Simulate login as User A
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_C_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

      // Action
      const result = await updateAgencyClientAction(CLIENT_B1_ID, updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i) // Or similar RLS error message

      // Verification (Optional: check DB that B1 is unchanged)
    })

    it("Test 8: User A should FAIL to update a non-existent client", async () => {
      // Context: Simulate login as User A
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

      // Action
      const result = await updateAgencyClientAction("non-existent-uuid", updateData)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i)
    })

    // Add similar tests for User B (can update B1, cannot update A1)
    it("User B should successfully update their own agency's client (Client B1)", async () => {
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })
      const result = await updateAgencyClientAction(CLIENT_B1_ID, { clientName: "User B Update" })
      expect(result.isSuccess).toBe(true)
      expect(result.data?.clientName).toBe("User B Update")
    })

    it("User B should FAIL to update another agency's client (Client A1)", async () => {
        vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })
        const result = await updateAgencyClientAction(CLIENT_A1_ID, updateData)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })

  })

  describe("deleteAgencyClientAction", () => {
    it("Test 9: User A should successfully delete their own agency's client (Client A2)", async () => {
      // Context: Simulate login as User A
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

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
      vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

      // Action
      const result = await deleteAgencyClientAction(CLIENT_B1_ID)

      // Expected Result
      expect(result.isSuccess).toBe(false)
      expect(result.message).toMatch(/not found or access denied/i)

      // Verification (Optional: check DB that B1 still exists)
    })

    it("Test 11: User A should FAIL to delete a non-existent client", async () => {
       // Context: Simulate login as User A
       vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_A_ID })

       // Action
       const result = await deleteAgencyClientAction("non-existent-uuid")

       // Expected Result
       expect(result.isSuccess).toBe(false)
       expect(result.message).toMatch(/not found or access denied/i)
    })

    // Add similar tests for User B (can delete B1, cannot delete A1/A2)
     it("User B should successfully delete their own agency's client (Client B1)", async () => {
        vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })
        const result = await deleteAgencyClientAction(CLIENT_B1_ID)
        expect(result.isSuccess).toBe(true)
     })

      it("User B should FAIL to delete another agency's client (Client A1)", async () => {
        vi.mocked(require("@clerk/nextjs/server").auth).mockReturnValue({ userId: USER_B_ID })
        const result = await deleteAgencyClientAction(CLIENT_A1_ID)
        expect(result.isSuccess).toBe(false)
        expect(result.message).toMatch(/not found or access denied/i)
      })
  })
}) 