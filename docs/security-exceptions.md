# Temporary dependency audit exception

Approved by the service owner on 2 October 2026 after the tutorial release was
blocked by npm audit. This is risk acceptance, not a vulnerability fix.

- Advisory: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), npm source 1240912.
- Package: `node-forge@1.4.0`, only `node_modules/node-forge` in the lockfile.
- Expiry: **2026-10-09T09:36:10Z** (9 October, 12:36 Moscow), seven days after approval.
- Reason: the latest published forge version has no released fix at approval time.
  The dependency comes through Nuxt/listhen development and build tooling.
- Scope: this single high-severity advisory and its existing seven transitive npm
  audit entries. All other high/critical findings still block CI. Changes to the
  advisory identity, affected forge version or location require a new review.

`node scripts/audit-dependencies.mjs` runs a fresh npm audit, validates the report
and enforces the exact advisory and expiry. Missing/error/inconsistent reports
fail closed. Once the exception expires, the finding blocks CI automatically;
no scheduled job or manual expiry action is needed. A clean audit passes even
past expiry. Do not extend the date without a new explicit approval.

Before publishing, CI scans **both built server runtime images** (`backend` and
`frontend`) with `scripts/assert-no-forge.mjs`. Package manifests, directories,
symlinks, and JavaScript references are checked throughout `/app`. A detected
forge dependency or unreadable scan fails publication and deployment. The
migration/build image is separate and is not a long-running server image.
This static gate supplements npm audit; it is not a general bundled-code SCA.

Removal: when an upstream patch is released, update the affected dependency and
lockfile, run the full audit and CI, then remove the temporary exception logic.
Keep the runtime absence check while the release relies on this exception.

Tests: `node --test scripts/tests/security.test.mjs`.
