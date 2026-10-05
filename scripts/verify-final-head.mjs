#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_PATH);
const DEFAULT_REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const OBJECT_ID_PATTERN = /^[0-9a-f]{40,64}$/i;
const ALLOWED_REPORT_ARTIFACT_PATTERN = /^docs\/[^/]+-acceptance-\d{4}-\d{2}-\d{2}\.md$/;
const HIDDEN_INDEX_FLAGS = new Map([
  ['h', 'assume-unchanged'],
  ['S', 'skip-worktree'],
  ['s', 'assume-unchanged + skip-worktree'],
]);

export const ZERO_OBJECT_ID = /^0+$/;

export class FinalHeadVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FinalHeadVerificationError';
  }
}

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new FinalHeadVerificationError(`git ${args.join(' ')} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new FinalHeadVerificationError(
      `git ${args.join(' ')} failed${detail ? `: ${detail}` : ` with exit code ${result.status}`}`,
    );
  }

  return result.stdout.trim();
}

function runCommand({ command, args, cwd }) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new FinalHeadVerificationError(
      `${formatCommand(command, args)} failed: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new FinalHeadVerificationError(
      `${formatCommand(command, args)} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }
}

function isObjectId(value) {
  return OBJECT_ID_PATTERN.test(value);
}

function isZeroObjectId(value) {
  return isObjectId(value) && ZERO_OBJECT_ID.test(value);
}

export function parsePushInput(input) {
  const refs = [];

  for (const [lineNumber, rawLine] of input.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields = line.split(/\s+/);
    if (fields.length !== 4) {
      throw new FinalHeadVerificationError(
        `pre-push input line ${lineNumber + 1} must contain local ref, local OID, remote ref, and remote OID`,
      );
    }

    const [localRef, localObjectId, remoteRef, remoteObjectId] = fields;
    if (!isObjectId(localObjectId) || !isObjectId(remoteObjectId)) {
      throw new FinalHeadVerificationError(
        `pre-push input line ${lineNumber + 1} contains an invalid object ID`,
      );
    }

    refs.push({ localObjectId, localRef, remoteObjectId, remoteRef });
  }

  return refs;
}

export function assertPushesMatchHead(refs, expectedHead, { cwd, git = runGit } = {}) {
  for (const ref of refs) {
    if (isZeroObjectId(ref.localObjectId)) continue;

    let pushedCommit;
    try {
      pushedCommit = git(['rev-parse', '--verify', `${ref.localObjectId}^{commit}`], cwd);
    } catch {
      pushedCommit = null;
    }

    if (pushedCommit !== expectedHead) {
      throw new FinalHeadVerificationError(
        `refusing push of ${ref.localRef} (${ref.localObjectId}): it does not resolve to current HEAD ${expectedHead}`,
      );
    }
  }
}

function assertHead(git, cwd, expectedHead) {
  const actualHead = git(['rev-parse', '--verify', 'HEAD'], cwd);
  if (actualHead !== expectedHead) {
    throw new FinalHeadVerificationError(
      `HEAD changed during final validation: expected ${expectedHead}, found ${actualHead}`,
    );
  }
}

function getWorktreeStatus(git, cwd) {
  return git(['status', '--porcelain=v1', '--untracked-files=all'], cwd);
}

export function parseIndexEntries(output) {
  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const flag = entry[0];
      if (entry[1] !== ' ' || !flag) {
        throw new FinalHeadVerificationError(
          `git ls-files -v -z returned a malformed index entry: ${JSON.stringify(entry)}`,
        );
      }

      return { flag, path: entry.slice(2) };
    });
}

function getHiddenIndexEntries(git, cwd) {
  return parseIndexEntries(git(['ls-files', '-v', '-z'], cwd)).filter(({ flag }) =>
    HIDDEN_INDEX_FLAGS.has(flag),
  );
}

function isAllowedReportArtifact(statusLine) {
  if (!statusLine.startsWith('?? ')) return false;
  return ALLOWED_REPORT_ARTIFACT_PATTERN.test(statusLine.slice(3));
}

export function getDisallowedWorktreeChanges(status) {
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((statusLine) => !isAllowedReportArtifact(statusLine));
}

function assertCleanWorktree(git, cwd) {
  const status = getWorktreeStatus(git, cwd);
  const disallowedChanges = getDisallowedWorktreeChanges(status);
  if (disallowedChanges.length > 0) {
    throw new FinalHeadVerificationError(
      `worktree has changes outside allowed acceptance reports; commit or remove them before final validation:\n${disallowedChanges.join('\n')}`,
    );
  }
}

function assertNoHiddenIndexFlags(git, cwd) {
  const hiddenEntries = getHiddenIndexEntries(git, cwd);
  if (hiddenEntries.length === 0) return;

  const details = hiddenEntries
    .map(
      ({ flag, path: entryPath }) =>
        `- ${JSON.stringify(entryPath)} (${HIDDEN_INDEX_FLAGS.get(flag)}, flag ${flag})`,
    )
    .join('\n');
  throw new FinalHeadVerificationError(
    `tracked files have Git index flags that can hide changes; clear them before final validation (the gate does not modify index flags):\n${details}`,
  );
}

function assertStable(git, cwd, expectedHead) {
  assertHead(git, cwd, expectedHead);
  assertCleanWorktree(git, cwd);
  assertNoHiddenIndexFlags(git, cwd);
}

export function verifyFinalHead({
  cwd = DEFAULT_REPOSITORY_ROOT,
  git = runGit,
  logger = console.log,
  pushInput,
  runStep = runCommand,
} = {}) {
  const expectedHead = git(['rev-parse', '--verify', 'HEAD'], cwd);
  if (!isObjectId(expectedHead)) {
    throw new FinalHeadVerificationError(
      `HEAD did not resolve to a full object ID: ${expectedHead}`,
    );
  }

  if (pushInput !== undefined) {
    const refs = parsePushInput(pushInput);
    if (refs.length === 0) {
      logger('[final-head] no refs updated; skipping final validation');
      return { deletedOnly: true, head: expectedHead };
    }

    assertPushesMatchHead(refs, expectedHead, { cwd, git });

    if (refs.length > 0 && refs.every((ref) => isZeroObjectId(ref.localObjectId))) {
      logger('[final-head] deletion-only push; no commit requires validation');
      return { deletedOnly: true, head: expectedHead };
    }
  }

  assertStable(git, cwd, expectedHead);

  const steps = [
    { args: ['run', 'type-check'], command: 'pnpm', label: 'type-check' },
    {
      args: ['exec', 'vitest', 'run'],
      command: 'pnpm',
      label: 'full test suite',
    },
    { args: ['run', 'build'], command: 'pnpm', label: 'build' },
  ];

  logger(`[final-head] validating HEAD ${expectedHead}`);
  logger('[final-head] tests: full Vitest suite (serial with type-check and build)');

  for (const step of steps) {
    assertStable(git, cwd, expectedHead);
    logger(`[final-head] ${step.label}: ${formatCommand(step.command, step.args)}`);
    runStep({ ...step, cwd });
    assertStable(git, cwd, expectedHead);
  }

  logger(`[final-head] PASS HEAD=${expectedHead} source=clean`);
  return { deletedOnly: false, head: expectedHead, steps };
}

function readCliArguments(argv) {
  const unknown = argv.filter((argument) => argument !== '--pre-push');
  if (unknown.length > 0) {
    throw new FinalHeadVerificationError(`unknown argument: ${unknown[0]}`);
  }

  return { prePush: argv.includes('--pre-push') };
}

export function runCli(argv = process.argv.slice(2)) {
  const { prePush } = readCliArguments(argv);
  const cwd = runGit(['rev-parse', '--show-toplevel'], process.cwd());
  const pushInput = prePush ? readFileSync(0, 'utf8') : undefined;

  return verifyFinalHead({ cwd, pushInput });
}

const isMainModule = (() => {
  if (!process.argv[1]) return false;

  try {
    return realpathSync(process.argv[1]) === realpathSync(SCRIPT_PATH);
  } catch {
    return false;
  }
})();
if (isMainModule) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[final-head] FAIL: ${message}`);
    process.exitCode = 1;
  }
}
