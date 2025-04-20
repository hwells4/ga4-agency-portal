import { defineConfig } from "drizzle-kit"
import dotenv from "dotenv"
import path from "path"

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") })

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set in the environment for drizzle.config.test.ts")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations", // Keep same migration output dir
  dbCredentials: {
    url: process.env.TEST_DATABASE_URL
  },
  verbose: true,
  strict: true
}) 