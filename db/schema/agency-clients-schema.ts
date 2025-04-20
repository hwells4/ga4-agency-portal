import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  pgPolicy
} from "drizzle-orm/pg-core"
import { agenciesTable } from "./agencies-schema"
import { sql } from "drizzle-orm"

// Define the enum for credential status
export const credentialStatusEnum = pgEnum("credential_status", [
  "pending",
  "uploaded",
  "validated",
  "error"
])

export const agencyClientsTable = pgTable(
  "agency_clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agencyId: text("agency_id")
      .references(() => agenciesTable.id, { onDelete: "cascade" })
      .notNull(),
    // This is the identifier used in MCP requests
    clientIdentifier: text("client_identifier").notNull().unique(),
    // User-friendly name for the portal UI
    clientName: text("client_name").notNull(),
    ga4PropertyId: text("ga4_property_id").notNull(),
    // Reference to the stored credential (e.g., secret manager ARN, DB encrypted record ID)
    // For now, we'll use a text field. Task 2.16 will refine this.
    credentialReference: text("credential_reference"),
    // Use the enum for credential status
    credentialStatus: credentialStatusEnum("credential_status")
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    // RLS Policy for Agency Isolation
    agencyIsolationPolicy: pgPolicy(`agency_clients_agency_isolation_policy`, {
      for: "all",
      using: sql`${table.agencyId} = current_setting('app.current_agency_id', true)::text`
    })
  })
)

export type InsertAgencyClient = typeof agencyClientsTable.$inferInsert
export type SelectAgencyClient = typeof agencyClientsTable.$inferSelect
