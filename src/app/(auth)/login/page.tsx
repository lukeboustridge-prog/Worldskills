"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        setMessage(result.error);
      } else {
        setMessage("Check your email for a login link.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">WorldSkills Skill Advisor Tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your work email to manage skills and deliverables.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending magic link..." : "Send magic link"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
        <p className="mt-8 text-xs text-muted-foreground">
          Need access? Contact your WorldSkills Skill Advisor or email the WorldSkills team.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
