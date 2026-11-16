import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { expect, test } from 'vitest';

const projectRoot = process.cwd();
const fixture = path.join(projectRoot, 'scripts/table-observer-lifecycle-fixture.mjs');

test('TableObserver replacement lifecycle works in development/production CJS and ESM', () => {
  for (const nodeEnv of ['development', 'production']) {
    for (const moduleMode of ['require', 'import']) {
      const result = spawnSync(process.execPath, [fixture], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: nodeEnv,
          TABLE_MODULE_MODE: moduleMode,
        },
        timeout: 15_000,
      });
      expect(
        result.status,
        `${nodeEnv} ${moduleMode} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      ).toBe(0);
    }
  }
}, 30_000);
