"use client"

import { useState } from "react"
import {
  initiateNangoConnectionAction,
  fetchGa4PropertiesAction,
  getNangoConnectionByPublicIdAction
} from "@/actions/nango-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Nango from "@nangohq/frontend"
import { useToast } from "@/components/ui/use-toast"
import PropertySelectionForm from "./property-selection-form"
import { SelectAgencyClient } from "@/db/schema"
import { ActionState } from "@/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"

interface ConnectNangoButtonProps {
  agencyId: string
  userId: string
  providerConfigKey: string
  onConnectionComplete?: (createdClients: SelectAgencyClient[]) => void
}

interface Ga4PropertySummary {
  name: string
  displayName: string
}

const FETCH_DELAY_MS = 4000 // Delay in milliseconds

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const MAX_FETCH_RETRIES = 3
const FETCH_RETRY_DELAY_MS = 1500

export default function ConnectNangoButton({
  agencyId,
  userId,
  providerConfigKey,
  onConnectionComplete
}: ConnectNangoButtonProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [fetchedProperties, setFetchedProperties] = useState<
    Ga4PropertySummary[] | null
  >(null)
  const [nangoConnectionTableId, setNangoConnectionTableId] = useState<
    string | null
  >(null)
  const [isComplete, setIsComplete] = useState(false)

  const handleFetchProperties = async (nangoPublicConnectionId: string) => {
    setStatusMessage("Fetching GA4 properties...")
    setIsLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS))

      console.log(
        `Attempting to fetch properties for Nango connectionId ${nangoPublicConnectionId} after delay.`
      )
      const fetchResult = await fetchGa4PropertiesAction(
        nangoPublicConnectionId
      )

      if (fetchResult.isSuccess) {
        console.log("Fetched Properties:", fetchResult.data)
        setFetchedProperties(fetchResult.data)
        setStatusMessage(
          `Successfully fetched ${fetchResult.data.length} properties. Please select which to connect.`
        )
        setError(null)
        toast({
          title: "Properties Fetched",
          description: `Found ${fetchResult.data.length} properties. Please make your selections.`
        })
      } else {
        const errorMsg =
          fetchResult.message || "Failed to fetch GA4 properties."
        setError(errorMsg)
        setStatusMessage(null)
        setFetchedProperties(null)
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
      setFetchedProperties(null)
      toast({
        title: "Fetch Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const handleConnect = async () => {
    setIsLoading(true)
    setStatusMessage(null)
    setError(null)
    setFetchedProperties(null)
    setNangoConnectionTableId(null)
    setIsComplete(false)

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

        const nango = new Nango({
          publicKey: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY,
          host: process.env.NEXT_PUBLIC_NANGO_BASE_URL
        })

        nango.openConnectUI({
          sessionToken: sessionToken,
          onEvent: async (event: any) => {
            console.log("Nango UI Event:", event)
            if (event.type === "connect") {
              const nangoPublicConnectionId = event.payload.connectionId
              console.log(
                "Nango 'connect' event received! Public Connection ID:",
                nangoPublicConnectionId
              )

              if (nangoPublicConnectionId) {
                let internalIdResult: ActionState<{
                  nangoConnectionTableId: string
                  status: string
                }> | null = null
                let success = false

                for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
                  setStatusMessage(
                    `Verifying connection details (attempt ${attempt}/${MAX_FETCH_RETRIES})...`
                  )
                  console.log(
                    `Attempt ${attempt}: Calling getNangoConnectionByPublicIdAction with public ID: ${nangoPublicConnectionId}`
                  )

                  try {
                    internalIdResult = await getNangoConnectionByPublicIdAction(
                      nangoPublicConnectionId
                    )

                    // If there's a 401 error despite the action call appearing to succeed,
                    // log a detailed error message to help diagnose
                    if (
                      !internalIdResult.isSuccess &&
                      internalIdResult.message.includes("Authentication")
                    ) {
                      console.error(
                        `Authentication error during attempt ${attempt}:`,
                        internalIdResult.message
                      )
                    }
                  } catch (internalIdError: any) {
                    console.error(
                      `Attempt ${attempt}: Error calling getNangoConnectionByPublicIdAction:`,
                      internalIdError
                    )
                    internalIdResult = {
                      isSuccess: false,
                      message:
                        "An error occurred while verifying connection details."
                    }
                    // Break loop on unexpected action error
                    break
                  }

                  if (
                    internalIdResult.isSuccess &&
                    internalIdResult.data?.nangoConnectionTableId
                  ) {
                    const internalId =
                      internalIdResult.data.nangoConnectionTableId
                    console.log(
                      `Attempt ${attempt}: Successfully retrieved internal DB ID: ${internalId}`
                    )
                    setNangoConnectionTableId(internalId)
                    success = true
                    break // Exit loop on success
                  } else {
                    console.warn(
                      `Attempt ${attempt}: Failed to retrieve internal DB ID: ${internalIdResult.message}`
                    )
                    // Check if the error message indicates "not found" or "processing"
                    const notFoundMessage =
                      internalIdResult.message?.toLowerCase() || ""
                    if (
                      attempt < MAX_FETCH_RETRIES &&
                      (notFoundMessage.includes("not found") ||
                        notFoundMessage.includes("processing"))
                    ) {
                      console.log(
                        `Waiting ${FETCH_RETRY_DELAY_MS}ms before next attempt...`
                      )
                      await delay(FETCH_RETRY_DELAY_MS)
                    } else {
                      // If it's another error or the last attempt, break
                      break
                    }
                  }
                } // End retry loop

                if (success) {
                  // The loop successfully found the ID and triggered setNangoConnectionTableId
                  // Proceed to fetch properties
                  setStatusMessage(
                    "Details verified. Preparing to fetch properties..."
                  )
                  // We pass the public ID, handleFetchProperties doesn't need the internal one
                  handleFetchProperties(nangoPublicConnectionId)
                  // Do not stop loading here; handleFetchProperties continues the process
                } else {
                  // Handle final failure after retries (loop finished without success)
                  const finalErrorMessage =
                    internalIdResult?.message ||
                    "Failed to verify connection details after multiple attempts."
                  console.error(
                    "Final attempt failed to retrieve internal DB ID:",
                    finalErrorMessage
                  )
                  setError(finalErrorMessage)
                  setStatusMessage(null)
                  setIsLoading(false) // Stop loading indicator only on final failure
                }
              } else {
                console.error(
                  "Nango 'connect' event did not provide a connectionId."
                )
                setError(
                  "Connection succeeded but failed to get Public ID from Nango UI."
                )
                setIsLoading(false)
              }
            } else if (event.type === "close") {
              console.log("Nango popup closed.")
              if (!nangoConnectionTableId && !fetchedProperties && !error) {
                setStatusMessage(null)
                setIsLoading(false)
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

  const handleFormSuccess = (createdClients: SelectAgencyClient[]) => {
    setStatusMessage(
      `Successfully configured ${createdClients.length} client(s).`
    )
    setFetchedProperties(null)
    setIsLoading(false)
    setIsComplete(true)
    if (onConnectionComplete) {
      onConnectionComplete(createdClients)
    }
  }

  const handleFormCancel = () => {
    setStatusMessage("Connection process cancelled.")
    setFetchedProperties(null)
    setNangoConnectionTableId(null)
    setError(null)
    setIsLoading(false)
    setIsComplete(false)
  }

  return (
    <div>
      {!fetchedProperties && !isComplete && (
        <Button onClick={handleConnect} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {statusMessage || "Processing..."}
            </>
          ) : (
            "Connect Google Analytics"
          )}
        </Button>
      )}

      {statusMessage && !isLoading && !fetchedProperties && !isComplete && (
        <p className="mt-2 text-sm text-blue-600">{statusMessage}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}

      {fetchedProperties && nangoConnectionTableId && !isComplete && (
        <div className="mt-6 border-t pt-6">
          {statusMessage && (
            <p className="mb-4 text-sm text-blue-600">{statusMessage}</p>
          )}
          <PropertySelectionForm
            agencyId={agencyId}
            nangoConnectionTableId={nangoConnectionTableId}
            fetchedProperties={fetchedProperties}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {isComplete && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Connection Complete!
          </p>
          <p className="text-xs text-green-700">
            Client configurations saved successfully.
          </p>
        </div>
      )}
    </div>
  )
}
