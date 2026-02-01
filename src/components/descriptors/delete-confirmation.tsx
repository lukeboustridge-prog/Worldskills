"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDescriptorAction } from "@/app/(dashboard)/settings/descriptors/actions";

interface DeleteConfirmationProps {
  descriptorId: string;
  criterionName: string;
}

export function DeleteConfirmation({ descriptorId, criterionName }: DeleteConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleDelete = async () => {
    const formData = new FormData();
    formData.set("id", descriptorId);
    await deleteDescriptorAction(formData);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <dialog
        ref={dialogRef}
        className="rounded-lg border bg-background p-6 shadow-lg backdrop:bg-black/60"
      >
        <h2 className="text-lg font-semibold">Delete Descriptor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete "{criterionName}"?
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This descriptor will be soft-deleted and can be restored if needed.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </dialog>
    </>
  );
}
