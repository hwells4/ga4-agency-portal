"use server"

import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import ConnectNangoButton from "./_components/connect-nango-button"
import { Skeleton } from "@/components/ui/skeleton" // For loading state

// Define the provider key
const NANGO_PROVIDER_CONFIG_KEY = "google-analytics"

export default async function ConnectionsSettingsPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in") // Should be protected by middleware, but belt-and-suspenders
  }

  // Fetch agencyId in a Suspense boundary
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Manage Connections</h1>
      <p className="text-muted-foreground mb-6">
        Connect your Google Analytics account to enable property discovery and
        client configuration.
      </p>
      <Suspense fallback={<ConnectionsSettingsSkeleton />}>
        <ConnectionDetailsFetcher
          userId={userId}
          providerConfigKey={NANGO_PROVIDER_CONFIG_KEY}
        />
      </Suspense>
    </div>
  )
}

// Separate async component to fetch data within Suspense
async function ConnectionDetailsFetcher({
  userId,
  providerConfigKey
}: {
  userId: string
  providerConfigKey: string
}) {
  // Fetch the agencyId associated with the user's profile
  const userProfile = await db.query.profiles.findFirst({
    where: eq(profilesTable.userId, userId),
    columns: { agencyId: true }
  })

  if (!userProfile?.agencyId) {
    // Handle case where user profile or agencyId is missing
    // This shouldn't happen if webhooks are working, but good to check
    return (
      <div className="rounded-md border border-red-400 bg-red-50 p-4 text-red-600">
        Error: Could not find an associated Agency ID for your profile. Please
        contact support.
      </div>
    )
  }

  const agencyId = userProfile.agencyId

  // TODO: Add logic here later to check if a connection *already* exists
  // for this agency/provider before showing the button, or maybe show a
  // "Reconnect" or "Manage" button instead.

  return (
    <ConnectNangoButton
      agencyId={agencyId}
      userId={userId}
      providerConfigKey={providerConfigKey}
    />
  )
}

// Simple skeleton for loading state
function ConnectionsSettingsSkeleton() {
  return (
    <div>
      <Skeleton className="h-10 w-48" />
    </div>
  )
}
