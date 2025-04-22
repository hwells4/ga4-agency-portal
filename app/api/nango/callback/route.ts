import { NextRequest, NextResponse } from "next/server"
import { storeNangoConnectionIdAction } from "@/actions/nango-actions"

// Example URL: /api/nango/callback?connectionId=UNIQUE_NANGO_CONNECTION_ID&providerConfigKey=google-analytics&error=...&state=...

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const nangoConnectionId = searchParams.get("connectionId") // Nango typically uses 'connectionId'
  const error = searchParams.get("error")
  // Nango uses the 'connection_id' you passed in the initial auth request as state by default
  // This *should* correspond to our agencyClientId if we initiated correctly
  const agencyClientId = searchParams.get("state")

  console.log("Nango Callback Received:")
  console.log("  connectionId:", nangoConnectionId)
  console.log("  agencyClientId (from state):", agencyClientId)
  console.log("  error:", error)

  if (error) {
    console.error("Nango callback error:", error)
    // Redirect user to an error page or back to the client page with an error param
    const redirectUrl = new URL(
      `/agency/clients/${agencyClientId || ""}?error=nango_auth_failed`, // Redirect back to client page
      request.nextUrl.origin
    )
    return NextResponse.redirect(redirectUrl)
  }

  if (!nangoConnectionId || !agencyClientId) {
    console.error(
      "Nango callback missing required parameters (connectionId or state/agencyClientId)."
    )
    // Redirect to a generic error page or dashboard
    const redirectUrl = new URL(
      "/agency?error=nango_callback_invalid",
      request.nextUrl.origin
    )
    return NextResponse.redirect(redirectUrl)
  }

  try {
    // Call the server action to store the Nango connection ID in the database
    const result = await storeNangoConnectionIdAction(
      agencyClientId,
      nangoConnectionId
    )

    if (!result.isSuccess) {
      throw new Error(result.message)
    }

    console.log(
      `Successfully stored Nango connection ID ${nangoConnectionId} for agency client ${agencyClientId}`
    )

    // Redirect user back to the client details page upon success
    const redirectUrl = new URL(
      `/agency/clients/${agencyClientId}?success=nango_connected`, // Indicate success
      request.nextUrl.origin
    )
    return NextResponse.redirect(redirectUrl)
  } catch (e: any) {
    console.error("Error processing Nango callback:", e)
    // Redirect user to an error page or back to the client page with an error param
    const redirectUrl = new URL(
      `/agency/clients/${agencyClientId}?error=nango_callback_process_failed`,
      request.nextUrl.origin
    )
    return NextResponse.redirect(redirectUrl)
  }
}
