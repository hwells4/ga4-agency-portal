"use client"

import { useState } from "react"
import Nango from "@nangohq/frontend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionState } from "@/types"

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

    try {
      // 1. Initiate Nango connection to get session token
      console.log("Calling initiateAction...")
      const initiateResult = await initiateAction(
        agencyClientId,
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

      // 2. Use Nango Frontend SDK to open the popup
      const nangoFrontend = new Nango() // Initialize frontend SDK

      setMessage(
        "Nango popup should open. Please complete Google authentication."
      )

      // Wrap the nango auth flow in a promise to await its completion/result
      const nangoAuthPromise = new Promise<void>((resolve, reject) => {
        const connectUI = nangoFrontend.openConnectUI({
          sessionToken: sessionToken,
          onEvent: event => {
            console.log("Nango UI Event:", event)
            if (event.type === "connect") {
              // SUCCESS!
              console.log(
                "Nango connection successful via frontend SDK! Connection ID:",
                event.payload.connectionId
              )
              setMessage(
                "Nango connection successful! Now attempting to fetch properties..."
              )
              resolve() // Resolve the promise on successful connection
            } else if (event.type === "close") {
              // User closed the popup or auth failed in some way
              console.error("Nango popup closed or authorization failed.")
              reject(new Error("Nango authorization cancelled or failed."))
            }
            // Handle other event types if needed (error, etc.)
          }
        })
      })

      // Wait for the Nango connection process to complete (or fail)
      await nangoAuthPromise

      // 3. If Nango connection succeeded, fetch GA4 properties
      // Small delay to allow backend callback to potentially process
      await new Promise(resolve => setTimeout(resolve, 1500))

      console.log("Calling fetchAction...")
      const fetchResult = await fetchAction(agencyClientId)

      if (fetchResult.isSuccess) {
        console.log("---------------------------------------------------------")
        console.log("FETCHED GA4 PROPERTIES (Browser Console):")
        console.log(JSON.stringify(fetchResult.data, null, 2))
        console.log("---------------------------------------------------------")
        setMessage(
          `Successfully fetched ${fetchResult.data.length} properties. Check browser console.`
        )
      } else {
        throw new Error(
          fetchResult.message ||
            "Failed to fetch GA4 properties after connection."
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
        {isLoading ? "Processing..." : "Connect & Fetch Properties"}
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
