"use server"

import { db } from "@/db/db"
import { agencyClientsTable, nangoConnectionsTable } from "@/db/schema"
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
 * Initiates the Nango connection session for an agency.
 * Returns a session token that the frontend can use to open the Nango Connect UI.
 * Uses userId as Nango's end user ID for this specific connection instance.
 * Uses agencyId as Nango's organization ID.
 * @param agencyId - The ID of the agency (used as Nango's organization ID).
 * @param userId - The ID of the user initiating the connection (used as Nango's end user ID).
 * @param providerConfigKey - The Nango provider config key (e.g., 'google-analytics').
 */
export async function initiateNangoConnectionAction(
  agencyId: string,
  userId: string,
  providerConfigKey: string
): Promise<ActionState<{ sessionToken: string }>> {
  try {
    if (!providerConfigKey) {
      throw new Error("Missing providerConfigKey.")
    }
    if (!agencyId || !userId) {
      // Ensure agencyId and userId are provided
      throw new Error("Missing agencyId or userId.")
    }
    if (!process.env.NANGO_SECRET_KEY) {
      // Ensure secret key is loaded (Nango client init might not throw immediately)
      throw new Error("Nango secret key is not configured.")
    }

    console.log(
      `Creating Nango connect session for user: ${userId}, agency: ${agencyId}, provider: ${providerConfigKey}`
    )

    // Define the state to pass to Nango and receive back in the callback
    // Useful for context in the callback handler
    const statePayload = JSON.stringify({ agencyId: agencyId, userId: userId });

    // Ask Nango for a secure session token
    const result = await nango.createConnectSession({
      end_user: {
        id: userId
      },
      organization: {
        id: agencyId
      },
      allowed_integrations: [providerConfigKey],
      // Pass state via integrations_config_defaults, keyed by providerConfigKey
      integrations_config_defaults: {
        [providerConfigKey]: { // Key is the provider config key
           connection_config: { // Embed custom params here
              state: statePayload
           }
        }
      }
    })

    if (!result?.data?.token) {
        throw new Error("Failed to retrieve session token from Nango API.");
    }

    const sessionToken = result.data.token;
    console.log(`Nango session token generated successfully for user: ${userId}, agency: ${agencyId}`)

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
 * Stores the Nango connection details received from the callback into the database.
 * Creates a new record in nangoConnectionsTable linked to the agency and user.
 * Called by the /api/nango/callback GET handler.
 * @param nangoConnectionId - The connection ID received from Nango.
 * @param nangoProviderConfigKey - The provider config key received from Nango.
 * @param agencyId - The ID of the agency associated with this connection.
 * @param userId - The ID of the user who initiated the connection.
 */
export async function storeNangoConnectionIdAction(
  nangoConnectionId: string,
  nangoProviderConfigKey: string,
  agencyId: string,
  userId: string
): Promise<ActionState<{ nangoConnectionRecordId: string }>> {
  try {
    // Basic validation
    if (!agencyId || !userId || !nangoConnectionId || !nangoProviderConfigKey) {
        throw new Error("Missing required parameters to store Nango connection.");
    }

    console.log(
      `Storing Nango connection ID ${nangoConnectionId} (provider: ${nangoProviderConfigKey}) for agency: ${agencyId}, user: ${userId}`
    );

    // 1. Create the Nango Connection record (removed client linkage logic)
    const [nangoConnectionRecord] = await db
      .insert(nangoConnectionsTable)
      .values({
        nangoConnectionId: nangoConnectionId,
        providerConfigKey: nangoProviderConfigKey,
        agencyId: agencyId,
        userId: userId,
        status: "active", // Set to active immediately upon successful callback storage
      })
      .onConflictDoUpdate({
        target: nangoConnectionsTable.nangoConnectionId,
        set: {
          providerConfigKey: nangoProviderConfigKey,
          agencyId: agencyId,
          userId: userId,
          status: "active", // Update status to active on conflict too
          updatedAt: new Date(),
        },
      })
      .returning({ id: nangoConnectionsTable.id });

    if (!nangoConnectionRecord?.id) {
      throw new Error(
        `Failed to create or find Nango connection record for Nango ID: ${nangoConnectionId}`
      );
    }

    const newRecordId = nangoConnectionRecord.id;
    console.log(
      `Nango connection record ID: ${newRecordId} created/updated successfully for Nango ID: ${nangoConnectionId}`
    );

    // NO LONGER updating agencyClientsTable here

    // NO LONGER revalidating paths for a specific client
    // Revalidate a general connections or settings path if needed later
    // revalidatePath(`/agency/settings/connections`) // Example

    return {
      isSuccess: true,
      message: "Nango connection details stored successfully.",
      data: { nangoConnectionRecordId: newRecordId } // Return the ID of the created record
    };
  } catch (error: any) {
    console.error("Error storing Nango connection details:", error);
    // Ensure the error message is specific
    let message = "Failed to store Nango connection details.";
    if (error instanceof Error) {
        message = `${message} ${error.message}`;
    }
    return {
      isSuccess: false,
      message: message,
    };
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

    // 1. Get Nango connection details by joining AgencyClient and NangoConnection
    // TODO: Add agencyId check here if RLS is implemented via helpers
    const clientWithConnection = await db
      .select({
        nangoConnectionId: nangoConnectionsTable.nangoConnectionId,
        nangoProviderConfigKey: nangoConnectionsTable.providerConfigKey
      })
      .from(agencyClientsTable)
      .innerJoin(
        nangoConnectionsTable,
        eq(agencyClientsTable.nangoConnectionTableId, nangoConnectionsTable.id)
      )
      .where(eq(agencyClientsTable.id, agencyClientId))
      .limit(1) // Expecting only one result
      .then((results) => results[0]) // Get the first result or undefined

    if (
      !clientWithConnection?.nangoConnectionId ||
      !clientWithConnection?.nangoProviderConfigKey
    ) {
      throw new Error(
        "Nango connection details not found or incomplete for this client."
      )
    }

    const { nangoConnectionId, nangoProviderConfigKey } = clientWithConnection

    // 2. Fetch fresh access token from Nango
    console.log(`Fetching Nango token for connection: ${nangoConnectionId}`)
    const connection = await nango.getConnection(
      nangoProviderConfigKey,
      nangoConnectionId
    )

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