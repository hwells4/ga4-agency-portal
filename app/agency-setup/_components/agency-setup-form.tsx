"use client"

import * as React from "react"
import { Building, Users } from "lucide-react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Import server actions when they are created
// import { createAgencyAction, joinAgencyAction } from '@/actions/agency-actions';

interface AgencySetupFormProps {
  // Props if needed, e.g., for initial state or callbacks
}

export function AgencySetupForm({}: AgencySetupFormProps) {
  const [agencyName, setAgencyName] = React.useState("")
  const [agencyDescription, setAgencyDescription] = React.useState("")
  const [inviteCode, setInviteCode] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  // Placeholder handlers - replace with actual logic/server actions
  const handleCreateAgency = async () => {
    setIsLoading(true)
    setError(null)
    console.log("Creating agency:", { agencyName, agencyDescription })
    // TODO: Replace with server action call
    // const result = await createAgencyAction({ name: agencyName, description: agencyDescription });
    // if (!result.isSuccess) {
    //   setError(result.message);
    // } else {
    //   // Handle success (e.g., redirect)
    //   console.log('Agency created successfully', result.data);
    //   // window.location.href = '/agency'; // Or use router.push('/agency')
    // }
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
    setIsLoading(false)
  }

  const handleJoinAgency = async () => {
    setIsLoading(true)
    setError(null)
    console.log("Joining agency with code:", inviteCode)
    // TODO: Replace with server action call
    // const result = await joinAgencyAction({ inviteCode });
    // if (!result.isSuccess) {
    //   setError(result.message);
    // } else {
    //   // Handle success (e.g., redirect)
    //   console.log('Joined agency successfully');
    //   // window.location.href = '/agency'; // Or use router.push('/agency')
    // }
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
    setIsLoading(false)
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Removed DialogHeader, DialogTitle, DialogDescription - Title/Description should be part of the main page layout */}

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Building className="size-4" />
            Create Agency
          </TabsTrigger>
          <TabsTrigger value="join" className="flex items-center gap-2">
            <Users className="size-4" />
            Join Agency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-agency-name`}>Agency Name</Label>
              <Input
                id={`${id}-agency-name`}
                placeholder="Enter your agency's name"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-agency-description`}>
                Description (Optional)
              </Label>
              <Input
                id={`${id}-agency-description`}
                placeholder="What does your agency do?"
                value={agencyDescription}
                onChange={e => setAgencyDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="button"
            className="w-full"
            onClick={handleCreateAgency}
            disabled={isLoading || !agencyName}
          >
            {isLoading ? "Creating..." : "Create Agency"}
          </Button>
        </TabsContent>

        <TabsContent value="join" className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-invite-code`}>Invite Code</Label>
            <Input
              id={`${id}-invite-code`}
              placeholder="Enter agency invite code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
              disabled={isLoading}
            />
            <p className="text-muted-foreground text-xs">
              Ask your agency administrator for the invite code.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="button"
            className="w-full"
            onClick={handleJoinAgency}
            disabled={isLoading || !inviteCode}
          >
            {isLoading ? "Joining..." : "Join Agency"}
          </Button>
        </TabsContent>
      </Tabs>

      {/* Removed benefits section - can be added elsewhere on the page if needed */}
    </div>
  )
}
