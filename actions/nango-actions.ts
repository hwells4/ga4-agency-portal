"use server"

import { db } from "@/db/db"
import { agencyClientsTable, nangoConnectionsTable } from "@/db/schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"
import { Nango } from "@nangohq/node"
import { revalidatePath } from "next/cache"
import { google } from "googleapis"
import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { auth } from "@clerk/nextjs/server"

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
 * Looks up connection details using the nangoConnectionId.
 * @param nangoConnectionId - The Nango connection ID.
 */
export async function fetchGa4PropertiesAction(
  nangoConnectionId: string
): Promise<ActionState<Ga4PropertySummary[]>> {
  try {
    console.log(`Fetching GA4 properties for Nango connection: ${nangoConnectionId}`);

    // --- Modified auth check: Rely primarily on userId ---
    const authResult = await auth();
    const userId = authResult.userId;
    // Get orgId separately, it might be null
    const agencyId = authResult.orgId; 

    if (!userId) {
      // Only throw the critical error if userId is missing
      throw new Error("User not authenticated."); 
    }
    console.log(`Authenticated user: ${userId}, Attempting with agencyId: ${agencyId}`);
    // --- End modified auth check ---

    // 1. Get Nango connection details from DB using nangoConnectionId
    // Modify the query to handle potentially null agencyId if needed, 
    // or fetch agencyId based on userId if that relationship exists.
    // For now, let's proceed assuming agencyId *might* be present or the query is adapted.
    // --> We MUST ensure the query still guarantees ownership <--

    // Option 1: Still use agencyId if available (assuming the auth issue was only the throw)
    // If agencyId is null here, this query will likely fail to find the record, 
    // which might be desired behavior if agency context is strictly required.
    if (!agencyId) {
        console.warn(`Agency ID (orgId) not found in auth context for user ${userId}. Querying connection without agency constraint.`);
         // Potentially throw error here if agency context is mandatory for security
         // throw new Error("Agency context (orgId) is missing, cannot verify connection ownership.");
    }

    const connectionRecord = await db.query.nangoConnections.findFirst({
      where: agencyId 
        ? and( // If agencyId exists, use it
            eq(nangoConnectionsTable.nangoConnectionId, nangoConnectionId),
            eq(nangoConnectionsTable.agencyId, agencyId) // Ensure ownership via agencyId
          )
        : and( // If agencyId is missing, rely on userId (assuming userId exists on table)
            eq(nangoConnectionsTable.nangoConnectionId, nangoConnectionId),
            eq(nangoConnectionsTable.userId, userId) // Ensure ownership via userId
          ),
      columns: {
        nangoConnectionId: true, 
        providerConfigKey: true,
        status: true,
        // Include agencyId and userId if needed for logging/verification
        agencyId: true, 
        userId: true 
      },
    });

    // Add more logging after query
    if (connectionRecord) {
        console.log(`Found connection record for nangoId ${nangoConnectionId}: agencyId=${connectionRecord.agencyId}, userId=${connectionRecord.userId}, status=${connectionRecord.status}`);
    } else {
        console.log(`Connection record NOT FOUND for nangoId ${nangoConnectionId} with constraints userId=${userId}` + (agencyId ? ` AND agencyId=${agencyId}` : ' (agencyId missing)') );
    }


    if (!connectionRecord) {
        // Make error message more specific based on what was used for lookup
        const lookupCriteria = agencyId ? `belonging to agency ${agencyId}` : `initiated by user ${userId}`;
        throw new Error(`Nango connection record not found for ID: ${nangoConnectionId} ${lookupCriteria}.`);
    }

    // Verify ownership again explicitly if needed (belt and suspenders)
    if (agencyId && connectionRecord.agencyId !== agencyId) {
        throw new Error(`Ownership mismatch: Connection record agency (${connectionRecord.agencyId}) does not match authenticated agency (${agencyId}).`);
    }
     if (connectionRecord.userId !== userId) {
        throw new Error(`Ownership mismatch: Connection record user (${connectionRecord.userId}) does not match authenticated user (${userId}).`);
    }

    if (connectionRecord.status !== 'active') {
        throw new Error(`Nango connection ${nangoConnectionId} is not active (status: ${connectionRecord.status}). Cannot fetch properties.`);
    }

    if (!connectionRecord.providerConfigKey) {
         throw new Error(`Provider config key not found for Nango connection ${nangoConnectionId}.`);
    }

    const { providerConfigKey } = connectionRecord;

    // 2. Fetch fresh access token from Nango
    console.log(`Fetching Nango token for connection: ${nangoConnectionId}`);
    const connection = await nango.getConnection(
      providerConfigKey,
      nangoConnectionId // Use the verified nangoConnectionId
    );

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
    console.error(`Error fetching GA4 properties for Nango connection ${nangoConnectionId}:`, error);
     let message = `Failed to fetch GA4 properties: ${error.message || error}`;
    if (error.code === 403) {
        message = "Permission denied. Ensure the connection has the 'analytics.readonly' scope and the Admin API is enabled.";
    } else if (error.message?.includes("not found")) {
        message = `Nango connection ${nangoConnectionId} not found or access denied.`;
    }
    return {
      isSuccess: false,
      message: message,
    };
  }
} 