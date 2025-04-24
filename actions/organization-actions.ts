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
 * Placeholder action for joining a Clerk Organization using an invite code.
 * NOTE: Clerk's standard flow often uses invite links. Implementing this
 * securely with just a code might require specific API usage like 
 * managing OrganizationInvitations or OrganizationMemberships directly.
 * Consider using Clerk's <OrganizationList /> component for a standard join flow.
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
  console.log("Attempting to join organization with code (placeholder):", trimmedCode);

  try {
    const client = await clerkClient();
    await client.invitations.acceptOrganizationInvitation({
      invitationId: trimmedCode,
      userId,
    });
  } catch (error: any) {
    console.error("Error joining Clerk organization:", error);
    return {
      isSuccess: false,
      message: error.errors?.[0]?.message || error.message || "Unknown error",
    };
  }

  redirect('/agency'); // Redirect after successful join
} 