export function getUserDisplayName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const trimmedName = user.name?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName;
  }

  const trimmedEmail = user.email?.trim();
  if (trimmedEmail && trimmedEmail.length > 0) {
    return trimmedEmail;
  }

  return "Unknown user";
}
