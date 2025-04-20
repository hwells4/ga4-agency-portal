import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { agencyClientsTable } from "./agency-clients-schema"

// This table stores the encrypted credential data.
// The 'credentialReference' in agencyClientsTable should store the ID from this table.
export const credentialsTable = pgTable("credentials", {
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
})

export type InsertCredential = typeof credentialsTable.$inferInsert
export type SelectCredential = typeof credentialsTable.$inferSelect
