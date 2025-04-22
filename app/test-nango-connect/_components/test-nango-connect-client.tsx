"use client"

import { useState } from "react"
import Nango from "@nangohq/frontend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionState } from "@/types"

// DO NOT import store action here
// import { storeNangoConnectionIdAction } from "@/actions/nango-actions"

// Define the types for the server action props
type InitiateActionType = (
  agencyClientId: string,
  agencyId: string,
  providerConfigKey: string
) => Promise<ActionState<{ sessionToken: string }>>

type FetchActionType = (agencyClientId: string) => Promise<ActionState<any[]>> // Using any[] for simplicity, define specific type if needed

interface TestNangoConnectClientProps {
  initiateAction: InitiateActionType
  fetchAction: FetchActionType
}

export default function TestNangoConnectClient({
  initiateAction,
  fetchAction
}: TestNangoConnectClientProps) {
  const [agencyClientId, setAgencyClientId] = useState("")
  const [agencyId, setAgencyId] = useState("")
  const [providerConfigKey, setProviderConfigKey] = useState("google-analytics")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleConnectAndFetch = async () => {
    setIsLoading(true)
    setMessage(null)
    console.log("Attempting to connect and fetch for client:", agencyClientId)
    const currentAgencyClientId = agencyClientId // Capture value for use in callbacks

    try {
      // 1. Initiate Nango connection
      console.log("Calling initiateAction...")
      const initiateResult = await initiateAction(
        currentAgencyClientId,
        agencyId,
        providerConfigKey
      )
      if (!initiateResult.isSuccess || !initiateResult.data?.sessionToken) {
        throw new Error(
          initiateResult.message || "Failed to get Nango session token."
        )
      }
      const sessionToken = initiateResult.data.sessionToken
      console.log("Received session token:", sessionToken)

      // 2. Open Nango Frontend UI
      const nangoFrontend = new Nango()
      setMessage(
        "Nango popup should open. Please complete Google authentication. Backend webhook MUST be configured to store connection."
      )

      const nangoAuthPromise = new Promise<string>((resolve, reject) => {
        nangoFrontend.openConnectUI({
          sessionToken: sessionToken,
          onEvent: event => {
            console.log("Nango UI Event:", event)
            if (event.type === "connect") {
              const connectionId = event.payload.connectionId
              console.log(
                "Nango connection successful via frontend SDK! Connection ID:",
                connectionId
              )
              setMessage(
                "Nango connection successful via popup! Waiting for backend webhook to store ID..."
              )
              resolve(connectionId) // Resolve the promise with connectionId
            } else if (event.type === "close") {
              console.error("Nango popup closed or authorization failed.")
              reject(new Error("Nango authorization cancelled or failed."))
            }
          }
        })
      })

      // Wait for Nango connection popup process to finish
      const connectionId = await nangoAuthPromise
      console.log(`Nango connection attempt completed for ID ${connectionId}.`)

      // 3. Fetch GA4 properties (assuming webhook worked)
      setMessage(
        "Connection attempt done. Now trying to fetch properties (requires webhook to have worked)..."
      )
      // Give webhook a bit more time
      await new Promise(resolve => setTimeout(resolve, 3000))

      console.log("Calling fetchAction...")
      const fetchResult = await fetchAction(currentAgencyClientId) // Use captured ID

      if (fetchResult.isSuccess) {
        console.log("---------------------------------------------------------")
        console.log("FETCHED GA4 PROPERTIES (Browser Console):")
        console.log(JSON.stringify(fetchResult.data, null, 2))
        console.log("---------------------------------------------------------")
        setMessage(
          `Successfully fetched ${fetchResult.data.length} properties. Check browser console.`
        )
      } else {
        // If this fails, it's likely the webhook didn't update the DB
        throw new Error(
          fetchResult.message ||
            "Failed to fetch GA4 properties after connection (Likely webhook issue)."
        )
      }
    } catch (error: any) {
      console.error("Connect & Fetch Error:", error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded border p-4">
      <div>
        <Label htmlFor="agencyClientId">Agency Client ID (UUID)</Label>
        <Input
          id="agencyClientId"
          value={agencyClientId}
          onChange={e => setAgencyClientId(e.target.value)}
          type="text"
          required
          placeholder="Enter the agency_clients.id UUID"
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="agencyId">Agency ID (User ID)</Label>
        <Input
          id="agencyId"
          value={agencyId}
          onChange={e => setAgencyId(e.target.value)}
          type="text"
          required
          placeholder="Enter the agency_clients.agency_id (Clerk User ID)"
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="providerConfigKey">Provider Config Key</Label>
        <Input
          id="providerConfigKey"
          value={providerConfigKey}
          onChange={e => setProviderConfigKey(e.target.value)}
          type="text"
          required
          placeholder="e.g., google-analytics"
          disabled={isLoading}
        />
      </div>
      <Button
        onClick={handleConnectAndFetch}
        disabled={
          isLoading || !agencyClientId || !agencyId || !providerConfigKey
        }
      >
        {isLoading
          ? "Processing..."
          : "Connect & Fetch Properties (Requires Webhook)"}
      </Button>
      {message && (
        <p
          className={`mt-4 text-sm ${message.startsWith("Error:") ? "text-red-600" : "text-green-600"}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
