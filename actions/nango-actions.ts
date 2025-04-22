"use server"

import { db } from "@/db/db"
import { agencyClientsTable } from "@/db/schema"
import { ActionState } from "@/types"
import { eq } from "drizzle-orm"
import { Nango } from "@nangohq/node"
import { revalidatePath } from "next/cache"
import { google } from "googleapis"
import { BetaAnalyticsDataClient } from "@google-analytics/data"

// Initialize Nango client - ensure env vars are set
const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!
})

// Initialize Google API client
const oauth2Client = new google.auth.OAuth2()

// Interface for GA4 property summary
interface Ga4PropertySummary {
  name: string // e.g., "properties/12345"
  displayName: string
}

/**
 * Initiates the Nango connection session.
 * Returns a session token that the frontend can use to open the Nango Connect UI.
 * @param agencyClientId - The ID of the agency client record in our DB (used as Nango's end user ID).
 * @param agencyId - The ID of the agency (used as Nango's organization ID).
 * @param providerConfigKey - The Nango provider config key (e.g., 'google-analytics').
 */
export async function initiateNangoConnectionAction(
  agencyClientId: string,
  agencyId: string,
  providerConfigKey: string
): Promise<ActionState<{ sessionToken: string }>> {
  try {
    if (!providerConfigKey) {
      throw new Error("Missing providerConfigKey.")
    }
    if (!process.env.NANGO_SECRET_KEY) {
      // Ensure secret key is loaded (Nango client init might not throw immediately)
      throw new Error("Nango secret key is not configured.")
    }

    console.log(
      `Creating Nango connect session for client: ${agencyClientId}, agency: ${agencyId}, provider: ${providerConfigKey}`
    )

    // Ask Nango for a secure session token
    const result = await nango.createConnectSession({
      end_user: {
        // Using agencyClientId as the unique identifier for the end user connection in Nango
        id: agencyClientId
        // email and display_name are optional
      },
      organization: {
        // Using agencyId as the organization identifier in Nango
        id: agencyId
        // display_name is optional
      },
      // Only allow connecting the specific integration requested
      allowed_integrations: [providerConfigKey]
      // integrations_config_defaults could be used later if needed
    })

    if (!result?.data?.token) {
        throw new Error("Failed to retrieve session token from Nango API.");
    }

    const sessionToken = result.data.token;
    console.log(`Nango session token generated successfully for client: ${agencyClientId}`)

    // Return the session token to the frontend
    return {
      isSuccess: true,
      message: "Nango session token generated successfully.",
      data: { sessionToken }
    }
  } catch (error: any) {
    console.error("Error creating Nango connect session:", error)
    return {
      isSuccess: false,
      message: `Failed to create Nango connect session: ${error.message || error}`
    }
  }
}

/**
 * Stores the Nango connection ID received from the callback into the database.
 * Called by the /api/nango/callback route.
 * @param agencyClientId - The ID of the agency client (passed via state).
 * @param nangoConnectionId - The connection ID received from Nango.
 */
export async function storeNangoConnectionIdAction(
  agencyClientId: string,
  nangoConnectionId: string
): Promise<ActionState<void>> {
  try {
    console.log(
      `Storing Nango connection ID ${nangoConnectionId} for agency client ${agencyClientId}`
    )

    // Find the client and update it
    // Note: We might need agencyId here if RLS is strictly enforced on updates.
    // For simplicity now, we assume the agencyClientId is globally unique enough or RLS is handled via session.
    const [updatedClient] = await db
      .update(agencyClientsTable)
      .set({
        nangoConnectionId: nangoConnectionId,
        credentialStatus: "validated", // Update status as connection is made
        updatedAt: new Date()
      })
      .where(eq(agencyClientsTable.id, agencyClientId))
      .returning({ id: agencyClientsTable.id })

    if (!updatedClient) {
      throw new Error(
        `Agency client with ID ${agencyClientId} not found during Nango callback.`
      )
    }

    // Revalidate the path for the client details page to reflect the change
    revalidatePath(`/agency/clients/${agencyClientId}`)
    revalidatePath(`/agency/clients`) // Also revalidate the list page

    return {
      isSuccess: true,
      message: "Nango connection ID stored successfully.",
      data: undefined
    }
  } catch (error: any) {
    console.error("Error storing Nango connection ID:", error)
    return {
      isSuccess: false,
      message: `Failed to store Nango connection ID: ${error.message || error}`
    }
  }
}

/**
 * Fetches the list of GA4 properties accessible by the connected account.
 * Requires a valid Nango connection to be stored first.
 * @param agencyClientId - The ID of the agency client record.
 */
export async function fetchGa4PropertiesAction(
  agencyClientId: string
): Promise<ActionState<Ga4PropertySummary[]>> {
  try {
    console.log(`Fetching GA4 properties for agency client: ${agencyClientId}`)

    // 1. Get Nango connection details from DB
    // TODO: Add agencyId check here if RLS is implemented via helpers
    const clientRecord = await db.query.agencyClients.findFirst({
      where: eq(agencyClientsTable.id, agencyClientId),
      columns: {
        nangoConnectionId: true,
        nangoProviderConfigKey: true
      }
    })

    if (!clientRecord?.nangoConnectionId || !clientRecord?.nangoProviderConfigKey) {
      throw new Error(
        "Nango connection details not found or incomplete for this client."
      )
    }

    // 2. Fetch fresh access token from Nango
    console.log(`Fetching Nango token for connection: ${clientRecord.nangoConnectionId}`)
    const connection = await nango.getConnection(clientRecord.nangoProviderConfigKey, clientRecord.nangoConnectionId);

    // Type guard to ensure we have OAuth2 credentials
    if (connection.credentials.type !== 'OAUTH2') {
        throw new Error("Connection does not use OAuth2 credentials, cannot retrieve access token.");
    }

    // Now TypeScript knows credentials is OAuth2Credentials
    const accessToken = connection.credentials.access_token;

    if (!accessToken) {
        throw new Error("Failed to retrieve access token from Nango connection.");
    }

    console.log("Successfully retrieved access token from Nango.")

    // 3. Set credentials for Google API client
    oauth2Client.setCredentials({ access_token: accessToken })

    // 4. Initialize Google Analytics Admin API client
    const adminClient = google.analyticsadmin({
      version: "v1beta", // Or v1alpha if needed
      auth: oauth2Client
    })

    // 5. List Account Summaries to find accessible properties
    // We list summaries as it's often the most direct way to get properties
    // a user has access to, even across multiple accounts.
    console.log("Listing GA Account Summaries using Admin API...")
    const accountSummaries = await adminClient.accountSummaries.list()

    const properties: Ga4PropertySummary[] = []
    if (accountSummaries.data.accountSummaries) {
      for (const summary of accountSummaries.data.accountSummaries) {
        if (summary.propertySummaries) {
          for (const propSummary of summary.propertySummaries) {
            if (propSummary.property && propSummary.displayName) {
              properties.push({
                name: propSummary.property, // e.g., "properties/12345"
                displayName: propSummary.displayName
              })
            }
          }
        }
      }
    }

    console.log(`Found ${properties.length} accessible GA4 properties.`) 

    return {
      isSuccess: true,
      message: "Successfully fetched GA4 properties.",
      data: properties
    }
  } catch (error: any) {
    console.error("Error fetching GA4 properties:", error)
    // Check for specific Google API errors if needed
    let message = `Failed to fetch GA4 properties: ${error.message || error}`;
    if (error.code === 403) {
        message = "Permission denied. Ensure the connection has the 'analytics.readonly' scope and the Admin API is enabled.";
    }
    return {
      isSuccess: false,
      message: message
    }
  }
} 