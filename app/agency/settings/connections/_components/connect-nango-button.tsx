"use client"

import { useState } from "react"
import { initiateNangoConnectionAction } from "@/actions/nango-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
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
        // Redirect user to Nango Connect UI
        // Nango Connect handles the OAuth flow and redirects back to /api/nango/callback
        console.log("Redirecting to Nango Connect...")
        window.location.href = `https://connect.nango.dev/sessions/${result.data.sessionToken}`
        // No need to setIsLoading(false) here as the page will navigate away
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
