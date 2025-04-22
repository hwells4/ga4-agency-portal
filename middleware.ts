/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware } from "@clerk/nextjs/server"

// Simplest form: Protects everything matched by config.matcher except publicRoutes
export default clerkMiddleware()

export const config = {
  matcher: [
    // Match all routes except static files and _next internal routes
    "/((?!.*\\..*|_next).*)", 
    // Re-include the root route if it should be protected or handled by the middleware
    "/", 
    // Match all API and TRPC routes
    "/(api|trpc)(.*)"
  ],
  // Define public routes directly in the config
  publicRoutes: [
      "/login(.*)", // Match login paths
      "/signup(.*)", // Match signup paths
      "/api/internal/(.*)", // Internal API is public (uses own auth)
      "/api/nango/callback", // Nango webhook is public
      // Add "/" if the homepage should be public
      // Add any other public routes here
   ]
}
