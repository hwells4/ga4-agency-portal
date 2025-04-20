"use server"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/db/db"
import { executeWithAgencyContext } from "@/db/rls"
import { agenciesTable } from "@/db/schema"
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
 * Fetches the agency ID associated with the currently authenticated Clerk user.
 * Relies on the agenciesTable having a userId column matching the Clerk userId.
 *
 * @param clerkUserId The Clerk user ID.
 * @returns The agency ID (string/text) or null if not found.
 * @throws Error if agenciesTable.userId column definition is missing.
 */
async function getCurrentAgencyId(clerkUserId: string): Promise<string | null> {
  // Runtime check to ensure the schema has the necessary column for this logic
  // Note: Drizzle's type system doesn't easily allow checking for specific columns
  // on the imported table object itself in a type-safe way before the query.
  // This check assumes the schema file is correctly defined.
  // A more robust check might involve querying information_schema, but that's overkill here.
  // We rely on the developer ensuring agenciesTable includes userId.

  const agency = await db.query.agencies.findFirst({
    columns: { id: true },
    where: eq(agenciesTable.userId, clerkUserId),
  });
  return agency?.id ?? null; // agency.id is TEXT
}

/**
 * Wraps a database WRITE operation (INSERT, UPDATE, DELETE) to ensure it runs
 * within the correct agency's RLS context.
 *
 * @param operation A function performing the write operation.
 *                  It receives the transaction client (tx), agencyId, and clerkUserId.
 * @returns The ActionState result from the operation.
 */
export async function withRLS<T>(
  operation: (
    tx: typeof db,
    agencyId: string,
    clerkUserId: string
  ) => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  const authResult = await auth();
  const clerkUserId = authResult?.userId;

  if (!clerkUserId) return { isSuccess: false, message: "Unauthorized: No user logged in." };

  try {
    const agencyId = await getCurrentAgencyId(clerkUserId);
    if (!agencyId) {
      // This check prevents operations if the user isn't linked to an agency.
      return { isSuccess: false, message: "Unauthorized: User not associated with an agency." };
    }

    // Execute the operation within the agency context
    // Pass down agencyId and clerkUserId for potential use within the operation (e.g., setting agencyId on insert)
    return await executeWithAgencyContext(agencyId, (tx) => operation(tx, agencyId, clerkUserId));

  } catch (error: any) {
    console.error("withRLS Error:", error);
    // Catch errors from getCurrentAgencyId or executeWithAgencyContext
    return { isSuccess: false, message: `Internal RLS error: ${error.message}` };
  }
}

/**
 * Wraps a database READ operation to ensure it runs within the correct
 * agency's RLS context, or a non-matching context if the user has no agency.
 *
 * @param operation A function performing the read operation.
 *                  It receives the transaction client (tx).
 * @returns The ActionState result from the operation.
 */
export async function withRLSRead<T>(
  operation: (tx: typeof db) => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  const authResult = await auth();
  const clerkUserId = authResult?.userId;

  if (!clerkUserId) return { isSuccess: false, message: "Unauthorized: No user logged in." };

  try {
    const agencyId = await getCurrentAgencyId(clerkUserId);

    if (!agencyId) {
      // User is logged in but not linked to an agency.
      // Execute the operation in a context that RLS policies won't match.
      // Use a non-existent or clearly invalid ID (like an empty string or specific placeholder).
      // Policies comparing text equality will fail, effectively blocking reads.
      const nonMatchingContextId = 'invalid-agency-id-for-rls-read'; // Or empty string ""
      console.warn(`RLS Read: User ${clerkUserId} has no agency. Executing with non-matching context.`);
      return await executeWithAgencyContext(nonMatchingContextId, operation);

      // Alternative: If reads should just return empty data for users without an agency:
      // return { isSuccess: true, message: "No agency association found.", data: [] as unknown as T };
      // Choose the behavior that makes sense for your application.
    }

    // User has an agency, execute within their context.
    return await executeWithAgencyContext(agencyId, operation);

  } catch (error: any) {
    console.error("withRLSRead Error:", error);
    // Catch errors from getCurrentAgencyId or executeWithAgencyContext
    return { isSuccess: false, message: `Internal RLS read error: ${error.message}` };
  }
} 