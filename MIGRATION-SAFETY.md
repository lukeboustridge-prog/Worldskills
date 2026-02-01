# Migration Safety Guidelines

## ⚠️ CRITICAL: Zero Data Loss Policy

This project has a **ZERO DATA LOSS** policy for database migrations.

## Safe Commands (Production/Staging)

### ✅ ALWAYS USE THESE:

```bash
# Apply pending migrations (safe - never loses data)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# View database in browser
npx prisma studio
```

### ❌ NEVER USE THESE:

```bash
# DANGEROUS: Bypasses data loss warnings
npx prisma db push --accept-data-loss

# DANGEROUS: Resets entire database
npx prisma migrate reset

# DANGEROUS: Can cause data loss in production
npx prisma migrate dev
```

## Development Workflow

### When adding a new model/field:

1. **Update schema.prisma** with your changes
2. **Create migration** (review the generated SQL):
   ```bash
   npx prisma migrate dev --name descriptive_name --create-only
   ```
3. **Review the migration SQL** in `prisma/migrations/`
4. **Check for destructive operations**:
   - Dropping columns
   - Changing column types
   - Removing tables
   - Removing constraints with data
5. **If safe, apply**:
   ```bash
   npx prisma migrate deploy
   ```
6. **If destructive, write a data migration first**

### Before applying ANY migration:

- [ ] Read the SQL in the migration file
- [ ] Verify it won't drop/truncate data
- [ ] Test on a backup/copy of the database first
- [ ] Have a rollback plan

## Emergency: Data Loss Occurred

1. **STOP** - Don't run any more commands
2. Check Neon console for point-in-time recovery options
3. Restore from backup if available
4. Run seed script as last resort: `npx tsx prisma/seed.ts`

## Neon-Specific Settings

The DATABASE_URL must include `pgbouncer=true` for connection pooling:

```
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
```

This prevents transaction timeout issues but also means:
- Interactive transactions are limited
- Some operations must use smaller batches

---

**Last updated:** 2026-02-01
**Policy owner:** Project Lead
