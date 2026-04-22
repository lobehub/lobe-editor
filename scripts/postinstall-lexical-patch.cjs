#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PATCH_FILE = path.join(PACKAGE_ROOT, 'patches', 'lexical@0.42.0.patch');
const SUPPORTED_VERSION = '0.42.0';

const FILE_HASHES = {
  'Lexical.dev.js': {
    patched: '7c81a9785b397dc09ce0ecc9f3126d3e4903cdfd12d5c51318965ed74b0e3ccb',
  },
  'Lexical.dev.mjs': {
    patched: '880f22f2ec2d873e1699766de39edce5123b4730009bb88bb33d7e4da98a4ad9',
  },
  'Lexical.prod.js': {
    patched: '9f97867340b84853cf82bbd2d60ef9f944ee61ef058daa37007b820c2780a103',
  },
  'Lexical.prod.mjs': {
    patched: 'f7b2993582b2cc0573ca468373831b17971e0bb7383f5ca8785d4b93ab967c0b',
  },
};

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
    const targetIndex = hunk.oldStart - 1;

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

function resolveLexicalRoot() {
  const override = process.env.LOBE_EDITOR_LEXICAL_ROOT;

  if (override) {
    return path.resolve(override);
  }

  const lexicalEntryPath = require.resolve('lexical', {
    paths: [PACKAGE_ROOT],
  });

  return path.dirname(lexicalEntryPath);
}

function patchLexical() {
  const lexicalRoot = resolveLexicalRoot();
  const lexicalPackage = JSON.parse(
    fs.readFileSync(path.join(lexicalRoot, 'package.json'), 'utf8'),
  );

  if (lexicalPackage.version !== SUPPORTED_VERSION) {
    console.warn(
      `[lobe-editor] Skip Lexical patch: expected ${SUPPORTED_VERSION}, found ${lexicalPackage.version}.`,
    );
    return;
  }

  const patchText = fs.readFileSync(PATCH_FILE, 'utf8');
  const patches = parsePatch(patchText);
  const patchedFiles = [];

  for (const [filename, hashes] of Object.entries(FILE_HASHES)) {
    const targetPath = path.join(lexicalRoot, filename);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`[lobe-editor] Missing Lexical file: ${targetPath}`);
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

    fs.writeFileSync(
      targetPath,
      restoreLineEndings(patchedContent, detectLineEnding(currentContent)),
    );
    patchedFiles.push(filename);
  }

  if (patchedFiles.length > 0) {
    console.log(`[lobe-editor] Applied Lexical compatibility patch to ${patchedFiles.join(', ')}.`);
  }
}

try {
  patchLexical();
} catch (error) {
  console.error(
    `[lobe-editor] Failed to patch Lexical automatically: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
