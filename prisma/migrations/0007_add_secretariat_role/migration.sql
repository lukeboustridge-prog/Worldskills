DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'Secretariat'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'Secretariat';
  END IF;
END $$;
