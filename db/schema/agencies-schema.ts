import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

// Corresponds to Clerk organizations
export const agenciesTable = pgTable("agencies", {
  // Clerk Organization ID
  id: text("id").primaryKey(),
  // Clerk User ID of the owner/creator - Allow NULL for admin creation
  userId: text("user_id"),
  name: text("name").notNull(),
  // Other agency-specific details can be added here
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertAgency = typeof agenciesTable.$inferInsert
export type SelectAgency = typeof agenciesTable.$inferSelect
