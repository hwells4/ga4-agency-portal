"use server"

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import { ActionState } from "@/types";

/**
 * Creates a new Clerk Organization.
 * The calling user will be automatically added as an administrator.
 */
export async function createClerkOrganizationAction({
  name,
  description,
}: {
  name: string;
  description?: string; // Description is optional in the form
}): Promise<ActionState<{ organizationId: string }>> {
  const { userId } = await auth();

  if (!userId) {
    return { isSuccess: false, message: "User is not authenticated." };
  }

  if (!name || name.trim().length === 0) {
    return { isSuccess: false, message: "Organization name cannot be empty." };
  }

  try {
    const client = await clerkClient();
    const newOrg = await client.organizations.createOrganization({
      name: name.trim(),
      createdBy: userId,
      // publicMetadata: { description: description?.trim() || '' },
    });
    console.log("Created Clerk org ID:", newOrg.id);
  } catch (error: any) {
    console.error("Error creating Clerk organization:", error);
    return {
      isSuccess: false,
      message: error.errors?.[0]?.message || error.message || "Unknown error",
    };
  }
  
  redirect('/agency'); // Redirect after successful creation
}

/**
 * Redirects user to the invitation acceptance flow for a Clerk Organization.
 * Note: Clerk's standard flow for handling invitations relies on invitation links
 * where the user receives an email with a link containing a ticket token.
 * 
 * This action simply redirects to the Clerk invitation URL which will handle
 * the appropriate sign-in or sign-up flow based on whether the user exists.
 */
export async function joinClerkOrganizationAction({
  inviteCode,
}: {
  inviteCode: string;
}): Promise<ActionState<void>> {
  const { userId } = await auth();

  if (!userId) {
    return { isSuccess: false, message: "User is not authenticated." };
  }

  if (!inviteCode || inviteCode.trim().length === 0) {
    return { isSuccess: false, message: "Invite code cannot be empty." };
  }

  const trimmedCode = inviteCode.trim();
  console.log("Redirecting to organization invitation link:", trimmedCode);

  try {
    // Redirect to the invitation URL which contains the ticket token
    // This will trigger the Clerk invitation flow
    redirect(trimmedCode);
  } catch (error: any) {
    console.error("Error joining Clerk organization:", error);
    return {
      isSuccess: false,
      message: error.errors?.[0]?.message || error.message || "Unknown error",
    };
  }
} 