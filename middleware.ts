/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher([
  '/agency(.*)', // Protect all agency routes
  // Add other protected routes here, excluding those in publicRoutes
]);

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/signup(.*)',
  '/api/internal/(.*)', // Internal API remains public (uses own auth)
  '/api/nango/callback', // Nango webhook remains public
  // Add "/" if the homepage should be public
  // Add any other explicitly public routes here
]);

// Use createRouteMatcher to define protected routes
export default clerkMiddleware((auth, req) => {
  // If it's not a public route, protect it
  if (!isPublicRoute(req)) {
    // Restrict access to protected routes if the user is not logged in.
    if (isProtectedRoute(req)) auth.protect();
  }
});

export const config = {
  matcher: [
    // Match all routes except static files and _next internal routes
    "/((?!.*\\..*|_next).*)", 
    // Re-include the root route if it should be protected or handled by the middleware
    "/", 
    // Match all API and TRPC routes
    "/(api|trpc)(.*)"
  ],
  // publicRoutes is no longer needed here as we use createRouteMatcher
  // publicRoutes: [...]
}
