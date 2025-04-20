import { sql } from "drizzle-orm"
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT
} from "drizzle-orm/postgres-js"
import { PgTransaction } from "drizzle-orm/pg-core"
import { ExtractTablesWithRelations } from "drizzle-orm"
import * as schema from "@/db/schema"
import { db } from "@/db/db" // Correct import for the main db client
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { PostgresJsTransaction } from "drizzle-orm/postgres-js"
import * as schemaExports from "@/db/schema"

/**
 * Executes a database operation within a transaction after setting
 * the agency context using a PostgreSQL session variable.
 *
 * @param agencyId The ID of the agency to set in the context (must be text).
 * @param operation A function that receives the transaction client (tx),
 *                 typed as the main 'db' instance type.
 * @returns The result of the operation function.
 */
export async function executeWithAgencyContext<T>(
  agencyId: string, // Agency ID is TEXT
  operation: (tx: typeof db) => Promise<T>
): Promise<T> {
  if (!agencyId) {
    // Prevent setting an empty/invalid context
    throw new Error("executeWithAgencyContext requires a valid agencyId.")
  }
  // Drizzle's transaction passes a client compatible with the original db type
  return db.transaction(async tx => {
    // Call the SQL function to set the session variable
    // Ensures the agency_id is correctly passed as text
    await tx.execute(sql`SELECT set_current_agency_id(${agencyId});`)

    // Execute the actual database operation using the transaction client
    const result = await operation(tx)

    // The transaction commits automatically if no errors occurred.
    // The session variable 'app.current_agency_id' is automatically cleared
    // at the end of the transaction.
    return result
  })
}

// Remove or comment out executeReadWithAgencyContext and setAgencyContext if they cause issues
// /**
//  * Executes a read-only database operation...
//  */
// export async function executeReadWithAgencyContext<T>(
//   agencyId: string,
//   operation: (dbClient: typeof db) => Promise<T>, // Use typeof db
//   dbInstance: typeof db = db // Use typeof db
// ): Promise<T> {
//   console.warn(
//     "executeReadWithAgencyContext uses a transaction internally for reliable context setting."
//   );
//   return dbInstance.transaction(async (tx) => {
//     await tx.execute(sql`SELECT set_current_agency_id(${agencyId});`);
//     // Pass the transaction client, which is compatible with typeof db
//     const result = await operation(tx);
//     return result;
//   });
// }
//
// /**
//  * Sets the 'app.current_agency_id' setting for the current transaction.
//  */
// async function setAgencyContext(
//   tx: typeof db, // Use typeof db
//   agencyId: string
// ): Promise<void> {
//   await tx.execute(sql`SELECT set_current_agency_id(${agencyId});`);
// }
