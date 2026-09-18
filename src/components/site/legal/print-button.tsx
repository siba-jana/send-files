"use client"

import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Print button for the legal pages (client island — window.print only exists
 * in the browser). Hidden when already printing.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 rounded-lg text-xs font-medium text-muted-foreground print:hidden"
      onClick={() => window.print()}
    >
      <Printer aria-hidden="true" className="size-3.5" />
      {label}
    </Button>
  )
}
