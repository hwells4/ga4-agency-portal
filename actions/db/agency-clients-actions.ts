"use server";

import { db } from "@/db/db";
import {
  InsertAgencyClient,
  SelectAgencyClient,
  agencyClientsTable
} from "@/db/schema";
import { ActionState } from "@/types";
import { withRLS, withRLSRead } from "./rls-helpers"; // Import RLS wrappers
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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