import { createHeadlessEditor } from '@lexical/headless';
import { $getRoot } from 'lexical';
import type { SerializedEditorState } from 'lexical';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { bench, describe } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';
import fixture from '../LexicalRenderer/demos/fixture.json';
import { renderNode } from '../engine/render-tree';
import { rendererNodes } from '../nodes';
import { createDefaultRenderers } from '../renderers';

const value = fixture as unknown as SerializedEditorState;

// Pre-build a larger fixture by repeating the content N times
function makeRepeatedFixture(times: number): SerializedEditorState {
  const children = (fixture as any).root.children;
  const repeated = [];
  for (let i = 0; i < times; i++) {
    repeated.push(...children);
  }
  return {
    root: { ...(fixture as any).root, children: repeated },
  } as SerializedEditorState;
}

const smallFixture = value;
const largeFixture = makeRepeatedFixture(10);

describe('LexicalRenderer — renderToString (small fixture)', () => {
  bench('LexicalRenderer', () => {
    renderToString(createElement(LexicalRenderer, { value: smallFixture }));
  });
});

describe('LexicalRenderer — renderToString (large fixture, 10x)', () => {
  bench('LexicalRenderer', () => {
    renderToString(createElement(LexicalRenderer, { value: largeFixture }));
  });
});

describe('Core engine — headless parse + tree walk (no React)', () => {
  const registry = createDefaultRenderers();

  bench('parse + render tree (small)', () => {
    const editor = createHeadlessEditor({
      editable: false,
      nodes: rendererNodes,
      onError: () => {},
    });
    const state = editor.parseEditorState(smallFixture);
    editor.setEditorState(state);
    const headingSlugs = new Map<string, number>();
    state.read(() => {
      $getRoot()
        .getChildren()
        .map((child, i) => renderNode(child, registry, headingSlugs, undefined, `r-${i}`));
    });
  });

  bench('parse + render tree (large 10x)', () => {
    const editor = createHeadlessEditor({
      editable: false,
      nodes: rendererNodes,
      onError: () => {},
    });
    const state = editor.parseEditorState(largeFixture);
    editor.setEditorState(state);
    const headingSlugs = new Map<string, number>();
    state.read(() => {
      $getRoot()
        .getChildren()
        .map((child, i) => renderNode(child, registry, headingSlugs, undefined, `r-${i}`));
    });
  });
});

describe('Breakdown — individual phases', () => {
  bench('1. createHeadlessEditor', () => {
    createHeadlessEditor({
      editable: false,
      nodes: rendererNodes,
      onError: () => {},
    });
  });

  bench('2. parseEditorState', () => {
    const editor = createHeadlessEditor({
      editable: false,
      nodes: rendererNodes,
      onError: () => {},
    });
    editor.parseEditorState(smallFixture);
  });

  bench('3. renderToString (React serialization)', () => {
    // Pre-built React tree, measure only React's serialization cost
    const el = createElement(
      'div',
      null,
      createElement('h1', null, 'Test'),
      createElement('p', null, 'Hello world'),
      createElement(
        'ul',
        null,
        createElement('li', null, 'item 1'),
        createElement('li', null, 'item 2'),
        createElement('li', null, 'item 3'),
      ),
    );
    renderToString(el);
  });
});
