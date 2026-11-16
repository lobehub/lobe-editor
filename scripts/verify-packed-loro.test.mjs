import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { it } from 'vitest';

import {
  assertDefaultDeclarationsDoNotReferenceLoro,
  assertPackedPackageMetadata,
  assertSinglePropertiesState,
  findPropertiesStateDefinitions,
} from './verify-packed-loro.mjs';

const validPackedPackage = {
  name: '@lobehub/editor',
  peerDependencies: {
    'loro-crdt': '1.16.1',
  },
  peerDependenciesMeta: {
    'loro-crdt': {
      optional: true,
    },
  },
};

it('accepts the packed optional Loro peer contract', () => {
  assert.doesNotThrow(() => assertPackedPackageMetadata(validPackedPackage));
});

it('rejects a runtime Loro dependency in the packed contract', () => {
  assert.throws(() =>
    assertPackedPackageMetadata({
      ...validPackedPackage,
      dependencies: {
        'loro-crdt': '1.16.1',
      },
    }),
  );
});

it('finds exactly one shared properties StateConfig definition', () => {
  const files = new Map([
    ['plugins/properties/state.js', 'const state = createState("properties", {});'],
    ['plugins/loro/binding.js', 'import { propertiesState } from "../properties/state.js";'],
  ]);
  // The helper is exercised against a real temporary directory so path and file
  // traversal behavior match the packed-artifact check.
  const root = mkdtempSync(path.join(os.tmpdir(), 'packed-loro-unit-'));
  try {
    mkdirSync(path.join(root, 'plugins', 'properties'), { recursive: true });
    mkdirSync(path.join(root, 'plugins', 'loro'), { recursive: true });
    for (const [file, source] of files) {
      writeFileSync(path.join(root, file), source);
    }
    assert.deepEqual(findPropertiesStateDefinitions(root), [
      path.join(root, 'plugins/properties/state.js'),
    ]);
    assert.doesNotThrow(() => assertSinglePropertiesState(root));
    writeFileSync(
      path.join(root, 'plugins/loro/binding.js'),
      'const duplicate = createState("properties", {});',
    );
    assert.throws(
      () => assertSinglePropertiesState(root),
      /must define one properties StateConfig/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

function assertDeclarationLeakDetected(source) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'packed-loro-dts-unit-'));
  try {
    mkdirSync(path.join(root, 'es'), { recursive: true });
    writeFileSync(path.join(root, 'es', 'index.d.ts'), source);
    writeFileSync(path.join(root, 'es', 'react.d.ts'), 'export {};\n');
    writeFileSync(path.join(root, 'es', 'headless.d.ts'), 'export {};\n');
    writeFileSync(path.join(root, 'es', 'x.js'), 'export const safe = true;\n');
    writeFileSync(
      path.join(root, 'es', 'x.d.ts'),
      `import type { LoroDoc } from 'loro-crdt';
export type Leaked = LoroDoc;
`,
    );
    assert.throws(
      () => assertDefaultDeclarationsDoNotReferenceLoro(root),
      /default package declarations reference optional Loro/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

it('walks static declaration imports behind .js specifiers', () => {
  assertDeclarationLeakDetected(`import './x.js';
`);
});

it('walks import-type declaration references behind .js specifiers', () => {
  assertDeclarationLeakDetected(`type Leaked = import('./x.js').Leaked;
export type { Leaked };
`);
});
