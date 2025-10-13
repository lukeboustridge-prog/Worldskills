-- Add Pending role to enum and set as default for new users
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Pending';

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'Pending';
