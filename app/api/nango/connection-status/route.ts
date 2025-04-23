"use server"

import { db } from "@/db/db"
import { nangoConnectionsTable } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    await params

    const { userId, orgId: agencyId } = await auth() // Get current user/org

    if (!userId || !agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const nangoConnectionId = searchParams.get("nangoConnectionId")

    if (!nangoConnectionId) {
      return NextResponse.json(
        { error: "Missing 'nangoConnectionId' query parameter" },
        { status: 400 }
      )
    }

    // Find the connection record, ensuring it belongs to the current user/agency
    const connection = await db.query.nangoConnections.findFirst({
      where: and(
        eq(nangoConnectionsTable.nangoConnectionId, nangoConnectionId),
        eq(nangoConnectionsTable.agencyId, agencyId) // Verify ownership
        // Optional: Add eq(nangoConnectionsTable.userId, userId) if needed
      ),
      columns: {
        status: true
      }
    })

    const isConnected = connection?.status === "active"

    console.log(
      `[API Connection Status] Check for nangoConnectionId ${nangoConnectionId}, agency ${agencyId}: Found=${!!connection}, Status=${connection?.status}, isConnectedResult=${isConnected}`
    )

    return NextResponse.json({ isConnected: isConnected }, { status: 200 })
  } catch (error) {
    console.error("Error checking Nango connection status:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
