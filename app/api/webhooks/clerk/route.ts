import { Webhook } from "svix"
import { WebhookEvent } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// We'll add the action import and logic here later
// import { createInitialAgencyAndProfileAction } from "@/actions/db/users-actions"

// Use NextRequest type for the request object in Route Handlers
import type { NextRequest } from "next/server"

// Import the new action
import { createAgencyAction } from "@/actions/db/agencies-actions"

export async function POST(req: NextRequest) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    )
  }

  // Access headers directly from the request object
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Webhook Error: Missing Svix headers")
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 })
  }

  // Get the body
  // Note: req.json() consumes the request body stream, call it only once.
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  // Verify the payload
  try {
    // Use the stringified body for verification
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature
    }) as WebhookEvent
  } catch (err: any) {
    console.error("Error verifying webhook:", err.message)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  // Extract event details
  const eventType = evt.type
  // Log basic info, avoid logging full body in production
  console.log(`Received Clerk webhook: Type=${eventType}`)

  // --- Handle organization.created event ---
  if (eventType === "organization.created") {
    // Destructure payload, createdByUserId might be undefined
    const { id: orgId, name: orgName, created_by: createdByUserId } = evt.data

    // Minimal validation: Ensure orgId and orgName exist, as they are crucial.
    if (!orgId || !orgName) {
      console.error(
        `Webhook Error (organization.created): Missing OrgID or Name. OrgID=${orgId}, Name=${orgName}`
      )
      return NextResponse.json(
        { error: "Missing organization ID or Name in webhook payload" },
        { status: 400 }
      )
    }

    console.log(
      `Processing organization.created: OrgID=${orgId}, Name=${orgName}, Creator=${createdByUserId || "N/A (Admin?)"}`
    )

    // Call the action to create Agency, passing potentially undefined creator ID
    try {
      const result = await createAgencyAction(orgId, orgName, createdByUserId)

      if (!result.isSuccess) {
        console.error(
          `Webhook Error (organization.created): Failed to create agency for ${orgId}: ${result.message}`
        )
        return NextResponse.json(
          { error: "Failed to create agency record" },
          { status: 500 }
        )
      }

      console.log(
        `Webhook Success (organization.created): Agency created for OrgID: ${orgId}`
      )
    } catch (error: any) {
      console.error(
        `Webhook Exception (organization.created): Error processing agency creation for ${orgId}:`,
        error.message
      )
      return NextResponse.json(
        { error: "Internal server error during agency creation" },
        { status: 500 }
      )
    }
  }

  // --- Handle user.created event (If needed for Profile creation) ---
  else if (eventType === "user.created") {
    console.log("Ignoring user.created event for now.")
  }

  // Add handlers for other events like user.updated, user.deleted if needed
  // Example: Handle organizationMembership.created to link profile to agency?

  // Acknowledge receipt of the webhook
  return NextResponse.json(
    { message: "Webhook received successfully" },
    { status: 200 }
  )
}
