import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/db"
import { agencyClientsTable } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SHARED_SECRET
  const receivedSecret = request.headers.get("X-Internal-Secret")

  // Get client identifier from query params
  const clientIdentifier = request.nextUrl.searchParams.get("client_identifier")

  // --- Security Check ---
  if (!internalSecret) {
    console.error(
      "INTERNAL_API_SHARED_SECRET is not set in environment variables."
    )
    return NextResponse.json(
      { error: "Internal server configuration error" },
      { status: 500 }
    )
  }
  if (!receivedSecret || receivedSecret !== internalSecret) {
    console.warn("Invalid or missing secret received for internal API.")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!clientIdentifier) {
    return NextResponse.json(
      { error: "Missing 'client_identifier' query parameter" },
      { status: 400 }
    )
  }

  console.log(
    `Internal API /get-creds called for client_identifier: ${clientIdentifier}`
  )

  try {
    // --- Database Lookup Logic ---
    const client = await db.query.agencyClients.findFirst({
      where: eq(agencyClientsTable.clientIdentifier, clientIdentifier),
      columns: {
        ga4PropertyId: true,
        nangoConnectionId: true,
        nangoProviderConfigKey: true // Include the new field
      }
    })

    if (!client) {
      console.warn(
        `Client not found for identifier: ${clientIdentifier} in internal API.`
      )
      return NextResponse.json(
        { error: `Client not found for identifier: ${clientIdentifier}` },
        { status: 404 }
      )
    }

    if (!client.nangoConnectionId || !client.nangoProviderConfigKey) {
      console.error(
        `Client ${clientIdentifier} found, but missing Nango details (connectionId or providerConfigKey).`
      )
      return NextResponse.json(
        { error: "Client Nango configuration incomplete." },
        { status: 500 } // Internal configuration issue
      )
    }

    // Prepare response data - use snake_case if Repo 1 expects it
    const responseData = {
      property_id: client.ga4PropertyId,
      nango_connection_id: client.nangoConnectionId,
      nango_provider_config_key: client.nangoProviderConfigKey // Return the key
    }

    return NextResponse.json(responseData, { status: 200 })
  } catch (error: any) {
    console.error(
      `Error fetching client details for ${clientIdentifier} in internal API:`,
      error
    )
    return NextResponse.json(
      { error: "Internal server error retrieving client details." },
      { status: 500 }
    )
  }
}

// Optional: Add basic handling for other methods if needed, though GET is likely sufficient
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
// ... add similar handlers for PUT, DELETE etc. if desired, returning 405
