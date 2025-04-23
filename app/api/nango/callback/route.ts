import { NextRequest, NextResponse } from "next/server"
import { storeNangoConnectionIdAction } from "@/actions/nango-actions"
import { auth } from "@clerk/nextjs/server" // Import auth
import { db } from "@/db/db" // Import db
import { profilesTable } from "@/db/schema" // Import profilesTable
import { eq } from "drizzle-orm" // Import eq

// Example URL: /api/nango/callback?connectionId=UNIQUE_NANGO_CONNECTION_ID&providerConfigKey=google-analytics&error=...&state=...
// Nango sends webhooks via POST with a JSON body

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json()
    console.log(
      "Nango Callback Webhook Received (POST):",
      JSON.stringify(webhookData, null, 2)
    )

    // Verify webhook type and success (optional but recommended)
    if (
      webhookData?.type !== "auth" ||
      webhookData?.operation !== "creation" ||
      webhookData?.success !== true
    ) {
      console.warn(
        "Received non-successful or unexpected Nango webhook type/operation:",
        webhookData
      )
      // Return 200 OK even for non-successful webhooks Nango expects it
      return NextResponse.json({
        message:
          "Webhook received but not processed (type/op/success mismatch)."
      })
    }

    // Extract needed data from webhook payload
    const nangoConnectionId = webhookData?.connectionId
    const providerConfigKey = webhookData?.providerConfigKey
    const userId = webhookData?.endUser?.endUserId // Nango uses endUserId for the user
    const agencyId = webhookData?.endUser?.organizationId // Nango uses organizationId for the org
    const error = webhookData?.error

    if (error) {
      console.error("Nango webhook reported an error:", error)
      // TODO: Potentially update nango_connections table with error status?
      return NextResponse.json({ message: "Webhook error received." })
    }

    // Validate required fields from webhook
    if (!nangoConnectionId || !providerConfigKey || !userId || !agencyId) {
      console.error(
        "Nango webhook missing required parameters (connectionId, providerConfigKey, endUserId, or organizationId).",
        webhookData
      )
      return NextResponse.json({ message: "Webhook data incomplete." })
    }

    // Call the server action to store the Nango connection details
    // Use the data extracted from the webhook payload
    console.log(
      `Calling storeNangoConnectionIdAction from POST webhook for user ${userId}, agency ${agencyId}...`
    )
    const result = await storeNangoConnectionIdAction(
      nangoConnectionId,
      providerConfigKey,
      agencyId,
      userId
    )

    if (!result.isSuccess) {
      // Log the failure but still return 200 OK to Nango
      console.error(
        `Failed to store Nango connection ID via webhook: ${result.message}`
      )
      return NextResponse.json({
        message: "Webhook processed, DB update failed."
      })
    }

    console.log(
      `Successfully stored Nango connection ID ${nangoConnectionId} for agency client ${agencyId} via webhook.`
    )

    // Return 200 OK to acknowledge webhook receipt to Nango
    return NextResponse.json({ message: "Webhook processed successfully." })
  } catch (e: any) {
    console.error("Error processing Nango callback webhook:", e)
    // Return 500 for internal server errors during processing, Nango might retry
    return NextResponse.json(
      { error: "Internal server error processing webhook." },
      { status: 500 }
    )
  }
}

// GET handler for the browser redirect after Nango Connect finishes
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      // User needs to be logged in to link a connection
      // Redirect to login or show an error page
      const loginUrl = new URL("/sign-in", request.url)
      loginUrl.searchParams.set(
        "redirect_url",
        request.nextUrl.pathname + request.nextUrl.search
      ) // Redirect back after login
      return NextResponse.redirect(loginUrl)
    }

    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get("connectionId")
    const providerConfigKey = searchParams.get("providerConfigKey")
    const state = searchParams.get("state") // Contains agencyClientId
    const error = searchParams.get("error") // Check for errors from Nango

    // --- Helper function for redirecting with error --- //
    const getErrorRedirectUrl = (
      errorCode: string,
      defaultPath = "/agency/dashboard"
    ) => {
      // Default to dashboard
      const redirectUrl = new URL(defaultPath, request.url)
      redirectUrl.searchParams.set("error", errorCode)
      return redirectUrl
    }
    // --- End Helper --- //

    if (error) {
      console.error(
        "Nango callback redirect error:",
        error,
        searchParams.toString()
      )
      // Attempt to get agencyId from state to redirect back to the agency dashboard
      let agencyPath = "/agency/dashboard" // Default redirect path on error
      if (state) {
        try {
          const decodedState = JSON.parse(decodeURIComponent(state))
          if (decodedState.agencyId) {
            // Could potentially redirect to a specific agency settings page if needed
            // agencyPath = `/agency/${decodedState.agencyId}/settings`
          }
        } catch (e) {
          console.warn("Could not parse agencyId from state on error path.")
        }
      }
      return NextResponse.redirect(
        getErrorRedirectUrl(`nango_connection_failed: ${error}`, agencyPath)
      )
    }

    if (!connectionId || !providerConfigKey || !state) {
      console.error(
        "Missing parameters in Nango callback redirect:",
        searchParams.toString()
      )
      return NextResponse.redirect(
        getErrorRedirectUrl("nango_callback_invalid")
      )
    }

    let agencyId: string
    let stateUserId: string // Get userId from state as well for verification
    try {
      // State should contain {"agencyId": "...", "userId": "..."}
      const decodedState = JSON.parse(decodeURIComponent(state))
      agencyId = decodedState.agencyId
      stateUserId = decodedState.userId
      if (!agencyId || !stateUserId)
        throw new Error("agencyId or userId missing in state")

      // Verify the userId from the state matches the logged-in user
      if (stateUserId !== userId) {
        console.error(
          `State userId (${stateUserId}) does not match logged-in userId (${userId}). Potential CSRF?`
        )
        return NextResponse.redirect(
          getErrorRedirectUrl("nango_callback_user_mismatch")
        )
      }
    } catch (e) {
      console.error(
        "Invalid state parameter in Nango callback redirect:",
        state,
        e
      )
      return NextResponse.redirect(
        getErrorRedirectUrl("nango_callback_invalid_state")
      )
    }

    // Define the success/error redirect URL base - redirect to dashboard
    const redirectBaseUrl = new URL("/agency/dashboard", request.url)

    // No longer need to fetch agencyId from profile, it came from state and was verified
    /*
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId),
      columns: { agencyId: true },
    })

    if (!userProfile?.agencyId) {
      console.error(`Could not find agencyId for user ${userId} in profile table.`)
      clientPageUrl.searchParams.set("error", "profile_agency_not_found")
      return NextResponse.redirect(clientPageUrl)
    }
    const agencyId = userProfile.agencyId
    */

    // Call the server action to store the connection ID (no agencyClientId)
    const result = await storeNangoConnectionIdAction(
      // agencyClientId removed
      connectionId,
      providerConfigKey,
      agencyId, // Pass the agencyId from state
      userId // Pass the logged-in userId (verified against state)
    )

    if (result.isSuccess) {
      console.log(
        `Successfully stored Nango connection for agency ${agencyId}, user ${userId}`
      )
      redirectBaseUrl.searchParams.set("success", "nango_connected")
      // Optionally include the new connection record ID if needed on the dashboard
      // if (result.data?.nangoConnectionRecordId) {
      //   redirectBaseUrl.searchParams.set("newConnectionId", result.data.nangoConnectionRecordId)
      // }
      return NextResponse.redirect(redirectBaseUrl)
    } else {
      console.error(
        `Failed to store Nango connection for agency ${agencyId}, user ${userId}:`,
        result.message
      )
      redirectBaseUrl.searchParams.set("error", "nango_storage_failed")
      return NextResponse.redirect(redirectBaseUrl)
    }
  } catch (error: any) {
    console.error("Unexpected error in Nango callback GET handler:", error)
    // Redirect to a generic error page or dashboard
    const errorRedirectUrl = new URL(
      "/agency/clients?error=nango_callback_unexpected",
      request.url
    )
    return NextResponse.redirect(errorRedirectUrl)
  }
}

/*
// Keep the POST handler if needed for webhooks, otherwise remove.
export async function POST(request: NextRequest) {
  // ... existing POST logic ...
}
*/
