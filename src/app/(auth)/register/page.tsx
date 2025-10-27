"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerUser, registrationInitialState, type RegistrationState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account..." : "Create account"}
    </Button>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<RegistrationState, FormData>(registerUser, registrationInitialState);

  useEffect(() => {
    if (state.success) {
      router.push("/login?registered=1");
    }
  }, [state.success, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your login details to access the WorldSkills Skill Advisor Tracker.
        </p>
        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" type="text" required minLength={2} placeholder="Your name" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <SubmitButton />
        </form>
        {state.error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium underline">
              Sign in here
            </Link>
            .
          </p>
          <p>
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
