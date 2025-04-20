import { execSync } from "child_process"
import path from "path"
import dotenv from "dotenv"

// Load environment variables from .env.test or similar
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") })

// Ensure TEST_DATABASE_URL is loaded for drizzle-kit
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set in the environment.")
}

export default async function setup() {
  console.log("\nStarting test database via Docker Compose...")
  try {
    // Start the container defined in docker-compose.test.yml
    // --wait ensures the healthcheck passes before proceeding
    execSync("docker compose -f docker-compose.test.yml up -d --wait", {
      stdio: "inherit"
    })
    console.log("Test database container started.")

    // Run Drizzle migrations against the test database
    console.log("Running migrations on test database...")
    // You might need a separate drizzle.config.test.ts that points to TEST_DATABASE_URL
    // Or configure drizzle-kit to use the environment variable directly if possible.
    // Example: execSync("npx drizzle-kit migrate --config=drizzle.config.test.ts", { stdio: "inherit" });
    // For now, assuming default config picks up TEST_DATABASE_URL or requires manual setup:
    execSync("npx drizzle-kit migrate --config=drizzle.config.test.ts", { stdio: "inherit" })
    console.log("Migrations applied to test database.")

    // Perform any other global seeding here if needed

    console.log("Global setup complete.")
  } catch (error) {
    console.error("Global setup failed:", error)
    // Attempt cleanup even if setup fails
    await teardown()
    process.exit(1)
  }

  // Return the teardown function
  return teardown
}

async function teardown() {
  console.log("\nStopping test database container...")
  try {
    // Stop and remove the container and its volumes
    execSync("docker compose -f docker-compose.test.yml down -v", { stdio: "inherit" })
    console.log("Test database container stopped and volume removed.")
  } catch (error) {
    console.error("Global teardown failed:", error)
    process.exit(1)
  }
} 