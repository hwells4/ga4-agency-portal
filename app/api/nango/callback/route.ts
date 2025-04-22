import { NextRequest, NextResponse } from "next/server"
import { storeNangoConnectionIdAction } from "@/actions/nango-actions"

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
    const result = await storeNangoConnectionIdAction(
      agencyClientId,
      nangoConnectionId
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

// Keep the GET handler commented out or remove if not needed
/*
export async function GET(request: NextRequest) {
  // ... previous GET logic if needed for manual testing/debugging, but POST is primary
  return NextResponse.json({ error: "Use POST for Nango webhooks" }, { status: 405 })
}
*/
