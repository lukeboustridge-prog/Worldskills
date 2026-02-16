"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_MIN_LENGTH = 8;

type TokenStatus = "loading" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("loading");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid");
      setTokenError("Invalid reset link.");
      return;
    }

    void fetch(`/api/auth/reset-password/${token}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { valid?: boolean; email?: string; error?: string }
          | null;

        if (!response.ok || !data?.valid) {
          setTokenStatus("invalid");
          setTokenError(data?.error ?? "Invalid or expired reset link.");
          return;
        }

        setTokenStatus("valid");
        setEmail(data.email ?? null);
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

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/reset-password/${token}`, {
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

      router.push("/login?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Validating your reset link...
          </p>
        </div>
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Reset link invalid</h1>
          <p className="mt-4 text-sm text-destructive">
            {tokenError}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Password reset links expire after 7 days and can only be used once.
          </p>
          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
            <p>
              <Link href="/forgot-password" className="font-medium underline">
                Request a new reset link
              </Link>
            </p>
            <p>
              <Link href="/login" className="underline">
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
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a new password for{" "}
          <span className="font-medium">{email}</span>.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
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
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Resetting password..." : "Reset password"}
          </Button>
        </form>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <p>
            <Link href="/login" className="underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
