#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PATCH_CONFIGS = [
  {
    displayName: 'Lexical',
    fileHashes: {
      'Lexical.dev.js': {
        patched: '040185c436ac5e005d602aef4c7caec3bad226d1001e49f7ab41092341062d03',
      },
      'Lexical.dev.mjs': {
        patched: '927edd6e8985942dda6c48b6529c1e65310ac610a40db1633f943230b4d5e85e',
      },
      'Lexical.prod.js': {
        patched: '01ab2486b22bb0f09c94b5e83ce6d4cbff78c869913d5e9da02a162249bbe92b',
      },
      'Lexical.prod.mjs': {
        patched: '53c1342a05753a78c6ac9272ae59e6129e1425a29a514775244e6f312cc80377',
      },
    },
    packageName: 'lexical',
    patchFile: path.join(PACKAGE_ROOT, 'patches', 'lexical@0.42.0.patch'),
    rootOverride: process.env.LOBE_EDITOR_LEXICAL_ROOT,
    supportedVersion: '0.42.0',
  },
  {
    displayName: 'Lexical Yjs',
    fileHashes: {
      'LexicalYjs.dev.js': {
        patched: '0c40721d2b2a6e91b54c34ad139d25dbdfed2e7ab2ecd04006da64117a0c24d4',
      },
      'LexicalYjs.dev.mjs': {
        patched: 'ae555880fcce31f97ceab37942079726b4f887068022386e958462ea8e4aef74',
      },
      'LexicalYjs.prod.js': {
        patched: '21e752d10bb9ec0684097ede5d963064cd945608613de84e60c680db97b6162d',
      },
      'LexicalYjs.prod.mjs': {
        patched: 'f541806c095bf0f674dabf5a34ea09a69fc044febe6f91434267b47674ab2c9e',
      },
    },
    packageName: '@lexical/yjs',
    patchFile: path.join(PACKAGE_ROOT, 'patches', '@lexical__yjs@0.42.0.patch'),
    rootOverride: process.env.LOBE_EDITOR_LEXICAL_YJS_ROOT,
    supportedVersion: '0.42.0',
  },
];

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeLineEndings(text) {
  return text.replaceAll(/\r\n?/g, '\n');
}

function detectLineEnding(text) {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/\n/g) || []).length - crlfCount;

  return crlfCount > lfCount ? '\r\n' : '\n';
}

function restoreLineEndings(text, lineEnding) {
  return lineEnding === '\r\n' ? text.replaceAll('\n', '\r\n') : text;
}

function getContentHashState(content, hashes) {
  const currentHash = sha256(content);
  const normalizedContent = normalizeLineEndings(content);
  const normalizedHash = normalizedContent === content ? currentHash : sha256(normalizedContent);

  if (normalizedHash === hashes.patched) {
    return { currentHash, normalizedContent, normalizedHash, status: 'patched' };
  }

  return { currentHash, normalizedContent, normalizedHash, status: 'needs-patch' };
}

function splitLines(text) {
  return normalizeLineEndings(text).split('\n');
}

function parsePatch(patchText) {
  const lines = splitLines(patchText);
  const patches = new Map();
  let currentFile = null;
  let currentHunk = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      currentFile = null;
      currentHunk = null;
      continue;
    }

    if (line.startsWith('+++ b/')) {
      const filename = line.slice('+++ b/'.length);
      currentFile = { filename, hunks: [] };
      patches.set(filename, currentFile);
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('@@ ')) {
      const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);

      if (!match) {
        throw new Error(`Invalid patch hunk header: ${line}`);
      }

      currentHunk = {
        lines: [],
        oldCount: match[2] ? Number(match[2]) : 1,
        oldStart: Number(match[1]),
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    if (
      line.startsWith(' ') ||
      line.startsWith('+') ||
      line.startsWith('-') ||
      line === '\\ No newline at end of file'
    ) {
      currentHunk.lines.push(line);
    }
  }

  return patches;
}

function applyPatchToContent(content, filePatch) {
  const source = splitLines(content);
  const output = [];
  let cursor = 0;

  for (const hunk of filePatch.hunks) {
    // Unified diffs use the line after the previous line for a zero-length
    // insertion (for example an append hunk at EOF). Non-empty hunks keep the
    // normal one-based start conversion.
    const targetIndex = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;

    output.push(...source.slice(cursor, targetIndex));

    let sourceIndex = targetIndex;

    for (const line of hunk.lines) {
      if (line === '\\ No newline at end of file') continue;

      const prefix = line[0];
      const body = line.slice(1);

      if (prefix === ' ') {
        if (source[sourceIndex] !== body) {
          throw new Error(`Patch context mismatch in ${filePatch.filename}`);
        }

        output.push(body);
        sourceIndex += 1;
        continue;
      }

      if (prefix === '-') {
        if (source[sourceIndex] !== body) {
          throw new Error(`Patch removal mismatch in ${filePatch.filename}`);
        }

        sourceIndex += 1;
        continue;
      }

      if (prefix === '+') {
        output.push(body);
        continue;
      }
    }

    cursor = sourceIndex;
  }

  output.push(...source.slice(cursor));

  return output.join('\n');
}

function resolvePackageRoot({ packageName, rootOverride }) {
  if (rootOverride) {
    return path.resolve(rootOverride);
  }

  const packageEntryPath = require.resolve(packageName, {
    paths: [PACKAGE_ROOT],
  });

  return path.dirname(packageEntryPath);
}

function patchPackage({ displayName, fileHashes, packageName, patchFile, ...config }) {
  const packageRoot = resolvePackageRoot({ packageName, ...config });
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

  if (packageJson.version !== config.supportedVersion) {
    console.warn(
      `[lobe-editor] Skip ${displayName} patch: expected ${config.supportedVersion}, found ${packageJson.version}.`,
    );
    return;
  }

  const patchText = fs.readFileSync(patchFile, 'utf8');
  const patches = parsePatch(patchText);
  const patchedFiles = [];

  for (const [filename, hashes] of Object.entries(fileHashes)) {
    const targetPath = path.join(packageRoot, filename);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`[lobe-editor] Missing ${displayName} file: ${targetPath}`);
    }

    const currentContent = fs.readFileSync(targetPath, 'utf8');
    const currentState = getContentHashState(currentContent, hashes);

    if (currentState.status === 'patched') {
      continue;
    }

    const filePatch = patches.get(filename);

    if (!filePatch) {
      throw new Error(`[lobe-editor] Missing patch entry for ${filename}`);
    }

    const patchedContent = applyPatchToContent(currentState.normalizedContent, filePatch);
    const patchedHash = sha256(patchedContent);

    if (patchedHash !== hashes.patched) {
      throw new Error(
        `[lobe-editor] Patched ${filename} hash mismatch: expected ${hashes.patched}, got ${patchedHash}.`,
      );
    }

    // Peer-dependent editor instances can patch the same dependency concurrently.
    // Publish a complete file so other patchers never read a partial write.
    const temporaryPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(
        temporaryPath,
        restoreLineEndings(patchedContent, detectLineEnding(currentContent)),
        { flag: 'wx', mode: fs.statSync(targetPath).mode },
      );
      fs.renameSync(temporaryPath, targetPath);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
    patchedFiles.push(filename);
  }

  if (patchedFiles.length > 0) {
    console.log(
      `[lobe-editor] Applied ${displayName} compatibility patch to ${patchedFiles.join(', ')}.`,
    );
  }
}

try {
  PATCH_CONFIGS.forEach(patchPackage);
} catch (error) {
  console.error(
    `[lobe-editor] Failed to patch Lexical dependencies automatically: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
