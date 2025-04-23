/*
<ai_context>
Contains server actions related to profiles in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertProfile,
  profilesTable,
  SelectProfile
} from "@/db/schema/profiles-schema"
import { ActionState } from "@/types"
import { eq } from "drizzle-orm"

export async function createProfileAction(
  data: InsertProfile
): Promise<ActionState<SelectProfile>> {
  try {
    const [newProfile] = await db.insert(profilesTable).values(data).returning()
    return {
      isSuccess: true,
      message: "Profile created successfully",
      data: newProfile
    }
  } catch (error) {
    console.error("Error creating profile:", error)
    return { isSuccess: false, message: "Failed to create profile" }
  }
}

export async function getProfileByUserIdAction(
  userId: string
): Promise<ActionState<SelectProfile>> {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })
    if (!profile) {
      return { isSuccess: false, message: "Profile not found" }
    }

    return {
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: profile
    }
  } catch (error) {
    console.error("Error getting profile by user id", error)
    return { isSuccess: false, message: "Failed to get profile" }
  }
}

export async function updateProfileAction(
  userId: string,
  data: Partial<InsertProfile>
): Promise<ActionState<SelectProfile>> {
  try {
    const [updatedProfile] = await db
      .update(profilesTable)
      .set(data)
      .where(eq(profilesTable.userId, userId))
      .returning()

    if (!updatedProfile) {
      return { isSuccess: false, message: "Profile not found to update" }
    }

    return {
      isSuccess: true,
      message: "Profile updated successfully",
      data: updatedProfile
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    return { isSuccess: false, message: "Failed to update profile" }
  }
}

export async function updateProfileByStripeCustomerIdAction(
  stripeCustomerId: string,
  data: Partial<InsertProfile>
): Promise<ActionState<SelectProfile>> {
  try {
    const [updatedProfile] = await db
      .update(profilesTable)
      .set(data)
      .where(eq(profilesTable.stripeCustomerId, stripeCustomerId))
      .returning()

    if (!updatedProfile) {
      return {
        isSuccess: false,
        message: "Profile not found by Stripe customer ID"
      }
    }

    return {
      isSuccess: true,
      message: "Profile updated by Stripe customer ID successfully",
      data: updatedProfile
    }
  } catch (error) {
    console.error("Error updating profile by stripe customer ID:", error)
    return {
      isSuccess: false,
      message: "Failed to update profile by Stripe customer ID"
    }
  }
}

export async function deleteProfileAction(
  userId: string
): Promise<ActionState<void>> {
  try {
    await db.delete(profilesTable).where(eq(profilesTable.userId, userId))
    return {
      isSuccess: true,
      message: "Profile deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting profile:", error)
    return { isSuccess: false, message: "Failed to delete profile" }
  }
}

/**
 * Updates the agencyId for a given profile.
 * Intended to be called from the Clerk `organizationMembership.created` webhook.
 * @param userId - The Clerk User ID of the profile to update.
 * @param agencyId - The Clerk Organization ID (agency ID) to associate.
 * @returns ActionState indicating success or failure.
 */
export async function updateProfileAgencyIdAction(
  userId: string,
  agencyId: string
): Promise<ActionState<void>> {
  try {
    const [updatedProfile] = await db
      .update(profilesTable)
      .set({ agencyId: agencyId }) // Set the agencyId field
      .where(eq(profilesTable.userId, userId))
      .returning({ updatedId: profilesTable.userId })

    if (!updatedProfile) {
      // This case might happen if the profile wasn't created yet when the membership event fires.
      // We might need more robust handling later (e.g., retry, or ensure profile exists first).
      console.warn(`Profile not found for userId ${userId} when trying to update agencyId.`);
      return { isSuccess: false, message: "Profile not found to update agency link." }
    }

    console.log(`Successfully linked profile ${userId} to agency ${agencyId}`)
    return {
      isSuccess: true,
      message: "Profile successfully linked to agency",
      data: undefined
    }
  } catch (error: any) {
    console.error(`Error updating profile agencyId for userId ${userId}:`, error)
    return {
      isSuccess: false,
      message: `Failed to link profile to agency: ${error.message || 'Unknown error'}`
    }
  }
}
