/* eslint-disable unicorn/no-process-exit */
const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '../src/editor-kernel/lexical');
const esSourceDir = path.resolve(__dirname, '../es/editor-kernel/lexical');
const targetDir = path.resolve(__dirname, '../node_modules/lexical');

if (!fs.existsSync(targetDir)) {
  console.warn('node_modules/lexical not found, skipping patch.');
  process.exit(0);
}

const realSourceDir = fs.existsSync(esSourceDir) ? esSourceDir : sourceDir;

if (!fs.existsSync(realSourceDir)) {
  console.warn('No source directory found for lexical patch.');
  process.exit(0);
}

function copyToLexical(dir, target) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const sourceFile = path.join(dir, file);
    const targetFile = path.join(target, file);
    if (fs.statSync(sourceFile).isDirectory()) {
      copyToLexical(sourceFile, targetFile);
      return;
    }

    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, targetFile);
      console.log(`Overwrote ${file} in node_modules/lexical/`);
    }
  });
}

copyToLexical(realSourceDir, targetDir);
