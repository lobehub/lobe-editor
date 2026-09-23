// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const builtHeadlessEntry = fileURLToPath(new URL('../../../es/headless.js', import.meta.url));

describe('headless package entry', () => {
  it('loads in a Node process without initializing the React runtime', async () => {
    const entry = await import('@lobehub/editor/headless');

    expect(entry.createHeadlessEditor).toBeTypeOf('function');
    expect(entry.CollaborativeAgentEditor).toBeTypeOf('function');
  });

  it.runIf(existsSync(builtHeadlessEntry))(
    'loads the built package entry without React or UI dependencies',
    () => {
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "await import('@lobehub/editor/headless'); console.log('headless package ok')",
        ],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(output).toContain('headless package ok');

      const builtSource = readFileSync(builtHeadlessEntry, 'utf8');
      expect(builtSource).not.toMatch(/@lobehub\/ui|createContext|useContext|react\/jsx|react-dom/);
    },
  );
});
