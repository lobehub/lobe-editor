import {
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactLiteXmlPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactVirtualBlockPlugin,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import type { SerializedEditorState } from 'lexical';
import { type ReactNode, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { bench, describe } from 'vitest';

import { LexicalRenderer } from '../LexicalRenderer';
import fixture from '../LexicalRenderer/demos/fixture.json';

const value = fixture as unknown as SerializedEditorState;

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

const editorPlugins = [
  ReactLiteXmlPlugin,
  ReactListPlugin,
  ReactLinkPlugin,
  ReactImagePlugin,
  ReactVirtualBlockPlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactTablePlugin,
  ReactMathPlugin,
  ReactCodePlugin,
  ReactFilePlugin,
];

function EditorReadonly({ content, plugins }: { content: any; plugins: any[] }) {
  const editor = useEditor();
  return createElement(Editor, { content, editable: false, editor, plugins });
}

function mount(element: ReactNode) {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(element);
  });
  root.unmount();
}

describe('Client render — small fixture', () => {
  bench('LexicalRenderer (headless)', () => {
    mount(createElement(LexicalRenderer, { value: smallFixture }));
  });

  bench('Editor (editable=false)', () => {
    mount(createElement(EditorReadonly, { content: smallFixture, plugins: editorPlugins }));
  });
});

describe('Client render — large fixture (10x)', () => {
  bench('LexicalRenderer (headless)', () => {
    mount(createElement(LexicalRenderer, { value: largeFixture }));
  });

  bench('Editor (editable=false)', () => {
    mount(createElement(EditorReadonly, { content: largeFixture, plugins: editorPlugins }));
  });
});
