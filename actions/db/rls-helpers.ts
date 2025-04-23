"use server"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/db/db"
import { executeWithAgencyContext } from "@/db/rls"
import { ActionState } from "@/types"

// Type definition for the operation function passed to withRLS
// It receives the context-aware transaction object
type RlsOperation<T> = (
  tx: Parameters<typeof executeWithAgencyContext>[1] extends (
    tx: infer Tx
  ) => any
    ? Tx
    : never
) => Promise<ActionState<T>>

// Type definition for the read operation function passed to withRLSRead
type RlsReadOperation<T> = (
  tx: Parameters<typeof executeWithAgencyContext>[1] extends (
    tx: infer Tx
  ) => any
    ? Tx
    : never
) => Promise<ActionState<T>>

/**
 * Wraps a database WRITE operation (INSERT, UPDATE, DELETE) to ensure it runs
 * within the correct agency's RLS context based on the user's active Clerk Organization.
 *
 * @param operation A function performing the write operation.
 *                  It receives the transaction client (tx), agencyId (orgId), and clerkUserId.
 * @returns The ActionState result from the operation.
 */
export async function withRLS<T>(
  operation: (
    tx: typeof db,       // Type of transaction client
    agencyId: string,   // This will be the Clerk orgId
    clerkUserId: string // Clerk userId
  ) => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  const { userId: clerkUserId, orgId: agencyId } = await auth(); // Get userId and orgId

  if (!clerkUserId) {
    return { isSuccess: false, message: "Unauthorized: No user logged in." };
  }
  
  if (!agencyId) {
    // User is logged in but has no active organization selected in Clerk
    return { isSuccess: false, message: "Unauthorized: User not associated with an active agency/organization." };
  }

  try {
    // Execute the operation within the agency context using the Clerk orgId
    // Pass down agencyId (orgId) and clerkUserId for use within the operation
    return await executeWithAgencyContext(agencyId, (tx) => operation(tx, agencyId, clerkUserId));

  } catch (error: any) {
    console.error("withRLS Error:", error);
    return { isSuccess: false, message: `Internal RLS error: ${error.message}` };
  }
}

/**
 * Wraps a database READ operation to ensure it runs within the correct
 * agency's RLS context based on the user's active Clerk Organization.
 *
 * @param operation A function performing the read operation.
 *                  It receives the transaction client (tx).
 * @returns The ActionState result from the operation.
 */
export async function withRLSRead<T>(
  operation: (tx: typeof db) => Promise<ActionState<T>> // Receives transaction client
): Promise<ActionState<T>> {
  const { userId: clerkUserId, orgId: agencyId } = await auth(); // Get userId and orgId

  if (!clerkUserId) {
    return { isSuccess: false, message: "Unauthorized: No user logged in." };
  }

  try {
    if (!agencyId) {
      // User logged in but no active organization. Use non-matching context.
      const nonMatchingContextId = 'invalid-agency-id-for-rls-read'; 
      console.warn(`RLS Read: User ${clerkUserId} has no active agency/organization. Executing with non-matching context.`);
      return await executeWithAgencyContext(nonMatchingContextId, operation);
    }

    // User has an active organization, execute within their context.
    return await executeWithAgencyContext(agencyId, operation);

  } catch (error: any) {
    console.error("withRLSRead Error:", error);
    return { isSuccess: false, message: `Internal RLS read error: ${error.message}` };
  }
} 