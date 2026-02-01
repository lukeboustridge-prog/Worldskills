"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const searchParams = useSearchParams();

  const registered = searchParams.get("registered");
  const reset = searchParams.get("reset");
  const setup = searchParams.get("setup");

  let successMessage: string | null = null;
  if (registered) {
    successMessage = "Account created successfully. Sign in with your new credentials.";
  } else if (reset) {
    successMessage = "Password reset successfully. Sign in with your new password.";
  } else if (setup) {
    successMessage = "Account setup complete. Sign in with your new password.";
  }

  return <LoginForm successMessage={successMessage} />;
}
