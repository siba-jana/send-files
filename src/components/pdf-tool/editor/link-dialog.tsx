"use client";

/** Insert/edit hyperlink dialog. Mounted fresh each time it opens. */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Unlink } from "lucide-react";
import * as commands from "@/lib/editor/commands";
import type { SelectionManager } from "@/lib/editor/dom";

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: SelectionManager;
  onContentChange: () => void;
}

export function LinkDialog({ open, onOpenChange, selection, onContentChange }: LinkDialogProps) {
  // Fresh mount on every open keeps the field empty without effects.
  const [url, setUrl] = useState("");
  if (!open) return null;

  const apply = () => {
    const text = selection.selectedText();
    selection.restore();
    commands.createLink(url, text);
    onContentChange();
    onOpenChange(false);
  };

  const remove = () => {
    selection.restore();
    commands.unlink();
    onContentChange();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
          <DialogDescription>
            {selection.selectedText()
              ? "The selected text will become a link."
              : "The address will be inserted as link text."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="t2p-link-url">Web or email address</Label>
            <Input
              id="t2p-link-url"
              value={url}
              placeholder="https://example.com"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" size="sm" onClick={remove}>
              <Unlink className="h-4 w-4" aria-hidden />
              Remove link
            </Button>
            <Button size="sm" onClick={apply} disabled={!url.trim()}>
              Apply link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
