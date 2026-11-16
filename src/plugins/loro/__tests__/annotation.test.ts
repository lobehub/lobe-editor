// @vitest-environment node
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  createEditor,
  ParagraphNode,
} from 'lexical';
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import type { AnnotationMap } from '@/plugins/properties/service/annotation';
import type { PropertiesAnnotationStorage } from '@/plugins/properties/service/properties';
import type { AnnotationRecord } from '@/plugins/properties/types';

import { LoroCanonicalDocument, LoroLexicalBinding } from '../index';

const record: AnnotationRecord = {
  createdAt: '2026-09-20T00:00:00.000Z',
  id: 'annotation-1',
  kind: 'comment',
  payload: { text: 'hello' },
  quotedText: 'hello',
  status: 'active',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

const makeEditor = () => {
  const editor = createEditor({
    namespace: 'loro-annotation-test',
    nodes: [ParagraphNode],
    onError: () => undefined,
  });
  editor.update(() => {
    $getRoot().append($createParagraphNode().append($createTextNode('hello')));
  });
  return editor;
};

const storage = () => {
  const state: { attached: AnnotationMap | null; detached: number } = {
    attached: null,
    detached: 0,
  };
  const port: PropertiesAnnotationStorage = {
    attachMap(map) {
      state.attached = map;
    },
    detachMap() {
      state.attached = null;
      state.detached += 1;
    },
  };
  return { port, state };
};

describe('Loro Properties collaboration port', () => {
  it('keeps annotation map writes outside正文 Undo and cleans remount observers', async () => {
    const doc = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc, editor: makeEditor() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    binding.undoManager.clear();

    const first = storage();
    const disposeFirst = binding.getPropertiesProvider().attachAnnotationStorage(first.port);
    const staleMap = first.state.attached!;
    first.state.attached?.set(record.id, record);
    expect(doc.doc.getMap('lobe:annotations').get(record.id)).toMatchObject({ id: record.id });
    expect(binding.undo()).toBe(false);
    expect(doc.doc.getMap('lobe:annotations').get(record.id)).toMatchObject({ id: record.id });

    binding.editor.update(() => {
      const paragraph = $getRoot().getFirstChild();
      const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
      if ($isTextNode(text)) text.setTextContent('hello!');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(binding.undo()).toBe(true);
    expect(binding.editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('hello');
    expect(doc.doc.getMap('lobe:annotations').get(record.id)).toMatchObject({ id: record.id });

    disposeFirst();
    expect(first.state.detached).toBe(1);
    binding.dispose();
    expect(first.state.detached).toBe(1);
    expect(() => staleMap.set('stale', record)).toThrow('disposed');
  });

  it('blocks annotation mutations after raw import incompatibility without changing the map or version', async () => {
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: makeEditor() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();
    const leftStorage = storage();
    const leftDisposer = leftBinding
      .getPropertiesProvider()
      .attachAnnotationStorage(leftStorage.port);
    leftStorage.state.attached?.set(record.id, record);
    const remoteUpdate = leftDoc.exportUpdate(baseVersion);

    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: makeEditor() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rightStorage = storage();
    const rightDisposer = rightBinding
      .getPropertiesProvider()
      .attachAnnotationStorage(rightStorage.port);
    const rightMap = rightStorage.state.attached!;

    rightDoc.doc.import(remoteUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rightBinding.getPhase()).toBe('incompatible');
    expect(rightMap.get(record.id)).toMatchObject({ id: record.id });
    const versionBeforeBlockedWrites = rightDoc.doc.version().toJSON();
    const snapshotBeforeBlockedWrites = Array.from(rightDoc.exportSnapshot());

    expect(() => rightMap.set('new', record)).toThrow('incompatible');
    expect(() => (rightMap.delete as (key: string) => boolean)(record.id)).toThrow('incompatible');
    expect(() => rightMap.clear()).toThrow('incompatible');
    expect(rightDoc.doc.version().toJSON()).toEqual(versionBeforeBlockedWrites);
    expect(Array.from(rightDoc.exportSnapshot())).toEqual(snapshotBeforeBlockedWrites);
    expect(rightMap.get(record.id)).toMatchObject({ id: record.id });

    rightBinding.dispose();
    expect(() => rightMap.set('after-dispose', record)).toThrow('disposed');

    rightDisposer();
    leftDisposer();
    leftBinding.dispose();
  });
});
