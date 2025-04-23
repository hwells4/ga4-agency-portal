"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  initiateNangoConnectionAction,
  fetchGa4PropertiesAction
} from "@/actions/nango-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Nango from "@nangohq/frontend"
import { useToast } from "@/components/ui/use-toast"
// Optional: For showing toast notifications on error
// import { toast } from "sonner";

interface ConnectNangoButtonProps {
  agencyId: string
  userId: string
  providerConfigKey: string
}

// Define expected property structure if known, otherwise use any
interface Ga4PropertySummary {
  name: string // e.g., "properties/12345"
  displayName: string
}

export default function ConnectNangoButton({
  agencyId,
  userId,
  providerConfigKey
}: ConnectNangoButtonProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [fetchedProperties, setFetchedProperties] = useState<
    Ga4PropertySummary[] | null
  >(null) // State for properties

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollAttemptsRef = useRef(0)
  const MAX_POLL_ATTEMPTS = 12 // ~36 seconds timeout
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
    async (nangoConnectionId: string) => {
      clearPolling()
      setIsPolling(true)
      setStatusMessage("Verifying connection save... Please wait.")
      pollAttemptsRef.current = 0
      setError(null)

      pollingIntervalRef.current = setInterval(async () => {
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearPolling()
          const errorMsg =
            "Connection status check timed out. Please try reconnecting or check webhook status."
          setError(errorMsg)
          setStatusMessage(null)
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive"
          })
          setIsLoading(false) // Also stop main loading indicator
          return
        }

        pollAttemptsRef.current += 1
        console.log(
          `Polling attempt ${pollAttemptsRef.current} for ${nangoConnectionId}`
        )

        try {
          const response = await fetch(
            `/api/nango/connection-status?nangoConnectionId=${nangoConnectionId}`,
            {
              credentials: "include"
            }
          )

          if (!response.ok) {
            // Don't stop polling on transient errors, maybe log differently
            console.warn(`Polling check failed with status: ${response.status}`)
            if (response.status === 401) {
              setError(
                "Authentication error during status check. Please refresh."
              )
              clearPolling()
              setIsLoading(false)
            }
            return // Continue polling unless it's a fatal error like 401
          }

          const data = await response.json()

          if (data.isConnected) {
            console.log("Polling successful: Connection confirmed active.")
            clearPolling()
            toast({
              title: "Success",
              description: "Connection saved. Fetching properties..."
            })
            setStatusMessage("Connection confirmed. Fetching GA4 properties...")

            // Call the adapted fetch action
            const fetchResult =
              await fetchGa4PropertiesAction(nangoConnectionId)

            if (fetchResult.isSuccess) {
              console.log("Fetched Properties:", fetchResult.data)
              setFetchedProperties(fetchResult.data) // Store properties in state
              setStatusMessage(
                `Successfully fetched ${fetchResult.data.length} properties.`
              )
              setError(null)
              toast({
                title: "Properties Fetched",
                description: `Found ${fetchResult.data.length} properties.`
              })
            } else {
              const errorMsg =
                fetchResult.message || "Failed to fetch GA4 properties."
              setError(errorMsg)
              setStatusMessage(null)
              toast({
                title: "Error Fetching Properties",
                description: errorMsg,
                variant: "destructive"
              })
            }
            setIsLoading(false) // Final loading state finished
          } else {
            // Still waiting for webhook/save, continue polling
            console.log("Polling: Connection not active yet.")
          }
        } catch (error) {
          console.error("Error during polling:", error)
          // Don't stop polling on fetch errors, maybe log and continue
        }
      }, POLLING_INTERVAL_MS)
    },
    [clearPolling, toast]
  )
  // --- Polling Logic --- END ---

  const handleConnect = async () => {
    setIsLoading(true)
    setStatusMessage(null)
    setError(null)
    setFetchedProperties(null) // Clear previous properties

    try {
      const result = await initiateNangoConnectionAction(
        agencyId,
        userId,
        providerConfigKey
      )

      if (result.isSuccess && result.data?.sessionToken) {
        const sessionToken = result.data.sessionToken
        console.log("Received session token, opening Nango Connect UI...")
        setStatusMessage(
          "Nango popup should open. Please complete Google authentication."
        )

        const nango = new Nango()

        nango.openConnectUI({
          sessionToken: sessionToken,
          onEvent: (event: any) => {
            console.log("Nango UI Event:", event)
            if (event.type === "connect") {
              const connectionId = event.payload.connectionId
              console.log(
                "Nango 'connect' event received! Connection ID:",
                connectionId
              )
              // IMPORTANT: Start polling AFTER the connect event, using the ID Nango provides
              if (connectionId) {
                startPolling(connectionId)
                // Keep isLoading=true while polling
              } else {
                console.error(
                  "Nango 'connect' event did not provide a connectionId."
                )
                setError(
                  "Connection succeeded but failed to get ID from Nango UI."
                )
                setIsLoading(false)
              }
            } else if (event.type === "close") {
              console.log("Nango popup closed.")
              // Only stop loading if we are NOT polling (i.e., closed before 'connect' event)
              if (!isPolling) {
                setIsLoading(false)
                // Optionally reset status message if needed
                // setStatusMessage(null);
              }
            } else if (event.type === "error") {
              console.error("Nango UI Error Event:", event.payload)
              setError(
                event.payload?.message || "Error during Nango connection."
              )
              setIsLoading(false) // Stop loading on UI error
              clearPolling() // Stop polling if it somehow started
            }
          }
        })
      } else {
        throw new Error(
          result.message || "Failed to initiate Nango connection."
        )
      }
    } catch (err: any) {
      console.error("Error initiating Nango connection:", err)
      const errorMessage =
        err.message || "An unexpected error occurred. Please try again."
      setError(errorMessage)
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive"
      })
      setIsLoading(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => clearPolling()
  }, [clearPolling])

  return (
    <div>
      {/* Only show connect button if properties haven't been fetched */}
      {!fetchedProperties && (
        <Button onClick={handleConnect} disabled={isLoading || isPolling}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Connecting...
            </>
          ) : isPolling ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Connect Google Analytics"
          )}
        </Button>
      )}

      {/* Display Status and Errors */}
      {statusMessage && !error && (
        <p className="mt-2 text-sm text-blue-600">{statusMessage}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}

      {/* TODO: Render PropertySelectionForm when properties are fetched */}
      {fetchedProperties && (
        <div className="mt-6 border-t pt-6">
          <h2 className="mb-3 text-lg font-semibold">Fetched Properties:</h2>
          {/* Replace this with your actual PropertySelectionForm component */}
          <pre className="overflow-auto rounded bg-gray-100 p-4 text-xs">
            {JSON.stringify(fetchedProperties, null, 2)}
          </pre>
          {/* <PropertySelectionForm properties={fetchedProperties} /> */}
          <p className="text-muted-foreground mt-2 text-xs">
            Next step: Implement PropertySelectionForm.
          </p>
        </div>
      )}
    </div>
  )
}
