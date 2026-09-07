// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { EditorState, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  resetRandomKey,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import { CommonPlugin } from '@/plugins/common';

import Editor from '../';

const COMPATIBILITY_DOC = 'docs/lexical-yjs-compatibility.md';
const SUPPORTED_ARTIFACTS = {
  '@lexical/yjs': {
    expectedVersion: '0.42.0',
    files: ['LexicalYjs.dev.js', 'LexicalYjs.dev.mjs', 'LexicalYjs.prod.js', 'LexicalYjs.prod.mjs'],
  },
  'lexical': {
    expectedVersion: '0.42.0',
    files: ['Lexical.dev.js', 'Lexical.dev.mjs', 'Lexical.prod.js', 'Lexical.prod.mjs'],
    requiredMarker: '__lexicalTextContent',
  },
} as const;

const resolvePackageRoot = (packageName: string): string => {
  const require = createRequire(import.meta.url);
  let current = dirname(require.resolve(packageName));
  while (!existsSync(join(current, 'package.json'))) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`Could not resolve ${packageName} package root.`);
    current = parent;
  }
  return current;
};

describe('installed Lexical compatibility contracts', () => {
  it.each(Object.entries(SUPPORTED_ARTIFACTS))(
    'guards %s supported version and CJS/ESM artifact layout',
    (packageName, config) => {
      const packageRoot = resolvePackageRoot(packageName);
      const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
        version?: string;
      };
      const reviewMessage = `Version/artifact mismatch for ${packageName}; review ${COMPATIBILITY_DOC} before upgrading or changing patches.`;
      expect(packageJson.version, reviewMessage).toBe(config.expectedVersion);

      for (const filename of config.files) {
        const artifactPath = join(packageRoot, filename);
        expect(existsSync(artifactPath), `${reviewMessage} Missing ${filename}.`).toBe(true);
        if ('requiredMarker' in config) {
          expect(
            readFileSync(artifactPath, 'utf8'),
            `${reviewMessage} Required compatibility marker is missing from ${filename}.`,
          ).toContain(config.requiredMarker);
        }
      }
    },
  );
});

describe('lexical patch regressions', () => {
  it.each(['dev', 'prod'] as const)('%s CJS/ESM artifacts keep patch behavior', (variant) => {
    for (const extension of ['js', 'mjs'] as const) {
      const require = createRequire(import.meta.url);
      const filename = join(dirname(require.resolve('lexical')), `Lexical.${variant}.${extension}`);
      const load =
        extension === 'js'
          ? `createRequire(import.meta.url)(${JSON.stringify(filename)})`
          : `await import(${JSON.stringify(pathToFileURL(filename).href)})`;
      // Exercise the real installed production modules in clean processes, not
      // the development export loaded by the rest of the suite.
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import assert from 'node:assert/strict';
      import {createRequire} from 'node:module';
      const lexical = ${load};
      let calls = 0;
      assert.equal(lexical.resetRandomKey(() => {calls++; return 17}), 17);
      assert.equal(calls, 1);
      let callbackState;
      const state = lexical.createEditor().parseEditorState({root:{type:'root',version:1,format:'',indent:0,direction:null,children:[]}}, value => {callbackState=value});
      assert.equal(callbackState, state);
    `,
        ],
        { stdio: 'pipe' },
      );
    }
  });
  beforeEach(() => {
    resetRandomKey();
  });

  it('should pass editorState to parseEditorState update callback', () => {
    let callbackState: (EditorState & { _nodeMap: Map<string, LexicalNode> }) | undefined;

    const parsedState = createEditor().parseEditorState(
      {
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
      (state) => {
        callbackState = state;
      },
    );

    expect(callbackState).toBe(parsedState);
    expect(callbackState).toBeDefined();
    expect(callbackState!._nodeMap.get('root')).toBeDefined();
  });

  it('should preserve imported ids and advance random key after keepId json import', () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    editor.setDocument(
      'json',
      {
        keepId: true,
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  id: '5',
                  mode: 'normal',
                  style: '',
                  text: 'first paragraph',
                  type: 'text',
                  version: 1,
                },
              ],
              direction: null,
              format: '',
              id: '4',
              indent: 0,
              textFormat: 0,
              textStyle: '',
              type: 'paragraph',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          id: 'root',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
      { keepId: true },
    );

    const imported = editor.getDocument('json') as any;

    expect(imported.root.children[0].id).toBe('4');
    expect(imported.root.children[0].children[0].id).toBe('5');

    const lexicalEditor = editor.getLexicalEditor();

    if (!lexicalEditor) {
      throw new Error('Editor not initialized');
    }

    lexicalEditor.update(() => {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('second paragraph');

      paragraph.append(text);
      root.append(paragraph);
    });

    const updated = editor.getDocument('json') as any;
    const appendedParagraph = updated.root.children[1];

    expect(appendedParagraph.id).toBe('6');
    expect(appendedParagraph.children[0].id).toBe('7');
  });
});
