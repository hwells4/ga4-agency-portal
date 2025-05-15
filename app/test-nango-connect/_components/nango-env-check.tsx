"use client"

import { useEffect, useState } from "react"

export default function NangoEnvCheck() {
  const [nangoBaseUrl, setNangoBaseUrl] = useState<string | null>(null)

  useEffect(() => {
    // Check if the NEXT_PUBLIC_NANGO_BASE_URL environment variable is available
    const baseUrl = process.env.NEXT_PUBLIC_NANGO_BASE_URL
    setNangoBaseUrl(baseUrl || null)
  }, [])

  return (
    <div className="mt-4 rounded-md border p-4">
      <h3 className="text-lg font-medium">Nango Environment Variables Check</h3>
      <div className="mt-2">
        <p>
          <span className="font-semibold">NEXT_PUBLIC_NANGO_BASE_URL:</span>{" "}
          {nangoBaseUrl ? (
            <span className="text-green-600">{nangoBaseUrl}</span>
          ) : (
            <span className="text-red-600">Not configured</span>
          )}
        </p>
      </div>
    </div>
  )
}
