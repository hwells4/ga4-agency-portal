import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  pgPolicy
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { agenciesTable } from "./agencies-schema"
import { profilesTable } from "./profiles-schema"

export const nangoConnectionStatusEnum = pgEnum("nango_connection_status", [
  "pending",
  "active",
  "error",
  "revoked"
])

export const nangoConnectionsTable = pgTable(
  "nango_connections",
  {
    // Internal UUID primary key
    id: uuid("id").defaultRandom().primaryKey(),
    agencyId: text("agency_id")
      .references(() => agenciesTable.id, { onDelete: "cascade" })
      .notNull(),
    // User who initiated this connection within the agency
    userId: text("user_id")
      .references(() => profilesTable.userId, { onDelete: "cascade" })
      .notNull(),
    // User-friendly name for this connection (e.g., "John's GA Account")
    name: text("name"), // Optional, maybe set later by user
    // Nango's specific ID for this connection instance
    nangoConnectionId: text("nango_connection_id").unique(), // Should be unique
    // Nango Provider Config Key used (e.g., 'google-analytics')
    providerConfigKey: text("provider_config_key").notNull(),
    // Status of the connection
    status: nangoConnectionStatusEnum("status").default("pending").notNull(),
    // Store any error message from Nango if status is 'error'
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    // RLS Policy based on the agencyId
    agencyIsolationPolicy: pgPolicy(
      `nango_connections_agency_isolation_policy`,
      {
        for: "all",
        using: sql`agency_id = current_setting('app.current_agency_id', true)::text`
      }
    )
  })
)

export type InsertNangoConnection = typeof nangoConnectionsTable.$inferInsert
export type SelectNangoConnection = typeof nangoConnectionsTable.$inferSelect
