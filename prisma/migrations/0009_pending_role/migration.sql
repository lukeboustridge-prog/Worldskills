-- Add Pending role to enum. The default will be updated in a follow-up
-- migration so Postgres can commit the new enum value first.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Pending';
