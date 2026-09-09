const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.join(__dirname, 'postinstall-lexical-patch.cjs');

test('concurrent installers never observe partially written Lexical files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-patch-race-'));
  try {
    const env = { ...process.env };
    for (const [name, variable, patch] of [
      ['lexical', 'LOBE_EDITOR_LEXICAL_ROOT', 'lexical@0.42.0.patch'],
      ['@lexical/yjs', 'LOBE_EDITOR_LEXICAL_YJS_ROOT', '@lexical__yjs@0.42.0.patch'],
    ]) {
      const source = process.env[variable] || path.dirname(require.resolve(name));
      const target = path.join(root, name);
      fs.cpSync(source, target, { dereference: true, recursive: true });
      env[variable] = target;
      // Normal installs are already patched; also accept pristine package fixtures.
      const patchFile = path.join(__dirname, '..', 'patches', patch);
      const reverse = spawnSync('git', ['apply', '--reverse', '--check', patchFile], {
        cwd: target,
      });
      if (reverse.status === 0) {
        const result = spawnSync('git', ['apply', '--reverse', patchFile], { cwd: target });
        assert.equal(result.status, 0, result.stderr.toString());
      }
    }
    const hook = path.join(root, 'interrupt-write.cjs');
    const resultFile = path.join(root, 'reader.json');
    fs.writeFileSync(
      hook,
      `const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const originalWrite = fs.writeFileSync;
let interrupted = false;
fs.writeFileSync = function (file, content, options) {
  if (!interrupted && String(file).includes('Lexical.dev.js')) {
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
    // The intercepted write already created the file; finish that same write.
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
    assert.equal(repeat.stdout, '', 'Both dependencies should already be completely patched');
    for (const variable of ['LOBE_EDITOR_LEXICAL_ROOT', 'LOBE_EDITOR_LEXICAL_YJS_ROOT']) {
      assert.ok(!fs.readdirSync(env[variable]).some((name) => name.endsWith('.tmp')));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
