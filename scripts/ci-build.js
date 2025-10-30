#!/usr/bin/env node
const { execSync } = require('node:child_process');

// Vercel's build environment occasionally times out when Prisma attempts to
// acquire Neon advisory locks. To keep builds green, we skip migrate deploy in
// CI and rely on a separate, longer-lived environment to apply migrations.
const isCI = process.env.VERCEL === '1' || process.env.CI === 'true';

function run(command, options = {}) {
  execSync(command, { stdio: 'inherit', ...options });
}

function runSafe(command) {
  try {
    run(command);
  } catch (error) {
    console.warn(`[ci-build] Optional step failed (continuing): ${command}`);
    console.warn(error.message);
  }
}

console.log('[ci-build] Running prisma generate');
run('prisma generate');

if (isCI) {
  console.log('[ci-build] Detected CI/Vercel environment; skipping prisma migrate deploy to avoid Neon advisory lock timeouts.');
  console.log('[ci-build] Skipping migration repair and deploy steps. Ensure migrations are applied from a trusted environment.');
} else {
  console.log('[ci-build] Running migration repair script');
  runSafe('node scripts/repair-failed-migration.js');

  console.log('[ci-build] Applying pending migrations');
  run('prisma migrate deploy');
}

console.log('[ci-build] Building Next.js application');
run('next build');
