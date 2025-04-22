"use server"

import { db } from "@/db/db"
import { agencyClientsTable } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { and, eq, isNotNull } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: { agencyClientId: string } }
) {
  try {
    const { userId } = await auth()
    const { agencyClientId } = params

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
        nangoConnectionId: agencyClientsTable.nangoConnectionId
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

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const isConnected = !!client.nangoConnectionId

    return NextResponse.json({ isConnected }, { status: 200 })
  } catch (error) {
    console.error("Error checking Nango connection status:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
