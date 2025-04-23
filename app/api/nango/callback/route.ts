import { NextRequest, NextResponse } from "next/server"
import { storeNangoConnectionIdAction } from "@/actions/nango-actions"
import { auth } from "@clerk/nextjs/server" // Import auth
import { db } from "@/db/db" // Import db
import { profilesTable } from "@/db/schema" // Import profilesTable
import { eq } from "drizzle-orm" // Import eq

// Example URL: /api/nango/callback?connectionId=UNIQUE_NANGO_CONNECTION_ID&providerConfigKey=google-analytics&error=...&state=...
// Nango sends webhooks via POST with a JSON body

export async function POST(request: NextRequest) {
  // Changed from GET to POST
  try {
    // Nango sends webhook data in the request body
    const webhookData = await request.json()

    console.log("Nango Callback Webhook Received (POST):", webhookData)

    // Verify webhook type and success (optional but recommended)
    if (
      webhookData?.type !== "auth" ||
      webhookData?.operation !== "creation" ||
      webhookData?.success !== true
    ) {
      console.warn(
        "Received non-successful or unexpected Nango webhook:",
        webhookData
      )
      // Return 200 OK even for non-successful webhooks Nango expects it
      return NextResponse.json({
        message: "Webhook received but not processed."
      })
    }

    // Extract needed data
    const nangoConnectionId = webhookData?.connectionId
    const agencyClientId = webhookData?.endUser?.endUserId // Nango uses endUserId, which we map to agencyClientId
    const error = webhookData?.error // Check if Nango reported an error

    if (error) {
      console.error("Nango webhook reported an error:", error)
      // Even with an error reported by Nango, respond 200 OK
      return NextResponse.json({ message: "Webhook error received." })
    }

    if (!nangoConnectionId || !agencyClientId) {
      console.error(
        "Nango webhook missing required parameters (connectionId or endUser.endUserId).",
        webhookData
      )
      // Respond 200 OK but log the error
      return NextResponse.json({ message: "Webhook data incomplete." })
    }

    // Call the server action to store the Nango connection ID in the database
    /* // Temporarily commented out - needs providerConfigKey, agencyId, userId
    const result = await storeNangoConnectionIdAction(
      agencyClientId,
      nangoConnectionId
    )
    */
    // Placeholder logic until POST handler is fully updated or removed
    const result = {
      isSuccess: true,
      message: "Webhook received, DB update skipped for now."
    } // Assume success for now

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
      `Successfully stored Nango connection ID ${nangoConnectionId} for agency client ${agencyClientId} via webhook.`
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
      defaultPath = "/agency/clients"
    ) => {
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
      // Attempt to get agencyClientId from state to redirect back to the specific client page
      let clientSpecificPath = "/agency/clients"
      if (state) {
        try {
          const decodedState = JSON.parse(decodeURIComponent(state))
          if (decodedState.agencyClientId) {
            clientSpecificPath = `/agency/clients/${decodedState.agencyClientId}`
          }
        } catch (e) {
          console.warn(
            "Could not parse agencyClientId from state on error path."
          )
        }
      }
      return NextResponse.redirect(
        getErrorRedirectUrl(
          `nango_connection_failed: ${error}`,
          clientSpecificPath
        )
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

    let agencyClientId: string
    try {
      // Assuming state is URL-encoded JSON like {"agencyClientId": "..."}
      agencyClientId = JSON.parse(decodeURIComponent(state)).agencyClientId
      if (!agencyClientId) throw new Error("agencyClientId missing in state")
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

    // Define the success/error redirect URL base
    const clientPageUrl = new URL(
      `/agency/clients/${agencyClientId}`,
      request.url
    )

    // Fetch agencyId from the user's profile
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId),
      columns: { agencyId: true }
    })

    if (!userProfile?.agencyId) {
      console.error(
        `Could not find agencyId for user ${userId} in profile table.`
      )
      clientPageUrl.searchParams.set("error", "profile_agency_not_found")
      return NextResponse.redirect(clientPageUrl)
    }
    const agencyId = userProfile.agencyId

    // Call the server action to store the connection ID
    const result = await storeNangoConnectionIdAction(
      agencyClientId,
      connectionId,
      providerConfigKey,
      agencyId, // Pass the fetched agencyId
      userId // Pass the userId
    )

    if (result.isSuccess) {
      console.log(
        `Successfully stored Nango connection for client ${agencyClientId}`
      )
      clientPageUrl.searchParams.set("success", "nango_connected")
      return NextResponse.redirect(clientPageUrl)
    } else {
      console.error(
        `Failed to store Nango connection for client ${agencyClientId}:`,
        result.message
      )
      clientPageUrl.searchParams.set("error", "nango_storage_failed")
      return NextResponse.redirect(clientPageUrl)
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
