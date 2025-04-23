"use server"

import { db } from "@/db/db"
import { agencyClientsTable } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { and, eq, isNotNull } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

// Correct signature based on project examples:
// - ADD "use server"
// - Second arg destructures { params }
// - Type for params is Promise<{...}>
// - await params inside the function

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyClientId: string }> } // params is a Promise
) {
  try {
    const { userId } = await auth()
    // Await params before accessing the specific parameter
    const { agencyClientId } = await params

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!agencyClientId) {
      return NextResponse.json(
        { error: "Agency Client ID is required" },
        { status: 400 }
      )
    }

    // TODO: Add logic to verify the agencyClientId belongs to the user's agency
    // This might involve joining with an agencies table or checking a userId directly
    // on the agencyClientsTable if that relationship exists.
    // For now, we assume the user has access if they are logged in.

    const [client] = await db
      .select({
        id: agencyClientsTable.id,
        nangoConnectionTableId: agencyClientsTable.nangoConnectionTableId
      })
      .from(agencyClientsTable)
      .where(
        and(
          eq(agencyClientsTable.id, agencyClientId)
          // Add user/agency ownership check here, e.g.:
          // eq(agencyClientsTable.agencyId, user.agencyId) or eq(agencyClientsTable.userId, userId)
        )
      )
      .limit(1)

    // --- Add Detailed Logging ---
    console.log(
      `[API Check Status] Query Result for ${agencyClientId}:`,
      JSON.stringify(client, null, 2)
    )
    // --- End Logging ---

    if (!client) {
      // Add logging here too for clarity if client not found
      console.log(
        `[API Check Status] Client record not found for ID: ${agencyClientId}`
      )
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const isConnected = !!client.nangoConnectionTableId
    // Log the derived status as well
    console.log(
      `[API Check Status] Derived isConnected status for ${agencyClientId}: ${isConnected}`
    )

    return NextResponse.json({ isConnected }, { status: 200 })
  } catch (error) {
    console.error("Error checking Nango connection status:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
