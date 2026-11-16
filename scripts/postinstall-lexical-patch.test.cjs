 

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.join(__dirname, 'postinstall-lexical-patch.cjs');
const patchCases = [
  {
    artifact: 'LexicalYjs.dev.js',
    packageName: '@lexical/yjs',
    patchFile: '@lexical__yjs@0.42.0.patch',
    rootOverride: 'LOBE_EDITOR_LEXICAL_YJS_ROOT',
  },
  {
    artifact: 'LexicalTable.dev.js',
    packageName: '@lexical/table',
    patchFile: '@lexical__table@0.42.0.patch',
    rootOverride: 'LOBE_EDITOR_LEXICAL_TABLE_ROOT',
  },
];

const setPatchState = (packageRoot, patchFile, shouldBePatched) => {
  const reverseCheck = spawnSync('git', ['apply', '--reverse', '--check', patchFile], {
    cwd: packageRoot,
  });
  const isPatched = reverseCheck.status === 0;
  if (isPatched === shouldBePatched) return;

  const args = shouldBePatched ? ['apply', patchFile] : ['apply', '--reverse', patchFile];
  const result = spawnSync('git', args, { cwd: packageRoot });
  assert.equal(result.status, 0, result.stderr.toString());
};

test('concurrent installers never observe partially written Lexical compatibility files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-patch-race-'));
  try {
    for (const targetCase of patchCases) {
      const caseRoot = path.join(root, targetCase.packageName.replaceAll('/', '-'));
      fs.mkdirSync(caseRoot, { recursive: true });
      const env = { ...process.env };

      for (const packageCase of patchCases) {
        const source =
          process.env[packageCase.rootOverride] ||
          path.dirname(require.resolve(packageCase.packageName));
        const target = path.join(caseRoot, packageCase.packageName);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.cpSync(source, target, { dereference: true, recursive: true });
        env[packageCase.rootOverride] = target;

        const patchFile = path.join(__dirname, '..', 'patches', packageCase.patchFile);
        setPatchState(target, patchFile, packageCase !== targetCase);
      }

      const hook = path.join(caseRoot, 'interrupt-write.cjs');
      const resultFile = path.join(caseRoot, 'reader.json');
      fs.writeFileSync(
        hook,
        `const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const originalWrite = fs.writeFileSync;
let interrupted = false;
fs.writeFileSync = function (file, content, options) {
  if (!interrupted && String(file).includes(${JSON.stringify(targetCase.artifact)})) {
    interrupted = true;
    const fd = fs.openSync(file, 'w');
    fs.writeSync(fd, content.slice(0, Math.floor(content.length / 2)));
    fs.closeSync(fd);
    const reader = spawnSync(process.execPath, [${JSON.stringify(script)}], {
      env: process.env, encoding: 'utf8', timeout: 10000,
    });
    originalWrite(${JSON.stringify(resultFile)}, JSON.stringify({
      status: reader.status, stderr: reader.stderr, error: reader.error?.message,
    }));
    return originalWrite(file, content, { ...options, flag: 'w' });
  }
  return originalWrite(file, content, options);
};
`,
      );

      const writer = spawnSync(process.execPath, ['--require', hook, script], {
        env,
        encoding: 'utf8',
        timeout: 20000,
      });
      assert.equal(writer.status, 0, writer.stderr);
      const reader = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      assert.equal(reader.status, 0, reader.stderr || reader.error);

      const repeat = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
      assert.equal(repeat.status, 0, repeat.stderr);
      assert.equal(repeat.stdout, '', `${targetCase.packageName} should already be patched`);
      for (const packageCase of patchCases) {
        const packageRoot = env[packageCase.rootOverride];
        assert.ok(!fs.readdirSync(packageRoot).some((name) => name.endsWith('.tmp')));
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
