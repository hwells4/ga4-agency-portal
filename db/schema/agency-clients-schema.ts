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
import { nangoConnectionsTable } from "./nango-connections-schema"

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
    // Specific GA4 Property ID (e.g., properties/12345)
    propertyId: text("property_id").notNull(),

    // Link to the specific Nango connection that provides access to this property
    nangoConnectionTableId: uuid("nango_connection_table_id")
      .references(() => nangoConnectionsTable.id, { onDelete: "cascade" })
      .notNull(),

    // Use the enum for credential status (might be redundant if status is on nangoConnection)
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
    // Consider adding a unique constraint on (agencyId, propertyId) or (agencyId, clientIdentifier)
  })
)

export type InsertAgencyClient = typeof agencyClientsTable.$inferInsert
export type SelectAgencyClient = typeof agencyClientsTable.$inferSelect
