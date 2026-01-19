"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_MIN_LENGTH = 8;

type TokenStatus = "loading" | "valid" | "invalid";

export default function SetupAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("loading");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid");
      setTokenError("No setup token provided.");
      return;
    }

    void fetch(`/api/auth/setup-account/${token}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { valid?: boolean; email?: string; name?: string; error?: string }
          | null;

        if (!response.ok || !data?.valid) {
          setTokenStatus("invalid");
          setTokenError(data?.error ?? "Invalid or expired setup link.");
          return;
        }

        setTokenStatus("valid");
        setEmail(data.email ?? null);
        setUserName(data.name ?? null);
      })
      .catch(() => {
        setTokenStatus("invalid");
        setTokenError("Something went wrong. Please try again.");
      });
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/auth/setup-account/${token}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password: trimmedPassword })
        });

        const data = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;

        if (!response.ok || !data?.success) {
          setError(data?.error ?? "Something went wrong. Please try again.");
          return;
        }

        router.push("/login?setup=1");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  if (tokenStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Set Up Your Account</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Validating your setup link...
          </p>
        </div>
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Setup Link Invalid</h1>
          <p className="mt-4 text-sm text-destructive">
            {tokenError}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Setup links expire after 24 hours. Please contact an administrator
            to receive a new invitation.
          </p>
          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
            <p>
              <Link href="/login" className="font-medium underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Set Up Your Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {userName ? `Welcome, ${userName}! ` : ""}
          Create a password to complete your account setup
          {email ? ` for ${email}` : ""}.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Setting up..." : "Complete Setup"}
          </Button>
        </form>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
