"use server";

import { db } from "@/db/db";
import {
  InsertAgencyClient,
  SelectAgencyClient,
  agencyClientsTable
} from "@/db/schema";
import { ActionState } from "@/types";
import { withRLS, withRLSRead } from "./rls-helpers"; // Import RLS wrappers
import { eq, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

// CREATE Action
export const createAgencyClientAction = async (
  clientData: Omit<InsertAgencyClient, "agencyId" | "id" | "createdAt" | "updatedAt"> // Exclude fields set automatically or by RLS
): Promise<ActionState<SelectAgencyClient>> =>
  withRLS(async (tx, agencyId, clerkUserId) => {
    // agencyId is provided by the withRLS wrapper
    try {
      const [newClient] = await tx
        .insert(agencyClientsTable)
        .values({
          ...clientData,
          agencyId: agencyId, // Set agencyId from the RLS context
        })
        .returning();

      revalidatePath("/agency/clients"); // Adjust path as needed
      return {
        isSuccess: true,
        message: `${newClient.clientName} created successfully.`,
        data: newClient,
      };
    } catch (error: any) {
      // Handle potential unique constraint errors (e.g., clientIdentifier)
      if (error.code === '23505') { // Postgres unique violation
         return { isSuccess: false, message: "Client Identifier already exists." };
      }
      console.error("Error creating agency client:", error);
      return { isSuccess: false, message: "Failed to create client." };
    }
  });

// READ Action (Get all clients for the agency)
export const getMyAgencyClientsAction = async (): Promise<
  ActionState<SelectAgencyClient[]>
> =>
  withRLSRead(async (tx) => {
    // RLS policy automatically filters by agencyId set in context
    try {
      const clients = await tx.query.agencyClients.findMany();
      // No manual where(eq(agencyClientsTable.agencyId, agencyId)) needed!

      return {
        isSuccess: true,
        message: "Clients retrieved successfully.",
        data: clients,
      };
    } catch (error: any) {
      console.error("Error retrieving agency clients:", error);
      return { isSuccess: false, message: "Failed to retrieve clients." };
    }
  });

// UPDATE Action
export const updateAgencyClientAction = async (
  clientId: string, // The UUID of the client to update
  updateData: Partial<Omit<InsertAgencyClient, "id" | "agencyId">> // Allow updating relevant fields
): Promise<ActionState<SelectAgencyClient>> =>
  withRLS(async (tx, agencyId, clerkUserId) => {
    // RLS context ensures we can only update clients belonging to this agency
    try {
      const [updatedClient] = await tx
        .update(agencyClientsTable)
        .set({
          ...updateData,
          updatedAt: new Date(), // Manually update timestamp
        })
        .where(eq(agencyClientsTable.id, clientId))
        // RLS policy provides the agencyId check implicitly
        .returning();

      if (!updatedClient) {
        return { isSuccess: false, message: "Client not found or update failed." };
      }

      revalidatePath("/agency/clients"); // Adjust path
      revalidatePath(`/agency/clients/${clientId}`); // Adjust path
      return {
        isSuccess: true,
        message: `${updatedClient.clientName} updated successfully.`,
        data: updatedClient,
      };
    } catch (error: any) {
        if (error.code === '23505') { // Handle potential unique constraint errors on update
            return { isSuccess: false, message: "Client Identifier already exists." };
        }
      console.error("Error updating agency client:", error);
      return { isSuccess: false, message: "Failed to update client." };
    }
  });

// DELETE Action
export const deleteAgencyClientAction = async (
  clientId: string // The UUID of the client to delete
): Promise<ActionState<void>> =>
  withRLS(async (tx, agencyId, clerkUserId) => {
    // RLS context ensures we can only delete clients belonging to this agency
    try {
      const [deletedClient] = await tx
        .delete(agencyClientsTable)
        .where(eq(agencyClientsTable.id, clientId))
         // RLS policy provides the agencyId check implicitly
        .returning({ id: agencyClientsTable.id, name: agencyClientsTable.clientName }); // Return some data to confirm deletion

       if (!deletedClient) {
         return { isSuccess: false, message: "Client not found or delete failed." };
       }

      revalidatePath("/agency/clients"); // Adjust path
      return {
        isSuccess: true,
        message: `Client '${deletedClient.name}' deleted successfully.`,
        data: undefined,
      };
    } catch (error: any) {
      console.error("Error deleting agency client:", error);
      return { isSuccess: false, message: "Failed to delete client." };
    }
  });

// Define the structure for each property the user selects to import
interface PropertyToImport {
  propertyId: string // e.g., "properties/12345"
  clientIdentifier: string // User-defined unique identifier for MCP
  clientName: string // User-defined friendly name (can default to GA4 displayName)
}

/**
 * Creates multiple AgencyClient records in bulk based on user selections.
 * Uses passed agencyId and runs within RLS context.
 *
 * @param agencyId - The ID of the agency these clients belong to (passed explicitly).
 * @param nangoConnectionTableId - The ID of the Nango connection record providing access.
 * @param propertiesToImport - An array of properties selected by the user.
 * @returns ActionState indicating success or failure, with created clients on success.
 */
export const bulkCreateAgencyClientsAction = async (
  agencyId: string, // Expect agencyId parameter
  nangoConnectionTableId: string,
  propertiesToImport: PropertyToImport[]
): Promise<ActionState<SelectAgencyClient[]>> =>
  // Pass agencyId as the second argument to withRLS
  withRLS(async (tx: any, resolvedAgencyId, clerkUserId) => {
    // Note: resolvedAgencyId inside here *should* match the passed agencyId
    // because withRLS now prioritizes it.

    // We already validated the passed agencyId is non-empty
    // if (!agencyId) { // This check is redundant now if passed
    //     return { isSuccess: false, message: "Agency ID was not provided to the action." };
    // }

    if (!nangoConnectionTableId || !propertiesToImport?.length) {
      return { isSuccess: false, message: "Invalid input provided." };
    }

    const clientsToInsert: InsertAgencyClient[] = propertiesToImport.map(
      prop => ({
        agencyId: resolvedAgencyId, // Use the agencyId resolved by withRLS for insertion
        clientIdentifier: prop.clientIdentifier,
        clientName: prop.clientName,
        propertyId: prop.propertyId,
        nangoConnectionTableId: nangoConnectionTableId,
        credentialStatus: "pending",
      })
    );

    try {
      const identifiersToCheck = clientsToInsert.map(c => c.clientIdentifier);

      if (identifiersToCheck.length > 0) {
        // Duplicate check STILL relies on RLS context set by withRLS using contextAgencyId
        // This check might incorrectly pass if contextAgencyId is wrong/null, but the
        // subsequent INSERT should fail safely due to DB constraints / RLS policy IF they exist.
        const existingIdentifiers = await tx
          .select({ clientIdentifier: agencyClientsTable.clientIdentifier })
          .from(agencyClientsTable)
          .where(inArray(agencyClientsTable.clientIdentifier, identifiersToCheck));

        if (existingIdentifiers.length > 0) {
          const duplicates = existingIdentifiers.map((e: any) => e.clientIdentifier);
          return {
            isSuccess: false,
            // Use the passed agencyId for the error message for clarity
            message: `Failed to create clients. The following Client Identifiers already exist for agency ${resolvedAgencyId}: ${duplicates.join(", ")}`
          };
        }
      }

      // Perform the bulk insert using the transaction client 'tx'
      // The actual DB insert will use the RLS context set by withRLS(contextAgencyId,...)
      // but the agencyId value in the inserted data comes from the passed parameter.
      const insertedClients = await tx
        .insert(agencyClientsTable)
        .values(clientsToInsert) // Uses passed agencyId here
        .returning();

      if (!insertedClients || insertedClients.length !== clientsToInsert.length) {
        // This case might indicate a partial insert or unexpected DB behavior
        console.error("Bulk insert mismatch:", {
          expected: clientsToInsert.length,
          inserted: insertedClients?.length ?? 0
        });
        return {
          isSuccess: false,
          message:
            "Failed to create all selected clients. Please check and try again."
        };
      }

      revalidatePath("/agency/clients");
      return {
          isSuccess: true,
          message: `Successfully created ${insertedClients.length} client configuration(s).`,
          data: insertedClients
      };

    } catch (error: any) {
        console.error("Error creating bulk agency clients:", error);
        if (error.code === "23505") {
            return {
                isSuccess: false,
                message: `Failed to create clients due to a conflict. Ensure Property IDs and Client Identifiers are unique within your agency.`
            };
        }
        return {
            isSuccess: false,
            message: `An unexpected error occurred: ${error.message || "Unknown error"}`
        };
    }
  }, agencyId); // Pass the explicit agencyId here!

// Placeholder for other agency client actions (CRUD for individual clients if needed)
// export async function getAgencyClientAction(...) {}
// export async function updateAgencyClientAction(...) {}
// export async function deleteAgencyClientAction(...) {} 