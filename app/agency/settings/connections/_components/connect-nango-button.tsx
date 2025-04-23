"use client"

import { useState } from "react"
import {
  initiateNangoConnectionAction,
  fetchGa4PropertiesAction
} from "@/actions/nango-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Nango from "@nangohq/frontend"
import { useToast } from "@/components/ui/use-toast"

interface ConnectNangoButtonProps {
  agencyId: string
  userId: string
  providerConfigKey: string
}

interface Ga4PropertySummary {
  name: string
  displayName: string
}

const FETCH_DELAY_MS = 4000 // Delay in milliseconds (e.g., 4 seconds)

export default function ConnectNangoButton({
  agencyId,
  userId,
  providerConfigKey
}: ConnectNangoButtonProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [fetchedProperties, setFetchedProperties] = useState<
    Ga4PropertySummary[] | null
  >(null)

  const handleFetchProperties = async (connectionId: string) => {
    setStatusMessage("Fetching GA4 properties...")
    setIsLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS))

      console.log(
        `Attempting to fetch properties for connectionId ${connectionId} after delay.`
      )
      const fetchResult = await fetchGa4PropertiesAction(connectionId)

      if (fetchResult.isSuccess) {
        console.log("Fetched Properties:", fetchResult.data)
        setFetchedProperties(fetchResult.data)
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
    } catch (err: any) {
      console.error("Error during fetchGa4PropertiesAction:", err)
      const errorMessage =
        err.message || "An unexpected error occurred while fetching properties."
      setError(errorMessage)
      setStatusMessage(null)
      toast({
        title: "Fetch Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsLoading(true)
    setStatusMessage(null)
    setError(null)
    setFetchedProperties(null)

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
              if (connectionId) {
                setStatusMessage(
                  "Connection successful. Preparing to fetch properties..."
                )
                handleFetchProperties(connectionId)
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
              if (
                !fetchedProperties &&
                !error &&
                statusMessage?.includes("popup should open")
              ) {
                setIsLoading(false)
                setStatusMessage(null)
              }
            } else if (event.type === "error") {
              console.error("Nango UI Error Event:", event.payload)
              setError(
                event.payload?.message || "Error during Nango connection."
              )
              setIsLoading(false)
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

  return (
    <div>
      {!fetchedProperties && (
        <Button onClick={handleConnect} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Connect Google Analytics"
          )}
        </Button>
      )}

      {statusMessage && !error && (
        <p className="mt-2 text-sm text-blue-600">{statusMessage}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}

      {fetchedProperties && (
        <div className="mt-6 border-t pt-6">
          <h2 className="mb-3 text-lg font-semibold">Fetched Properties:</h2>
          <pre className="overflow-auto rounded bg-gray-100 p-4 text-xs">
            {JSON.stringify(fetchedProperties, null, 2)}
          </pre>
          <p className="text-muted-foreground mt-2 text-xs">
            Next step: Implement PropertySelectionForm.
          </p>
        </div>
      )}
    </div>
  )
}
