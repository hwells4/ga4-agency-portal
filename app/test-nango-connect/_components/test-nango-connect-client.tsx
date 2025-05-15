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
          setMessage(null)
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive"
          })
          setIsLoading(false)
          return
        }

        pollAttemptsRef.current += 1
        console.log(
          `Polling attempt ${pollAttemptsRef.current} for ${clientIdToPoll}`
        )

        try {
          const response = await fetch(
            `/api/nango/check-status/${clientIdToPoll}`,
            { credentials: "include" }
          )
          if (!response.ok) {
            if (response.status === 401) {
              console.error(
                `Polling check failed: 401 Unauthorized. Session likely invalid or missing.`
              )
              return
            }
            if (response.status === 404) {
              console.error(
                `Polling check failed: 404 Not Found. Client ID ${clientIdToPoll} not found by API.`
              )
              clearPolling()
              setIsLoading(false)
              setErrorMessage(
                `Client record not found for ID: ${clientIdToPoll}. Please verify the ID.`
              )
              toast({
                title: "Error",
                description: `Client record not found for ID: ${clientIdToPoll}.`,
                variant: "destructive"
              })
              return
            }
            console.warn(`Polling check failed with status: ${response.status}`)
            return
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
            setIsLoading(false)
          }
        } catch (error) {
          console.error("Error during polling:", error)
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
    const initialAgencyClientId = agencyClientId
    console.log("Attempting to connect for client:", initialAgencyClientId)

    try {
      console.log("Calling initiateAction...")
      const initiateResult = await initiateAction(
        initialAgencyClientId,
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

      // Get environment variables with fallbacks to ensure they're strings
      const publicKey = process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY || ""
      const baseUrl = process.env.NEXT_PUBLIC_NANGO_BASE_URL || ""

      console.log("Creating Nango instance with:", {
        publicKey,
        host: baseUrl
      })

      const nangoFrontend = new Nango({
        publicKey,
        host: baseUrl
      })

      console.log("Nango instance created successfully")
      setMessage(
        "Nango popup should open. Please complete Google authentication."
      )

      let actualNangoConnectionId: string | null = null

      const nangoAuthPromise = new Promise<string>((resolve, reject) => {
        // Setup window event listener to catch the OAuth callback for v0.36.78
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== process.env.NEXT_PUBLIC_NANGO_BASE_URL) {
            return // Ignore messages from other origins
          }

          console.log("Received postMessage from Nango:", event.data)

          if (event.data && event.data.type === "nango:auth:success") {
            const connectionId = event.data.connectionId
            console.log("Auth success with connectionId:", connectionId)
            window.removeEventListener("message", messageHandler)
            actualNangoConnectionId = connectionId

            if (connectionId !== initialAgencyClientId) {
              console.warn(
                `Received connectionId (${connectionId}) does not match expected initial ID (${initialAgencyClientId}).`
              )
            }

            setMessage(
              "Nango popup closed. Starting connection verification..."
            )
            resolve(connectionId)
          } else if (event.data && event.data.type === "nango:auth:error") {
            console.error("Auth error:", event.data.error)
            window.removeEventListener("message", messageHandler)
            reject(new Error(event.data.error || "Unknown auth error"))
          } else if (event.data && event.data.type === "nango:auth:cancel") {
            console.log("Auth canceled by user")
            window.removeEventListener("message", messageHandler)
            reject(new Error("Authentication canceled by user"))
          }
        }

        window.addEventListener("message", messageHandler)

        // In v0.36.78, we use auth() instead of openConnectUI
        const authParams = `sessionToken=${sessionToken}`
        // For v0.36.78, we must ensure both parameters are strings
        // We explicitly convert providerConfigKey to a string and use a default empty string
        const provider =
          typeof providerConfigKey === "string" ? providerConfigKey : ""
        nangoFrontend.auth(provider, authParams).catch(error => {
          window.removeEventListener("message", messageHandler)
          reject(error)
        })
      })

      await nangoAuthPromise

      if (!actualNangoConnectionId) {
        console.warn(
          "Nango connection process did not explicitly return a connection ID via 'connect' event."
        )
      }

      console.log(
        `Nango connection process finished. Starting polling using initial client ID: ${initialAgencyClientId}...`
      )

      await startPolling(initialAgencyClientId)
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
        <Label htmlFor="agencyClientId">Agency Client ID (To Initiate)</Label>
        <Input
          id="agencyClientId"
          value={agencyClientId}
          onChange={e => setAgencyClientId(e.target.value)}
          type="text"
          required
          placeholder="Enter the agency_clients.id UUID"
          disabled={isLoading || isPolling}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          This ID must match an existing record in the database.
        </p>
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
