"use client";

import { useTransition } from "react";
import { Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImpersonationBannerProps {
  userName: string | null;
  userEmail: string;
  stopAction: () => Promise<void>;
}

export function ImpersonationBanner({ userName, userEmail, stopAction }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  const handleStop = () => {
    startTransition(async () => {
      await stopAction();
    });
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4" />
          <span>
            Impersonating <strong>{userName ?? userEmail}</strong>
          </span>
        </div>
        <Button
          onClick={handleStop}
          disabled={isPending}
          variant="outline"
          size="sm"
          className="h-7 bg-amber-100 border-amber-600 text-amber-900 hover:bg-amber-200"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Stopping...
            </>
          ) : (
            "Stop Impersonating"
          )}
        </Button>
      </div>
    </div>
  );
}
