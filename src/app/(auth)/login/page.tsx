"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  default: "Unable to sign in. Please try again."
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const registered = searchParams.get("registered");
  const reset = searchParams.get("reset");
  const setup = searchParams.get("setup");

  useEffect(() => {
    if (registered) {
      setMessage("Account created successfully. Sign in with your new credentials.");
      setMessageType("success");
    } else if (reset) {
      setMessage("Password reset successfully. Sign in with your new password.");
      setMessageType("success");
    } else if (setup) {
      setMessage("Account setup complete. Sign in with your new password.");
      setMessageType("success");
    }
  }, [registered, reset, setup]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setMessageType(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        const errorMessage = ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.default;
        setMessage(errorMessage);
        setMessageType("error");
        return;
      }

      if (result?.url) {
        router.push(result.url);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ERROR_MESSAGES.default);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">WorldSkills Skill Advisor Tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your email address and password to manage skills and deliverables.
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Forgot your password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        {message ? (
          <p
            className={`mt-4 text-sm ${messageType === "error" ? "text-destructive" : "text-emerald-600"}`}
          >
            {message}
          </p>
        ) : null}
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <p>
            Need an account?{" "}
            <Link href="/register" className="font-medium underline">
              Create one now
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
