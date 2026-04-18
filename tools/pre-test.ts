#!/usr/bin/env node
/**
 * pre-test: lightweight environment check that runs before lint and tests.
 *
 * Several npm scripts (lint-js, lint-ts, test) reference this file; before
 * this commit it did not exist, which silently broke the lint/test pipeline.
 *
 * For now this is intentionally minimal: it just verifies the toolchain
 * versions we depend on. As the codebase matures this is the place to add
 * generated artefacts (e.g. translation manifests, schema bundles).
 */

import { execSync } from 'node:child_process';

const MIN_NODE_MAJOR = 20;

function fail(msg: string): never {
  console.error(`pre-test: ${msg}`);
  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
  fail(`Node ${MIN_NODE_MAJOR}+ required, found ${process.versions.node}`);
}

try {
  execSync('npx --no-install tsc --version', { stdio: 'ignore' });
} catch {
  fail('tsc is not available; run `npm install` first');
}

console.log(`pre-test: ok (node ${process.versions.node})`);
