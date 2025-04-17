/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/todo(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // Allow internal API routes to pass through without Clerk auth
  if (req.nextUrl.pathname.startsWith('/api/internal')) {
    return NextResponse.next();
  }

  const { userId, redirectToSignIn } = await auth()

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn({ returnBackUrl: "/login" })
  }

  // If the user is logged in and the route is protected, let them view.
  if (userId && isProtectedRoute(req)) {
    return NextResponse.next()
  }

  // Allow all other requests (including non-protected routes and public API routes)
  // Note: This might need adjustment depending on default behavior desired for other API routes
  return NextResponse.next();
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
}
