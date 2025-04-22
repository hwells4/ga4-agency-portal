"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Nango from "@nangohq/frontend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
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

// Define the expected structure of the API response
interface CheckStatusResponse {
  isConnected: boolean
  error?: string
}

export default function TestNangoConnectClient({
  initiateAction,
  fetchAction
}: TestNangoConnectClientProps) {
  const { toast } = useToast()
  const [agencyClientId, setAgencyClientId] = useState("")
  const [agencyId, setAgencyId] = useState("")
  const [providerConfigKey, setProviderConfigKey] = useState("google-analytics")
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollAttemptsRef = useRef(0)
  const MAX_POLL_ATTEMPTS = 10 // e.g., 10 attempts * 3 seconds = 30 seconds timeout
  const POLLING_INTERVAL_MS = 3000 // Poll every 3 seconds

  // --- Polling Logic --- START ---
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
    pollAttemptsRef.current = 0
  }, [])

  const startPolling = useCallback(
    async (clientIdToPoll: string) => {
      clearPolling()
      setIsPolling(true)
      setMessage("Verifying connection with Google... Please wait.")
      pollAttemptsRef.current = 0
      setErrorMessage(null)

      pollingIntervalRef.current = setInterval(async () => {
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearPolling()
          const errorMsg =
            "Connection status check timed out. Please try again."
          setErrorMessage(errorMsg)
          setMessage(null) // Clear progress message
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive"
          })
          setIsLoading(false) // Stop loading indicator on timeout
          return
        }

        pollAttemptsRef.current += 1
        console.log(
          `Polling attempt ${pollAttemptsRef.current} for ${clientIdToPoll}`
        )

        try {
          const response = await fetch(
            `/api/nango/check-status/${clientIdToPoll}`
          )
          if (!response.ok) {
            console.warn(`Polling check failed with status: ${response.status}`)
            // Optionally handle specific non-OK statuses if needed
            return // Continue polling unless it's a definitive error
          }

          const data: CheckStatusResponse = await response.json()

          if (data.isConnected) {
            console.log("Polling successful: Connection confirmed.")
            clearPolling()
            toast({
              title: "Success",
              description:
                "Client connected successfully. Fetching properties..."
            })
            setMessage("Connection confirmed. Fetching GA4 properties...")

            // Now fetch the properties using the passed fetchAction
            const fetchResult = await fetchAction(clientIdToPoll)
            if (fetchResult.isSuccess) {
              console.log(
                "---------------------------------------------------------"
              )
              console.log("FETCHED GA4 PROPERTIES (Browser Console):")
              console.log(JSON.stringify(fetchResult.data, null, 2))
              console.log(
                "---------------------------------------------------------"
              )
              setMessage(
                `Successfully fetched ${fetchResult.data.length} properties. Check browser console.`
              )
              setErrorMessage(null)
            } else {
              const errorMsg =
                fetchResult.message || "Failed to fetch GA4 properties."
              setErrorMessage(errorMsg)
              setMessage(null)
              toast({
                title: "Error Fetching Properties",
                description: errorMsg,
                variant: "destructive"
              })
            }
            setIsLoading(false) // Stop loading indicator after success/fetch attempt
          }
          // If not connected, the interval continues
        } catch (error) {
          console.error("Error during polling:", error)
          // Let timeout handle persistent errors
        }
      }, POLLING_INTERVAL_MS)
    },
    [clearPolling, fetchAction, toast]
  )
  // --- Polling Logic --- END ---

  const handleConnectAndFetch = async () => {
    setIsLoading(true)
    setMessage(null)
    setErrorMessage(null)
    console.log("Attempting to connect for client:", agencyClientId)
    const currentAgencyClientId = agencyClientId

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
        "Nango popup should open. Please complete Google authentication."
      )

      const nangoAuthPromise = new Promise<string>((resolve, reject) => {
        nangoFrontend.openConnectUI({
          sessionToken: sessionToken,
          onEvent: (event: any) => {
            console.log("Nango UI Event:", event)
            if (event.type === "connect") {
              const connectionId = event.payload.connectionId
              console.log(
                "Nango connection successful via frontend SDK! Connection ID:",
                connectionId
              )
              if (connectionId !== currentAgencyClientId) {
                console.warn(
                  `Received connectionId (${connectionId}) does not match expected (${currentAgencyClientId}).`
                )
              }
              setMessage(
                "Nango popup closed. Starting connection verification..."
              )
              resolve(connectionId)
            } else if (event.type === "close") {
              console.log("Nango popup closed without connect event.")
            } else if (event.type === "error") {
              // Use type assertion as a workaround for payload type inference issue
              const errorPayload = (event as any).payload
              console.error("Nango UI Error Event:", errorPayload)
              // Ensure errorPayload exists and has a message property before accessing it
              const errorMessage = errorPayload?.message || "Nango UI error."
              reject(new Error(errorMessage))
            }
          }
        })
      })

      // Wait for Nango connection popup process to signal connection
      const connectionId = await nangoAuthPromise
      console.log(
        `Nango connection reported for ID ${connectionId}. Starting polling...`
      )

      // 3. Start Polling (instead of direct fetch)
      await startPolling(currentAgencyClientId)
    } catch (error: any) {
      console.error("Connect & Fetch Error:", error)
      const errorMsg = error.message || "An error occurred during connection."
      setErrorMessage(errorMsg)
      setMessage(null)
      toast({
        title: "Connection Failed",
        description: errorMsg,
        variant: "destructive"
      })
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => clearPolling()
  }, [clearPolling])

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
          disabled={isLoading || isPolling}
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
          disabled={isLoading || isPolling}
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
          disabled={isLoading || isPolling}
        />
      </div>
      <Button
        onClick={handleConnectAndFetch}
        disabled={
          isLoading ||
          isPolling ||
          !agencyClientId ||
          !agencyId ||
          !providerConfigKey
        }
      >
        {isLoading
          ? "Connecting..."
          : isPolling
            ? "Verifying..."
            : "Connect & Verify"}
      </Button>
      {message && !errorMessage && (
        <p className="mt-4 text-sm text-green-600">{message}</p>
      )}
      {errorMessage && (
        <p className="mt-4 text-sm text-red-600">Error: {errorMessage}</p>
      )}
    </div>
  )
}
