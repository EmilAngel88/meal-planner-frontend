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

## Dependency repair prepared on 8 October 2026

The tutorial release e31d1f9 was blocked before container publication by new
advisories. Compatible updates replace shell-quote 1.10.0 with 1.12.0 and
source-map-js 1.2.1 with 1.2.2. A scoped override upgrades DevTools' simple-git
to 4.0.2 (argv-parser 2.0.1). DevTools 3.4.2 needs a narrowly checked postinstall
compatibility patch: its removed default import is replaced by the named
simpleGit factory. The patch is idempotent and rejects unexpected versions
or source layouts. Its tests cover a real ESM named-export fixture.

npm 11.21.0 is pinned in packageManager, CI and Docker build stages because
older npm can lose overrides across workspace links. See the upstream
[workspace override fix](https://github.com/npm/cli/pull/9671).

## Additional exception approved on 8 October 2026

The service owner explicitly approved the following separate temporary exception.
It does not extend the original deadline or allow other high/critical findings.

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), npm source 1240992.
- Package: `braces@3.0.3`, only `node_modules/braces` in the lockfile.
- Expiry: **2026-10-09T09:36:10Z** (9 October, 12:36 Moscow).
- Scope: the exact high-severity advisory (`<=3.0.3`) and its four audit entries:
  `braces`, `micromatch`, `fast-glob`, `globby`. The accepted graph is
  `micromatch -> braces`, `fast-glob -> micromatch`, and
  `globby -> fast-glob, micromatch`. Different advisory identities, dependency
  locations, versions of braces, edges, or additional findings fail closed.
- Risk accepted: denial of service from untrusted deeply nested glob patterns in
  build tooling. No upstream braces fix was available when this was approved.
- Condition: before publishing, **both backend and frontend server runtime
  images** must pass `scripts/assert-no-braces.mjs` as well as the existing
  forge check. The new check rejects braces and its glob dependency chain via
  package directories/manifests and JavaScript references throughout `/app`.
  It follows symlinks, fails on unreadable/missing scan roots, and distinguishes
  ordinary uses of the word "braces" from module code. This static check is an
  additional gate, not a general bundled-code SCA.

Tests: `node --test scripts/tests/security.test.mjs scripts/tests/braces-exception.test.mjs scripts/tests/braces-runtime.test.mjs scripts/tests/patch-devtools-git.test.mjs`.
