import { pgTable, text, timestamp, uuid, pgPolicy } from "drizzle-orm/pg-core"
import { agencyClientsTable } from "./agency-clients-schema"
import { sql } from "drizzle-orm"

// This table stores the encrypted credential data.
// The 'credentialReference' in agencyClientsTable should store the ID from this table.
export const credentialsTable = pgTable(
  "credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agencyClientId: uuid("agency_client_id")
      .references(() => agencyClientsTable.id, { onDelete: "cascade" })
      .notNull()
      .unique(), // Each client should have only one credential entry

    // Stores the encrypted service account JSON key.
    // The actual encryption mechanism will be handled in server actions (Task 2.16).
    encryptedCredentialData: text("encrypted_credential_data").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    // RLS Policy for Agency Isolation via AgencyClient
    agencyIsolationPolicy: pgPolicy(`credentials_agency_isolation_policy`, {
      for: "all",
      // Allow operations only if the associated agencyClient's agencyId matches the session's agency_id
      using: sql`EXISTS (SELECT 1 FROM ${agencyClientsTable} WHERE ${agencyClientsTable.id} = ${table.agencyClientId} AND ${agencyClientsTable.agencyId} = current_setting('app.current_agency_id', true)::text)`
    })
  })
)

export type InsertCredential = typeof credentialsTable.$inferInsert
export type SelectCredential = typeof credentialsTable.$inferSelect
