/// <reference types="vitest" />
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true, // Makes describe, it, expect, etc. available globally
    environment: "node", // Or 'jsdom' if testing React components that need DOM
    // Optional: Specify setup files
    // setupFiles: ["tests/setup/setupFile.ts"], // For per-file setup
    globalSetup: ["tests/setup/globalSetup.ts"], // For global setup (like starting DB)

    // Optional: Coverage configuration
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "json", "html"],
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "actions/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "app/api/internal/get-creds/route.ts", // Exclude example/non-tested files
        "components/ui/**", // Exclude ShadCN UI components
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "**/dist/**",
        "**/.*/**", // hidden folders/files
        "*.config.{js,ts,cjs}", // config files
        "db/migrations/**", // exclude migrations
        "db/db.ts", // exclude base db connection
        "db/rls.ts", // exclude rls helper itself (tested via actions)
        "types/**" // exclude type definitions
      ]
    }
  }
}) 