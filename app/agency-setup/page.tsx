"use client"

import { CreateOrganization } from "@clerk/nextjs"

// You might want to add authentication checks here later
// import { auth } from "@clerk/nextjs/server";
// import { redirect } from "next/navigation";

export default function AgencySetupPage() {
  // Example: Check if user already has an agency/organization
  // const { orgId } = auth();
  // if (orgId) {
  //   redirect('/agency'); // Redirect if already part of an agency
  // }

  return (
    <div className="container mx-auto flex min-h-screen flex-col items-center justify-center py-12">
      <h1 className="mb-4 text-3xl font-bold">Welcome to Agency Setup</h1>
      {/* Clerk pre-built component handles creation and invites */}
      <CreateOrganization
        path="/agency-setup"
        routing="path"
        afterCreateOrganizationUrl="/agency"
        skipInvitationScreen={true}
        hideSlug={false}
      />
    </div>
  )
}
