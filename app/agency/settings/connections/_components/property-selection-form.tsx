"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal, Info, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { bulkCreateAgencyClientsAction } from "@/actions/db/agency-clients-actions"
import { ActionState } from "@/types" // Assuming ActionState is exported from types
import { SelectAgencyClient } from "@/db/schema" // Assuming SelectAgencyClient is exported

// Type matching the data structure from fetchGa4PropertiesAction
interface Ga4PropertySummary {
  name: string // e.g., "properties/123456789"
  displayName: string
}

// Structure for managing state within the form
interface PropertySelectionState {
  isSelected: boolean
  clientIdentifier: string // For MCP queries
  clientName: string // For Portal UI display (defaults to GA4 displayName)
  error?: string // Per-row validation error
}

interface PropertySelectionFormProps {
  agencyId: string
  // The Nango connection ID from *our* database (nangoConnectionsTable.id)
  nangoConnectionTableId: string
  fetchedProperties: Ga4PropertySummary[]
  onSuccess?: (createdClients: SelectAgencyClient[]) => void // Callback on successful save
  onCancel?: () => void // Optional callback for cancellation
}

export default function PropertySelectionForm({
  agencyId,
  nangoConnectionTableId,
  fetchedProperties,
  onSuccess,
  onCancel
}: PropertySelectionFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Initialize state for each property
  const [selectionState, setSelectionState] = useState<
    Record<string, PropertySelectionState>
  >(() =>
    fetchedProperties.reduce(
      (acc, prop) => {
        // Generate a suggested clientIdentifier (e.g., "harrisons-blog")
        const suggestedIdentifier = prop.displayName
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except space/hyphen
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .slice(0, 50) // Limit length

        acc[prop.name] = {
          isSelected: false,
          clientIdentifier: suggestedIdentifier,
          clientName: prop.displayName, // Default clientName to displayName
          error: undefined
        }
        return acc
      },
      {} as Record<string, PropertySelectionState>
    )
  )

  const handleCheckboxChange = (propertyName: string, checked: boolean) => {
    setSelectionState(prev => ({
      ...prev,
      [propertyName]: { ...prev[propertyName], isSelected: checked }
    }))
    // Clear global error when user interacts
    setGlobalError(null)
  }

  const handleIdentifierChange = (propertyName: string, value: string) => {
    // Basic validation for client identifier (allow letters, numbers, hyphens)
    const sanitizedValue = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    const isValid =
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sanitizedValue) || sanitizedValue === ""

    setSelectionState(prev => ({
      ...prev,
      [propertyName]: {
        ...prev[propertyName],
        clientIdentifier: sanitizedValue,
        error:
          !isValid && sanitizedValue !== ""
            ? "Use lowercase letters, numbers, and hyphens (e.g., my-client-site)."
            : undefined
      }
    }))
    // Clear global error when user interacts
    setGlobalError(null)
  }

  const handleNameChange = (propertyName: string, value: string) => {
    setSelectionState(prev => ({
      ...prev,
      [propertyName]: {
        ...prev[propertyName],
        clientName: value
      }
    }))
    // Clear global error when user interacts
    setGlobalError(null)
  }

  const validateSelections = (): boolean => {
    let isValid = true
    let hasSelection = false
    const updatedState = { ...selectionState }

    Object.entries(updatedState).forEach(([propertyName, state]) => {
      if (state.isSelected) {
        hasSelection = true
        if (!state.clientIdentifier) {
          updatedState[propertyName].error = "Client Identifier is required."
          isValid = false
        } else if (state.error && state.error.includes("lowercase")) {
          // Keep existing format error if present
          isValid = false
        }
        if (!state.clientName) {
          updatedState[propertyName].error =
            (updatedState[propertyName].error
              ? updatedState[propertyName].error + " "
              : "") + "Client Name is required."
          isValid = false
        }
      } else {
        // Clear errors for non-selected rows
        updatedState[propertyName].error = undefined
      }
    })

    setSelectionState(updatedState)

    if (!hasSelection) {
      setGlobalError("Please select at least one property to import.")
      isValid = false
    } else {
      setGlobalError(null)
    }

    return isValid
  }

  const handleSubmit = async () => {
    if (!validateSelections()) {
      return // Stop submission if validation fails
    }

    setIsLoading(true)
    setGlobalError(null)

    const propertiesToImport = Object.entries(selectionState)
      .filter(([_, state]) => state.isSelected)
      .map(([propertyName, state]) => ({
        propertyId: propertyName, // The original GA4 property name/ID
        clientIdentifier: state.clientIdentifier,
        clientName: state.clientName
      }))

    try {
      // Ensure agencyId is not empty or undefined
      if (!agencyId) {
        throw new Error("Agency ID is required but not available")
      }

      // Log the values being sent to the action for debugging
      console.log("Submitting to bulkCreateAgencyClientsAction with:", {
        agencyId,
        nangoConnectionTableId,
        propertyCount: propertiesToImport.length
      })

      try {
        const result = await bulkCreateAgencyClientsAction(
          agencyId,
          nangoConnectionTableId,
          propertiesToImport
        )

        if (result.isSuccess) {
          toast({
            title: "Success",
            description: result.message
          })
          if (onSuccess) {
            onSuccess(result.data) // Pass created clients data back
          }
        } else {
          // Enhanced error logging for auth-related errors
          if (
            result.message.includes("Authentication") ||
            result.message.includes("Unauthorized")
          ) {
            console.error(
              "Authentication error during bulk create:",
              result.message
            )
            setGlobalError(
              `Authentication error: ${result.message}. You may need to refresh the page and try again.`
            )
          } else {
            setGlobalError(result.message) // Show regular error message from the action
          }

          toast({
            title: "Error",
            description: result.message,
            variant: "destructive"
          })
        }
      } catch (actionError: any) {
        // Specific handling for fetch errors that might indicate auth issues
        console.error(
          "Error calling bulkCreateAgencyClientsAction:",
          actionError
        )
        const errorMessage =
          actionError.message || "An error occurred during the save operation"

        // Check for fetch/network related errors that could indicate auth issues
        if (
          errorMessage.includes("fetch") ||
          errorMessage.includes("network") ||
          errorMessage.includes("401") ||
          errorMessage.includes("auth")
        ) {
          setGlobalError(
            `Network or authentication error: ${errorMessage}. Try refreshing the page.`
          )
        } else {
          setGlobalError(`Error: ${errorMessage}`)
        }

        toast({
          title: "Action Error",
          description: errorMessage,
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error("Error submitting property selections:", error)
      const message =
        error.message || "An unexpected error occurred during saving."
      setGlobalError(message)
      toast({
        title: "Submission Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Select Properties to Connect</AlertTitle>
        <AlertDescription>
          Choose the GA4 properties you want to make available for querying via
          AI chat. Provide a unique, easy-to-remember{" "}
          <span className="font-semibold">Client Identifier</span> for each -
          this is how you&apos;ll refer to the property in your chat prompts
          (e.g.,{" "}
          <code className="bg-muted rounded px-1 font-mono text-sm">
            your-client-name
          </code>
          ).
        </AlertDescription>
      </Alert>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Select</TableHead>
              <TableHead>GA4 Display Name</TableHead>
              <TableHead>GA4 Property ID</TableHead>
              <TableHead>Client Identifier (for Chat)</TableHead>
              <TableHead>Client Name (for Portal)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fetchedProperties.map(prop => (
              <TableRow key={prop.name}>
                <TableCell>
                  <Checkbox
                    checked={selectionState[prop.name]?.isSelected || false}
                    onCheckedChange={checked =>
                      handleCheckboxChange(prop.name, !!checked)
                    }
                    aria-label={`Select property ${prop.displayName}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {prop.displayName}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {prop.name}
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    placeholder="e.g., your-client-site"
                    value={selectionState[prop.name]?.clientIdentifier || ""}
                    onChange={e =>
                      handleIdentifierChange(prop.name, e.target.value)
                    }
                    className={
                      selectionState[prop.name]?.error?.includes("Identifier")
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {selectionState[prop.name]?.error?.includes("Identifier") && (
                    <p className="mt-1 text-xs text-red-600">
                      {selectionState[prop.name]?.error}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    placeholder="e.g., Your Client Site Inc."
                    value={selectionState[prop.name]?.clientName || ""}
                    onChange={e => handleNameChange(prop.name, e.target.value)}
                    className={
                      selectionState[prop.name]?.error?.includes("Name")
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {selectionState[prop.name]?.error?.includes("Name") && (
                    <p className="mt-1 text-xs text-red-600">
                      {selectionState[prop.name]?.error}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {globalError && (
        <Alert variant="destructive">
          <Terminal className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save Selected Properties"
          )}
        </Button>
      </div>
    </div>
  )
}
