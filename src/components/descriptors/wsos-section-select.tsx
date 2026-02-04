"use client";

import { useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DuplicateWarning } from "@/components/wsos/duplicate-warning";
import {
  checkSimilarSectionsAction,
  createWSOSSectionAction,
} from "@/app/(dashboard)/settings/wsos-sections/actions";
import type { WSOSSectionWithCreator, SimilarSection } from "@/lib/wsos-sections";

interface WSOSSectionSelectProps {
  sections: WSOSSectionWithCreator[];
  name: string;
  defaultValue?: string;
  required?: boolean;
  onSectionCreated?: () => void;
}

export function WSOSSectionSelect({
  sections,
  name,
  defaultValue,
  required = true,
  onSectionCreated,
}: WSOSSectionSelectProps) {
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<SimilarSection[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const checkSimilar = useDebouncedCallback(async (value: string) => {
    if (value.length < 3) {
      setSimilar([]);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    try {
      const results = await checkSimilarSectionsAction(value);
      setSimilar(results);
    } finally {
      setIsChecking(false);
    }
  }, 500);

  const handleNameChange = (value: string) => {
    setNewName(value);
    checkSimilar(value);
  };

  const handleCreateSection = async (formData: FormData) => {
    startTransition(async () => {
      // Create section via existing action
      await createWSOSSectionAction(formData);
      // Close dialog and trigger refresh
      setCreateOpen(false);
      setNewName("");
      setSimilar([]);
      // Parent should refresh sections list
      onSectionCreated?.();
    });
  };

  return (
    <div className="flex gap-2">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selectedId} />

      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select WSOS section..." />
        </SelectTrigger>
        <SelectContent>
          {sections.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              {section.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon" title="Create new section">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New WSOS Section</DialogTitle>
          </DialogHeader>
          <form action={handleCreateSection} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newSectionName">Section Name</Label>
              <div className="relative">
                <Input
                  id="newSectionName"
                  name="name"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter section name..."
                  required
                  minLength={3}
                />
                {isChecking && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <DuplicateWarning similar={similar} />

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || newName.length < 3}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Section"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
