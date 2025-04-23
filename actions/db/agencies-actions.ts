'use server'

import { db } from '@/db/db'
import { agenciesTable, InsertAgency } from '@/db/schema/agencies-schema'
import { ActionState } from '@/types'

/**
 * Creates a new Agency record.
 * Intended to be called from the Clerk `organization.created` webhook.
 * @param orgId - The Clerk Organization ID (used as primary key).
 * @param orgName - The name of the organization.
 * @param createdByUserId - The Clerk User ID of the creator.
 * @returns ActionState indicating success or failure.
 */
export async function createAgencyAction(
  orgId: string,
  orgName: string,
  createdByUserId: string
): Promise<ActionState<void>> { // Returns void on success
  try {
    const newAgency: InsertAgency = {
      id: orgId,
      name: orgName,
      userId: createdByUserId
      // createdAt and updatedAt will use default values
    }

    await db.insert(agenciesTable).values(newAgency)

    console.log(`Successfully created agency record for OrgID: ${orgId}`)
    return {
      isSuccess: true,
      message: 'Agency created successfully',
      data: undefined
    }
  } catch (error: any) {
    console.error(`Error creating agency for OrgID ${orgId}:`, error)
    // Handle potential duplicate key error if needed, though Clerk webhooks are usually reliable
    // Drizzle might throw specific error types we can check
    return {
      isSuccess: false,
      message: `Failed to create agency: ${error.message || 'Unknown error'}`
    }
  }
} 