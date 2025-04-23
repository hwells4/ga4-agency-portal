"use client"

import { useState } from "react"
import { initiateNangoConnectionAction } from "@/actions/nango-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Nango from "@nangohq/frontend"
// Optional: For showing toast notifications on error
// import { toast } from "sonner";

interface ConnectNangoButtonProps {
  agencyId: string
  userId: string
  providerConfigKey: string
}

export default function ConnectNangoButton({
  agencyId,
  userId,
  providerConfigKey
}: ConnectNangoButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await initiateNangoConnectionAction(
        agencyId,
        userId,
        providerConfigKey
      )

      if (result.isSuccess && result.data?.sessionToken) {
        const sessionToken = result.data.sessionToken
        console.log("Received session token, opening Nango Connect UI...")

        // Instantiate Nango frontend SDK
        const nango = new Nango()

        // Open the Nango Connect UI using the token
        nango.openConnectUI({
          sessionToken: sessionToken,
          onEvent: (event: any) => {
            console.log("Nango UI Event:", event)
            // Handle events if needed (e.g., detect closing, errors)
            if (event.type === "close") {
              // Optionally handle the case where the user closes the popup
              console.log("Nango popup closed by user.")
              setIsLoading(false) // Re-enable button if closed without connecting
            } else if (event.type === "error") {
              console.error("Nango UI Error Event:", event.payload)
              setError(
                event.payload?.message || "Error during Nango connection."
              )
              setIsLoading(false)
            }
            // Note: The actual connection success/storage is handled by the
            // backend callback route (/api/nango/callback) after Nango redirects.
            // We don't need to explicitly handle the 'connect' event here unless
            // we want immediate UI feedback before the backend callback finishes.
          }
        })

        // Don't change window.location.href here
        // window.location.href = `https://connect.nango.dev/sessions/${result.data.sessionToken}`;

        // Keep loading true while the popup is potentially open
        // It will be reset on close/error events above, or the page navigates on success
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
      // Optional: Show toast notification
      // toast.error("Connection Failed", { description: errorMessage });
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handleConnect} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Connecting...
          </>
        ) : (
          "Connect Google Analytics"
        )}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">Connection failed: {error}</p>
      )}
    </div>
  )
}
