"use server"

import {
  initiateNangoConnectionAction,
  fetchGa4PropertiesAction
} from "@/actions/nango-actions"
import TestNangoConnectClient from "./_components/test-nango-connect-client"

// WARNING: This is a temporary development/test page. Remove or secure properly before production.

export default async function TestNangoConnectPage() {
  return (
    <div className="space-y-8 p-8">
      <h1 className="mb-4 text-2xl font-bold">Test Nango Connect & Fetch</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Enter the details for an EXISTING Agency Client record that has NOT yet
        been connected via Nango. Clicking the button will first get a Nango
        session token, then trigger the Nango frontend SDK to open the Google
        Auth popup. After successful connection (check DB for
        nango_connection_id), it will automatically attempt to fetch the GA4
        properties using the same Client ID and log the results to the
        **BROWSER** console.
      </p>
      <TestNangoConnectClient
        initiateAction={initiateNangoConnectionAction}
        fetchAction={fetchGa4PropertiesAction}
      />
    </div>
  )
}
