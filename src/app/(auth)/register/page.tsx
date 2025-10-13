"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NAME_MIN_LENGTH = 2;
const PASSWORD_MIN_LENGTH = 8;
const GENERIC_ERROR_MESSAGE = "We couldn't create your account right now. Please try again.";

const ROLE_LABELS: Record<string, string> = {
  SA: "Skill Advisor",
  SCM: "Skill Competition Manager",
  Secretariat: "Secretariat"
};

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

type InvitationDetails = {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  expiresAt: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered")) {
      setMessage({
        type: "success",
        text: "Account created successfully. Sign in with your new credentials."
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setInvitation(null);
      setInviteInfo(null);
      return;
    }

    setIsLoadingInvitation(true);
    setInviteInfo(null);

    void fetch(`/api/invitations/${tokenParam}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string; invitation?: InvitationDetails }
          | null;

        if (!response.ok || !data?.success || !data.invitation) {
          const errorMessage = data?.error ?? "We couldn't validate your invitation link.";
          setInvitation(null);
          setInviteInfo(null);
          setMessage({ type: "error", text: errorMessage });
          return;
        }

        setInvitation(data.invitation);
        const roleLabel = ROLE_LABELS[data.invitation.role] ?? data.invitation.role;
        setInviteInfo(
          `Invitation confirmed. You'll join as ${
            data.invitation.isAdmin ? "an administrator" : roleLabel
          }.`
        );
        setMessage(null);
        setName((current) => (current.trim().length > 0 ? current : data.invitation.name ?? ""));
        setEmail(data.invitation.email);
      })
      .catch(() => {
        setInvitation(null);
        setInviteInfo(null);
        setMessage({
          type: "error",
          text: "We couldn't validate your invitation link. Please try again."
        });
      })
      .finally(() => {
        setIsLoadingInvitation(false);
      });
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    const trimmedPassword = password.trim();

    if (trimmedName.length < NAME_MIN_LENGTH) {
      setMessage({ type: "error", text: "Name must be at least 2 characters long." });
      return;
    }

    if (!normalizedEmail) {
      setMessage({ type: "error", text: "Enter a valid email address." });
      return;
    }

    if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
      setMessage({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const tokenParam = searchParams.get("token");
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: trimmedName,
          email: normalizedEmail,
          password: trimmedPassword,
          token: tokenParam ?? undefined
        })
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        const errorMessage = data?.error ?? GENERIC_ERROR_MESSAGE;
        setMessage({ type: "error", text: errorMessage });
        return;
      }

      router.push("/login?registered=1");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE;
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your login details to access the WorldSkills Skill Advisor Tracker.
        </p>
        {inviteInfo ? (
          <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {inviteInfo}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              minLength={NAME_MIN_LENGTH}
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={Boolean(invitation)}
            />
          </div>
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
          <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingInvitation}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
        {message ? (
          <p
            className={`mt-4 text-sm ${
              message.type === "error" ? "text-destructive" : "text-emerald-600"
            }`}
            role="alert"
          >
            {message.text}
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
