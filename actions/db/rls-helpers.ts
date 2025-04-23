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
 * Wraps a database WRITE operation (INSERT, UPDATE, DELETE) ensuring RLS context.
 * PRIORITIZES the agencyId passed to the operation function if available,
 * falling back to auth().orgId only if necessary (and failing if neither exist).
 *
 * @param operation A function performing the write operation.
 *                  It receives the transaction client (tx), the resolved agencyId, and clerkUserId.
 * @returns The ActionState result from the operation.
 */
export async function withRLS<T>(
  operation: (
    tx: typeof db,
    agencyId: string,   // The agencyId resolved either from auth() or passed explicitly
    clerkUserId: string
  ) => Promise<ActionState<T>>,
  explicitAgencyId?: string // Optional explicit agencyId passed from the action call
): Promise<ActionState<T>> {
  const { userId: clerkUserId, orgId: contextOrgId } = await auth(); // Get context IDs

  if (!clerkUserId) {
    return { isSuccess: false, message: "Unauthorized: No user logged in." };
  }

  // Determine the agencyId to use: prioritize explicit, fallback to context
  const agencyIdToUse = explicitAgencyId ?? contextOrgId;

  if (!agencyIdToUse) {
    // FAIL if neither explicit ID was passed NOR context orgId was found
    console.error(`RLS Error: No agencyId available. Explicit: ${explicitAgencyId}, Context: ${contextOrgId}, User: ${clerkUserId}`);
    return { isSuccess: false, message: "Unauthorized: Cannot determine active agency/organization." };
  }

  try {
    // Execute the operation using the determined agencyId for context
    return await executeWithAgencyContext(agencyIdToUse, (tx) => operation(tx, agencyIdToUse, clerkUserId));

  } catch (error: any) {
    console.error("withRLS Error:", error);
    return { isSuccess: false, message: `Internal RLS error: ${error.message}` };
  }
}

/**
 * Wraps a database READ operation ensuring RLS context.
 * Uses auth().orgId directly.
 * (Read operations might be less critical if the primary issue is in write actions,
 *  but consistency would involve a similar explicitId option if needed).
 */
export async function withRLSRead<T>(
  operation: (tx: typeof db) => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  const { userId: clerkUserId, orgId: agencyId } = await auth(); // Get userId and orgId

  if (!clerkUserId) {
    return { isSuccess: false, message: "Unauthorized: No user logged in." };
  }

  try {
    if (!agencyId) {
      const nonMatchingContextId = 'invalid-agency-id-for-rls-read'; 
      console.warn(`RLS Read: User ${clerkUserId} has no active agency/organization. Executing with non-matching context.`);
      return await executeWithAgencyContext(nonMatchingContextId, operation);
    }
    return await executeWithAgencyContext(agencyId, operation);

  } catch (error: any) {
    console.error("withRLSRead Error:", error);
    return { isSuccess: false, message: `Internal RLS read error: ${error.message}` };
  }
} 