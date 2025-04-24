"use client"

import * as React from "react"
import { Building, Users } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AgencyDialogProps {
  trigger?: React.ReactNode
  // Add callback props for handling create/join actions if needed
  // onCreateAgency?: (name: string, description?: string) => void;
  // onJoinAgency?: (inviteCode: string) => void;
}

export function AgencySetupDialog({ trigger }: AgencyDialogProps) {
  const [agencyName, setAgencyName] = React.useState("")
  const [agencyDescription, setAgencyDescription] = React.useState("")
  const [inviteCode, setInviteCode] = React.useState("")
  const id = React.useId()

  // Placeholder handlers - replace with actual logic/server actions
  const handleCreateAgency = () => {
    console.log("Creating agency:", { agencyName, agencyDescription })
    // Call server action here: e.g., createAgencyAction({ name: agencyName, description: agencyDescription })
    // onCreateAgency?.(agencyName, agencyDescription);
  }

  const handleJoinAgency = () => {
    console.log("Joining agency with code:", inviteCode)
    // Call server action here: e.g., joinAgencyAction({ inviteCode })
    // onJoinAgency?.(inviteCode);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Get Started</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <div className="flex flex-col items-center gap-2">
          <div
            className="border-border bg-background flex size-12 shrink-0 items-center justify-center rounded-full border"
            aria-hidden="true"
          >
            <Building className="text-foreground size-6" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Agency Portal
            </DialogTitle>
            <DialogDescription className="text-center">
              Create a new agency or join an existing one to collaborate with
              your team.
            </DialogDescription>
          </DialogHeader>
        </div>

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
                  placeholder="Enter agency name"
                  value={agencyName}
                  onChange={e => setAgencyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-agency-description`}>
                  Description (Optional)
                </Label>
                <Input
                  id={`${id}-agency-description`}
                  placeholder="Brief description of your agency"
                  value={agencyDescription}
                  onChange={e => setAgencyDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                className="w-full"
                onClick={handleCreateAgency}
              >
                Create Agency
              </Button>
            </DialogFooter>
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
              />
              <p className="text-muted-foreground text-xs">
                Ask your agency administrator for the invite code.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                className="w-full"
                onClick={handleJoinAgency}
              >
                Join Agency
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>

        <div className="before:bg-border after:bg-border flex items-center gap-3 before:h-px before:flex-1 after:h-px after:flex-1">
          <span className="text-muted-foreground text-xs">Agency Benefits</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          <div className="border-border rounded-lg border p-3">
            <p className="font-medium">Team Collaboration</p>
            <p className="text-muted-foreground text-xs">
              Work together seamlessly
            </p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="font-medium">Resource Sharing</p>
            <p className="text-muted-foreground text-xs">
              Share assets and templates
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Example usage removed, integrate where needed
// export default AgencySetupDialog; // No default export, export named component
