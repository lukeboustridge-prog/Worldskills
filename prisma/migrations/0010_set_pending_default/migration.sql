-- Set Pending as the default role for new users now that the enum value
-- exists in the database.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'Pending';
