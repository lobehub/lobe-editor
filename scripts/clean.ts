import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

rmSync(resolve(root, 'es'), { force: true, recursive: true });
