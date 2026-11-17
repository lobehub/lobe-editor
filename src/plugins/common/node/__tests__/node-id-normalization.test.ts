import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $getNodeId, $setNodeId } from '@/plugins/common/node/node-id';
import {
  $getNodeIdentityPolicy,
  registerNodeIdentityPolicy,
} from '@/plugins/common/node/node-identity-policy';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

const editors: IEditor[] = [];

function createEditor(markdown: string): LexicalEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
  editor.initNodeEditor();
  editor.setDocument('markdown', markdown);
  editors.push(editor);
  return editor.getLexicalEditor()!;
}

const paragraphs = (count: number) =>
  Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}`).join('\n\n');

function readIds(lexical: LexicalEditor) {
  return lexical.getEditorState().read(
    () => {
      const ids: Array<string | undefined> = [];
      const visit = (node: LexicalNode) => {
        ids.push($getNodeId(node));
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      $getRoot().getChildren().forEach(visit);
      return ids;
    },
    { editor: lexical },
  );
}

function expectCompleteUniqueIds(lexical: LexicalEditor) {
  const ids = readIds(lexical);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
}

const appendParagraph = (lexical: LexicalEditor, text: string) =>
  lexical.update(
    () => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      $getRoot().append(paragraph);
    },
    { discrete: true },
  );

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('node ID normalization on update', () => {
  it('gives every line inserted one update at a time its own ID', () => {
    const lexical = createEditor('Start');
    for (let index = 0; index < 200; index++) appendParagraph(lexical, `Line ${index}`);

    expectCompleteUniqueIds(lexical);
    expect(readIds(lexical)).toHaveLength(1 + 1 + 200 * 2);
  });

  it('checks only the nodes an update created or wrote', () => {
    const lexical = createEditor(paragraphs(500));
    const base = lexical.getEditorState().read(() => $getNodeIdentityPolicy(), {
      editor: lexical,
    });
    let checks = 0;
    registerNodeIdentityPolicy(lexical, {
      ...base,
      isIdentityNode: (node) => {
        checks += 1;
        return base.isIdentityNode(node);
      },
    });
    // A policy change is a reason for one full pass.
    appendParagraph(lexical, 'after policy change');

    checks = 0;
    appendParagraph(lexical, 'one more line');

    // A full pass would visit all ~1,000 nodes (twice).
    expect(checks).toBeLessThan(50);
    expectCompleteUniqueIds(lexical);
  });

  it('repairs a duplicate left by an update that skipped transforms on the next update', () => {
    const lexical = createEditor(paragraphs(3));
    const [firstId] = readIds(lexical);

    lexical.update(
      () => {
        const copy = $createParagraphNode();
        copy.append($createTextNode('copy'));
        $setNodeId(copy, firstId!);
        $getRoot().append(copy);
      },
      { discrete: true, skipTransforms: true },
    );
    expect(readIds(lexical).filter((id) => id === firstId)).toHaveLength(2);

    appendParagraph(lexical, 'unrelated edit');

    expectCompleteUniqueIds(lexical);
    expect(readIds(lexical)[0]).toBe(firstId);
  });

  it('repairs a node rewritten by a skipTransforms update batched after it was checked', async () => {
    const lexical = createEditor(paragraphs(3));
    const [firstId] = readIds(lexical);

    // Both updates land in one commit; only the first runs transforms.
    lexical.update(() => {
      $getRoot().getLastChildOrThrow<ParagraphNode>().setFormat('center');
    });
    lexical.update(
      () => {
        $setNodeId($getRoot().getLastChildOrThrow(), firstId!);
      },
      { skipTransforms: true },
    );
    await Promise.resolve();
    expect(readIds(lexical).filter((id) => id === firstId)).toHaveLength(2);

    appendParagraph(lexical, 'unrelated edit');

    expectCompleteUniqueIds(lexical);
    expect(readIds(lexical)[0]).toBe(firstId);
  });
});
