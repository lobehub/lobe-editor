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

const files = fs.readdirSync(realSourceDir);

files.forEach((file) => {
  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    const sourceFile = path.join(realSourceDir, file);
    const targetFile = path.join(targetDir, file);

    if (fs.existsSync(targetFile)) {
      fs.copyFileSync(sourceFile, targetFile);
      console.log(`Overwrote ${file} in node_modules/lexical/`);
    }
  }
});
