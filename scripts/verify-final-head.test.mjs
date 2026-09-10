import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { it } from 'vitest';

import { parseIndexEntries, verifyFinalHead } from './verify-final-head.mjs';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/verify-final-head.mjs');
const ZERO_OBJECT_ID = '0'.repeat(40);
const GIT_LOCAL_ENV_VARS = execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
  env: { HOME: process.env.HOME, PATH: process.env.PATH },
})
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

function withoutForeignGitEnvironment(environment = process.env) {
  const cleanEnvironment = { ...environment };
  for (const variable of GIT_LOCAL_ENV_VARS) delete cleanEnvironment[variable];
  return cleanEnvironment;
}

function gitExec(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    ...options,
    env: withoutForeignGitEnvironment(options.env),
  });
}

function git(cwd, ...args) {
  return gitExec(cwd, args).trim();
}

function createRepository({ withHook = false } = {}) {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'lobe-editor-final-head-'));
  const cwd = path.join(parent, 'repo');
  const bin = path.join(parent, 'bin');
  mkdirSync(cwd);
  mkdirSync(bin);

  gitExec(cwd, ['init', '-q']);
  gitExec(cwd, ['config', 'user.email', 'final-head-test@example.invalid']);
  gitExec(cwd, ['config', 'user.name', 'Final head test']);
  writeFileSync(path.join(cwd, 'tracked.txt'), 'initial\n');
  if (withHook) {
    mkdirSync(path.join(cwd, '.husky'));
    mkdirSync(path.join(cwd, 'scripts'));
    copyFileSync(
      path.resolve(process.cwd(), '.husky/pre-push'),
      path.join(cwd, '.husky', 'pre-push'),
    );
    copyFileSync(SCRIPT_PATH, path.join(cwd, 'scripts', 'verify-final-head.mjs'));
    chmodSync(path.join(cwd, '.husky', 'pre-push'), 0o755);
    gitExec(cwd, ['config', 'core.hooksPath', '.husky']);
    gitExec(cwd, ['add', '.']);
  } else {
    gitExec(cwd, ['add', 'tracked.txt']);
  }
  gitExec(cwd, ['commit', '-qm', 'initial']);

  const fakePnpm = path.join(bin, 'pnpm');
  writeFileSync(
    fakePnpm,
    `#!/bin/sh
if [ "\${FINAL_HEAD_TEST_FAIL:-0}" != "0" ]; then exit "\${FINAL_HEAD_TEST_FAIL}"; fi
if [ "\${FINAL_HEAD_TEST_DRIFT:-0}" = "1" ] && [ "\${1}" = "run" ] && [ "\${2}" = "type-check" ]; then
  git commit --allow-empty -qm final-head-drift
fi
if [ "\${FINAL_HEAD_TEST_SET_FLAG:-0}" = "1" ] && [ "\${1}" = "run" ] && [ "\${2}" = "type-check" ]; then
  git update-index --assume-unchanged -- tracked.txt
fi
exit 0
`,
  );
  chmodSync(fakePnpm, 0o755);

  return {
    bin,
    cwd,
    parent,
    cleanup: () => rmSync(parent, { force: true, recursive: true }),
  };
}

function runHookFixture(
  fixture,
  { entryPath = SCRIPT_PATH, env = {}, foreignGitEnvironment = {}, input, dirty = false } = {},
) {
  if (dirty) writeFileSync(path.join(fixture.cwd, 'tracked.txt'), 'dirty\n');

  const head = git(fixture.cwd, 'rev-parse', 'HEAD');
  const result = spawnSync(process.execPath, [entryPath, '--pre-push'], {
    cwd: fixture.cwd,
    encoding: 'utf8',
    env: {
      ...withoutForeignGitEnvironment({ ...foreignGitEnvironment, ...env }),
      PATH: `${fixture.bin}:${process.env.PATH}`,
    },
    input: input ?? `refs/heads/main ${head} refs/heads/main ${ZERO_OBJECT_ID}\n`,
  });

  return { head, result };
}

function configureBareRemote(fixture) {
  const remote = path.join(fixture.parent, 'remote.git');
  gitExec(fixture.parent, ['init', '--bare', '-q', remote]);
  gitExec(fixture.cwd, ['remote', 'add', 'origin', remote]);
  return remote;
}

function pushFixture(fixture, refspec, env = {}) {
  return spawnSync('git', ['push', 'origin', refspec], {
    cwd: fixture.cwd,
    encoding: 'utf8',
    env: {
      ...withoutForeignGitEnvironment(),
      ...env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
    },
  });
}

it('final-head gate succeeds for the actual pushed HEAD and prints the exact SHA', () => {
  const fixture = createRepository();
  try {
    const { head, result } = runHookFixture(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`PASS HEAD=${head}`));
  } finally {
    fixture.cleanup();
  }
});

it('keeps a foreign GIT_DIR from redirecting temporary-repository validation', () => {
  const fixture = createRepository();
  try {
    const foreignConfig = path.join(fixture.parent, 'foreign.gitconfig');
    writeFileSync(foreignConfig, '[core]\nfilemode = false\n');
    const foreignConfigBefore = readFileSync(foreignConfig, 'utf8');
    const { result } = runHookFixture(fixture, {
      foreignGitEnvironment: {
        GIT_CONFIG: foreignConfig,
        GIT_DIR: path.resolve('.git'),
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(foreignConfig, 'utf8'), foreignConfigBefore);
  } finally {
    fixture.cleanup();
  }
});

it('executes the gate when its CLI entry is reached through a symlink', () => {
  const fixture = createRepository();
  try {
    const symlinkPath = path.join(fixture.parent, 'verify-final-head-link.mjs');
    symlinkSync(SCRIPT_PATH, symlinkPath);
    const { result } = runHookFixture(fixture, { dirty: true, entryPath: symlinkPath });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /worktree has changes outside allowed acceptance reports/);
  } finally {
    fixture.cleanup();
  }
});

it('final-head gate allows acceptance-report artifacts without allowing other untracked files', () => {
  const fixture = createRepository();
  try {
    mkdirSync(path.join(fixture.cwd, 'docs'));
    writeFileSync(
      path.join(fixture.cwd, 'docs', 'collaboration-acceptance-2026-09-06.md'),
      'report\n',
    );
    writeFileSync(
      path.join(fixture.cwd, 'docs', 'page-agent-three-issues-acceptance-2026-09-06.md'),
      'report\n',
    );
    const { result } = runHookFixture(fixture);

    assert.equal(result.status, 0, result.stderr);

    writeFileSync(path.join(fixture.cwd, 'unexpected-report.txt'), 'not an acceptance report\n');
    const rejected = runHookFixture(fixture);
    assert.equal(rejected.result.status, 1);
    assert.match(rejected.result.stderr, /unexpected-report\.txt/);
  } finally {
    fixture.cleanup();
  }
});

it('pre-push skips empty and deletion-only updates without running the suite', () => {
  const fixture = createRepository();
  try {
    const empty = runHookFixture(fixture, { input: '' });
    assert.equal(empty.result.status, 0, empty.result.stderr);
    assert.match(empty.result.stdout, /no refs updated/);

    const deletion = runHookFixture(fixture, {
      input: `refs/heads/main ${ZERO_OBJECT_ID} refs/heads/main ${'b'.repeat(40)}\n`,
    });
    assert.equal(deletion.result.status, 0, deletion.result.stderr);
    assert.match(deletion.result.stdout, /deletion-only push/);
  } finally {
    fixture.cleanup();
  }
});

it('final-head gate rejects a dirty worktree before running checks', () => {
  const fixture = createRepository();
  try {
    const { result } = runHookFixture(fixture, { dirty: true });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /worktree has changes outside allowed acceptance reports/);
  } finally {
    fixture.cleanup();
  }
});

it('rejects hidden tracked changes for every supported index flag without clearing flags', () => {
  const fixture = createRepository();
  try {
    const hiddenFiles = [
      { name: 'assumed name.txt', flags: ['--assume-unchanged'], expectedFlag: 'h' },
      { name: 'skipped\nname.txt', flags: ['--skip-worktree'], expectedFlag: 'S' },
      {
        name: 'combined name\n.txt',
        flags: ['--assume-unchanged', '--skip-worktree'],
        expectedFlag: 's',
      },
    ];

    for (const { name } of hiddenFiles) {
      writeFileSync(path.join(fixture.cwd, name), 'initial\n');
    }
    gitExec(fixture.cwd, ['add', '.']);
    gitExec(fixture.cwd, ['commit', '-qm', 'add hidden-flag fixtures']);

    for (const { name, flags } of hiddenFiles) {
      writeFileSync(path.join(fixture.cwd, name), 'hidden tracked change\n');
      gitExec(fixture.cwd, ['update-index', flags[0], '--', name]);
      if (flags[1]) gitExec(fixture.cwd, ['update-index', flags[1], '--', name]);
    }

    const before = parseIndexEntries(gitExec(fixture.cwd, ['ls-files', '-v', '-z']));
    const { result } = runHookFixture(fixture);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /tracked files have Git index flags that can hide changes/);
    for (const { name, expectedFlag } of hiddenFiles) {
      assert.ok(result.stderr.includes(JSON.stringify(name)), `missing ${JSON.stringify(name)}`);
      assert.ok(
        result.stderr.includes(`flag ${expectedFlag}`),
        `missing flag ${expectedFlag} for ${JSON.stringify(name)}`,
      );
    }

    const after = parseIndexEntries(gitExec(fixture.cwd, ['ls-files', '-v', '-z']));
    assert.deepEqual(after, before);
  } finally {
    fixture.cleanup();
  }
});

it('final-head gate rejects a pushed object that is not current HEAD', () => {
  const fixture = createRepository();
  try {
    const otherObjectId = 'a'.repeat(40);
    const { result } = runHookFixture(fixture, {
      input: `refs/heads/main ${otherObjectId} refs/heads/main ${ZERO_OBJECT_ID}\n`,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not resolve to current HEAD/);
  } finally {
    fixture.cleanup();
  }
});

it('final-head gate rejects a command failure', () => {
  const fixture = createRepository();
  try {
    const { result } = runHookFixture(fixture, { env: { FINAL_HEAD_TEST_FAIL: '7' } });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /type-check failed with exit code 7/);
  } finally {
    fixture.cleanup();
  }
});

it('final-head gate rejects HEAD changes between checks', () => {
  const fixture = createRepository();
  try {
    const { result } = runHookFixture(fixture, { env: { FINAL_HEAD_TEST_DRIFT: '1' } });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /HEAD changed during final validation/);
  } finally {
    fixture.cleanup();
  }
});

it('pre-push gates a real local bare remote and supports annotated tags', () => {
  const fixture = createRepository({ withHook: true });
  try {
    const remote = configureBareRemote(fixture);
    const branchPush = pushFixture(fixture, 'HEAD:refs/heads/main');
    assert.equal(branchPush.status, 0, `${branchPush.stdout}\n${branchPush.stderr}`);
    const head = git(fixture.cwd, 'rev-parse', 'HEAD');
    assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), head);

    gitExec(fixture.cwd, ['tag', '-a', 'v-final-head', '-m', 'final head']);
    const tagPush = pushFixture(fixture, 'refs/tags/v-final-head:refs/tags/v-final-head');
    assert.equal(tagPush.status, 0, `${tagPush.stdout}\n${tagPush.stderr}`);
    assert.equal(git(remote, 'rev-parse', 'refs/tags/v-final-head^{commit}'), head);

    writeFileSync(path.join(fixture.cwd, 'tracked.txt'), 'second commit\n');
    gitExec(fixture.cwd, ['add', 'tracked.txt']);
    gitExec(fixture.cwd, ['commit', '-qm', 'second']);
    writeFileSync(path.join(fixture.cwd, 'tracked.txt'), 'dirty before push\n');
    const dirtyPush = pushFixture(fixture, 'HEAD:refs/heads/main');
    assert.notEqual(dirtyPush.status, 0);
    assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), head);

    gitExec(fixture.cwd, ['restore', 'tracked.txt']);
    const failedCommandPush = pushFixture(fixture, 'HEAD:refs/heads/main', {
      FINAL_HEAD_TEST_FAIL: '7',
    });
    assert.notEqual(failedCommandPush.status, 0);
    assert.match(`${failedCommandPush.stdout}\n${failedCommandPush.stderr}`, /type-check failed/);
    assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), head);
  } finally {
    fixture.cleanup();
  }
});

it('pre-push rejects hidden tracked changes before updating a real bare remote', () => {
  const fixture = createRepository({ withHook: true });
  try {
    const remote = configureBareRemote(fixture);
    writeFileSync(path.join(fixture.cwd, 'tracked.txt'), 'hidden tracked change\n');
    gitExec(fixture.cwd, ['update-index', '--skip-worktree', '--', 'tracked.txt']);

    const push = pushFixture(fixture, 'HEAD:refs/heads/main');
    assert.notEqual(push.status, 0);
    assert.match(`${push.stdout}\n${push.stderr}`, /tracked files have Git index flags/);
    const remoteRef = spawnSync(
      'git',
      ['--git-dir', remote, 'show-ref', '--verify', '--quiet', 'refs/heads/main'],
      { env: withoutForeignGitEnvironment(), stdio: 'ignore' },
    );
    assert.notEqual(remoteRef.status, 0);
    assert.equal(git(fixture.cwd, 'ls-files', '-v', '--', 'tracked.txt'), 'S tracked.txt');
  } finally {
    fixture.cleanup();
  }
});

it('pre-push rejects an index flag added during validation and leaves it untouched', () => {
  const fixture = createRepository({ withHook: true });
  try {
    const remote = configureBareRemote(fixture);
    const push = pushFixture(fixture, 'HEAD:refs/heads/main', {
      FINAL_HEAD_TEST_SET_FLAG: '1',
    });

    assert.notEqual(push.status, 0);
    assert.match(`${push.stdout}\n${push.stderr}`, /tracked files have Git index flags/);
    const remoteRef = spawnSync(
      'git',
      ['--git-dir', remote, 'show-ref', '--verify', '--quiet', 'refs/heads/main'],
      { env: withoutForeignGitEnvironment(), stdio: 'ignore' },
    );
    assert.notEqual(remoteRef.status, 0);
    assert.equal(git(fixture.cwd, 'ls-files', '-v', '--', 'tracked.txt'), 'h tracked.txt');
  } finally {
    fixture.cleanup();
  }
});

it('pre-push rejects a real ref that points at an older commit than HEAD', () => {
  const fixture = createRepository({ withHook: true });
  try {
    const remote = configureBareRemote(fixture);
    const firstHead = git(fixture.cwd, 'rev-parse', 'HEAD');
    writeFileSync(path.join(fixture.cwd, 'tracked.txt'), 'second\n');
    gitExec(fixture.cwd, ['add', 'tracked.txt']);
    gitExec(fixture.cwd, ['commit', '-qm', 'second']);
    git(fixture.cwd, 'update-ref', 'refs/heads/stale', firstHead);

    const stalePush = pushFixture(fixture, 'refs/heads/stale:refs/heads/stale');
    assert.notEqual(stalePush.status, 0);
    assert.match(`${stalePush.stdout}\n${stalePush.stderr}`, /does not resolve to current HEAD/);
    const remoteStaleRef = spawnSync(
      'git',
      ['--git-dir', remote, 'show-ref', '--verify', '--quiet', 'refs/heads/stale'],
      { env: withoutForeignGitEnvironment(), stdio: 'ignore' },
    );
    assert.notEqual(remoteStaleRef.status, 0);
  } finally {
    fixture.cleanup();
  }
});

it('final-head core runs checks serially and rechecks the invariant after each step', () => {
  const head = 'b'.repeat(40);
  const calls = [];
  const git = (args) => {
    if (args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'HEAD') return head;
    if (args[0] === 'status') return '';
    if (args[0] === 'ls-files') return '';
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  };

  const result = verifyFinalHead({
    cwd: '/tmp/final-head-test',
    git,
    logger: () => {},
    runStep: (step) => {
      calls.push(step.label);
    },
  });

  assert.deepEqual(calls, ['type-check', 'full test suite', 'build']);
  assert.equal(result.head, head);
});
