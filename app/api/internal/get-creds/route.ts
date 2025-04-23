import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db/db"
import { agencyClientsTable, nangoConnectionsTable } from "@/db/schema"
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
    // Join agencyClientsTable with nangoConnectionsTable
    const clientWithConnection = await db
      .select({
        // Select required fields from both tables
        propertyId: agencyClientsTable.propertyId,
        nangoConnectionId: nangoConnectionsTable.nangoConnectionId,
        providerConfigKey: nangoConnectionsTable.providerConfigKey
      })
      .from(agencyClientsTable)
      .innerJoin(
        nangoConnectionsTable,
        eq(agencyClientsTable.nangoConnectionTableId, nangoConnectionsTable.id)
      )
      .where(eq(agencyClientsTable.clientIdentifier, clientIdentifier))
      .limit(1) // Expecting only one result
      .then(results => results[0]) // Get the first result or undefined

    if (!clientWithConnection) {
      console.warn(
        `Client or linked Nango connection not found for identifier: ${clientIdentifier} in internal API.`
      )
      return NextResponse.json(
        {
          error: `Client or linked Nango connection not found for identifier: ${clientIdentifier}`
        },
        { status: 404 }
      )
    }

    // Check if the necessary fields were successfully retrieved from the join
    if (
      !clientWithConnection.propertyId || // Check propertyId too
      !clientWithConnection.nangoConnectionId ||
      !clientWithConnection.providerConfigKey
    ) {
      console.error(
        `Client ${clientIdentifier} found, but missing required details (propertyId, nangoConnectionId, or providerConfigKey) after join.`
      )
      return NextResponse.json(
        { error: "Client configuration details incomplete." },
        { status: 500 } // Internal configuration issue
      )
    }

    // Prepare response data - use snake_case as expected by Repo 1
    const responseData = {
      property_id: clientWithConnection.propertyId,
      nango_connection_id: clientWithConnection.nangoConnectionId,
      nango_provider_config_key: clientWithConnection.providerConfigKey
    }

    console.log(
      `Internal API /get-creds returning data for ${clientIdentifier}:`,
      responseData
    )

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
