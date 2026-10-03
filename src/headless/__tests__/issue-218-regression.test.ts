// @vitest-environment node
import { $isListItemNode } from '@lexical/list';
import { createHeadlessEditor } from '@lobehub/editor/headless';
import { DiffAction, LITEXML_DIFFNODE_ALL_COMMAND } from '@/plugins/litexml/command/diffCommand';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

const LIST_MARKDOWN = '# T\n\nintro\n\n- a\n- b\n- c\n\ntail\n';
const TABLE_MARKDOWN = '| a | b | c |\n| --- | --- | --- |\n| x | y | z |';
const TABLE_LITERAL = 'D:\\lobechat\\{id}_search\\';

type TestEditor = ReturnType<typeof createHeadlessEditor>;
type NodeData = {
  children?: NodeData[];
  text?: string;
  type?: string;
  [key: string]: unknown;
};

const editors: TestEditor[] = [];

function createEditor(): TestEditor {
  const editor = createHeadlessEditor();
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

function elementIds(xml: string, tag: string): string[] {
  const openingTags = xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'));

  return [...openingTags]
    .map((match) => /\bid="([^"]+)"/.exec(match[1])?.[1])
    .filter((id): id is string => typeof id === 'string');
}

function elementId(xml: string, tag: string, containingText?: string): string {
  const openingTags = [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))];

  for (const match of openingTags) {
    const id = /\bid="([^"]+)"/.exec(match[1])?.[1];
    if (!id) continue;

    const closeTag = `</${tag}>`;
    const closeIndex = xml.indexOf(closeTag, match.index ?? 0);
    const elementXml = xml.slice(
      match.index ?? 0,
      closeIndex < 0 ? undefined : closeIndex + closeTag.length,
    );
    const elementText = elementXml.replace(/<[^>]+>/g, '');

    if (containingText === undefined || elementText.includes(containingText)) return id;
  }

  throw new Error(
    `Could not find <${tag}> with id and text ${JSON.stringify(containingText)} in LiteXML`,
  );
}

function allNodes(node: NodeData): NodeData[] {
  return [node, ...(node.children ?? []).flatMap((child) => allNodes(child))];
}

function hasExactText(editor: TestEditor, text: string): boolean {
  const root = editor.export().editorData.root as unknown as NodeData;
  return allNodes(root).some((node) => node.text === text);
}

function nodeTypes(editor: TestEditor): string[] {
  const root = editor.export().editorData.root as unknown as NodeData;
  return allNodes(root).flatMap((node) => (typeof node.type === 'string' ? [node.type] : []));
}

function markdownListItems(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)?.[1])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/<[^>]+>/g, '').trim());
}

function tableRowCellCounts(editor: TestEditor): number[] {
  const root = editor.export().editorData.root as unknown as NodeData;
  const table = allNodes(root).find((node) => node.type === 'table');

  return (table?.children ?? []).map((row) => row.children?.length ?? 0);
}

function runtimeListItemKey(editor: TestEditor, text: string): string {
  const lexicalEditor = editor.kernel.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected the headless kernel to expose its Lexical editor');

  return lexicalEditor.getEditorState().read(() => {
    const visit = (node: LexicalNode): string | null => {
      if ($isListItemNode(node) && node.getTextContent() === text) return node.getKey();
      if (!$isElementNode(node)) return null;

      for (const child of node.getChildren()) {
        const key = visit(child);
        if (key) return key;
      }
      return null;
    };

    const key = visit($getRoot());
    if (!key) throw new Error(`Could not find a list item with text ${JSON.stringify(text)}`);
    return key;
  });
}

function serializedPublicListItemId(editor: TestEditor, text: string): unknown {
  const root = editor.export().editorData.root as unknown as NodeData;
  const listItem = allNodes(root).find(
    (node) => node.type === 'listitem' && allNodes(node).some((child) => child.text === text),
  );
  const serializedState = listItem?.$;
  const properties =
    serializedState && typeof serializedState === 'object'
      ? (serializedState as Record<string, unknown>).properties
      : undefined;

  return properties && typeof properties === 'object'
    ? (properties as Record<string, unknown>).nodeId
    : undefined;
}

async function resolveDiff(editor: TestEditor, action: DiffAction): Promise<void> {
  editor.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action });
  // HeadlessEditor waits for its editor update to settle even when the operation list is empty.
  await editor.applyLiteXML([]);
}

const resolutions = [
  { action: DiffAction.Accept, name: 'accept', accepted: true },
  { action: DiffAction.Reject, name: 'reject', accepted: false },
] as const;

describe('LiteXML issue #218 headless regressions', () => {
  for (const placement of [
    { direction: 'after', anchor: 'a', expected: ['a', 'Added', 'b', 'c'] },
    { direction: 'before', anchor: 'c', expected: ['a', 'b', 'Added', 'c'] },
  ] as const) {
    for (const resolution of resolutions) {
      it(`serializes a delayed list insert ${placement.direction} its anchor and can ${resolution.name} it`, async () => {
        const editor = createEditor();
        editor.hydrateMarkdown(LIST_MARKDOWN);
        const before = editor.export({ litexml: true });
        const anchorId = elementId(before.litexml!, 'li', placement.anchor);

        const insertOperation =
          placement.direction === 'before'
            ? {
                action: 'insert' as const,
                beforeId: anchorId,
                delay: true,
                litexml: '<root><li><span>Added</span></li></root>',
              }
            : {
                action: 'insert' as const,
                afterId: anchorId,
                delay: true,
                litexml: '<root><li><span>Added</span></li></root>',
              };
        await editor.applyLiteXML(insertOperation);

        const pending = editor.export({ litexml: true });
        expect(markdownListItems(pending.markdown)).toEqual(placement.expected);
        expect(hasExactText(editor, 'Added')).toBe(true);
        expect(pending.markdown).not.toContain('```');

        await resolveDiff(editor, resolution.action);

        const expectedItems = resolution.accepted ? placement.expected : ['a', 'b', 'c'];
        expect(markdownListItems(editor.export().markdown)).toEqual(expectedItems);
      });
    }
  }

  for (const resolution of resolutions) {
    it(`keeps a delayed list removal reviewable with no empty exported bullet and can ${resolution.name} it`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown(LIST_MARKDOWN);
      const before = editor.export({ litexml: true });
      const removedId = elementId(before.litexml!, 'li', 'b');

      await editor.applyLiteXML({ action: 'remove', id: removedId, delay: true });

      const pending = editor.export();
      expect(nodeTypes(editor)).toContain('diff');
      expect(hasExactText(editor, 'b')).toBe(true);
      expect(pending.markdown).not.toMatch(/^\s*-\s*$/m);

      await resolveDiff(editor, resolution.action);

      expect(markdownListItems(editor.export().markdown)).toEqual(
        resolution.accepted ? ['a', 'c'] : ['a', 'b', 'c'],
      );
    });
  }

  for (const resolution of resolutions) {
    it(`keeps a whole-list delayed replacement as a Markdown list and can ${resolution.name} it`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown(LIST_MARKDOWN);
      const before = editor.export({ litexml: true });
      const listId = elementId(before.litexml!, 'ul');

      await editor.applyLiteXML({
        action: 'replace',
        delay: true,
        litexml: `<ul id="${listId}"><li><span>Replacement</span></li></ul>`,
      });

      const pending = editor.export();
      expect(pending.markdown).toContain('Replacement');
      expect(pending.markdown).not.toContain('```');
      expect(markdownListItems(pending.markdown)).toContain('Replacement');

      await resolveDiff(editor, resolution.action);

      expect(markdownListItems(editor.export().markdown)).toEqual(
        resolution.accepted ? ['Replacement'] : ['a', 'b', 'c'],
      );
    });

    it(`keeps a delayed inserted ul out of fenced code and can ${resolution.name} it`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown(LIST_MARKDOWN);
      const before = editor.export({ litexml: true });
      const introId = elementId(before.litexml!, 'p', 'intro');

      await editor.applyLiteXML({
        action: 'insert',
        afterId: introId,
        delay: true,
        litexml: '<root><ul><li><span>Inserted list</span></li></ul></root>',
      });

      const pending = editor.export();
      expect(pending.markdown).toContain('Inserted list');
      expect(pending.markdown).not.toContain('```');
      expect(markdownListItems(pending.markdown)).toContain('Inserted list');

      await resolveDiff(editor, resolution.action);

      const expectedItems = resolution.accepted
        ? ['Inserted list', 'a', 'b', 'c']
        : ['a', 'b', 'c'];
      expect(markdownListItems(editor.export().markdown)).toEqual(expectedItems);
    });
  }

  for (const delay of [false, true]) {
    it(`keeps a list item's public id durable across two ${delay ? 'delayed' : 'immediate'} replacements`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown('- one\n- two\n');
      const original = editor.export({ litexml: true });
      const originalId = elementId(original.litexml!, 'li', 'two');
      const originalRuntimeKey = delay ? undefined : runtimeListItemKey(editor, 'two');

      if (!delay) {
        expect(serializedPublicListItemId(editor, 'two')).toBe(originalId);
        expect(originalId).not.toBe(originalRuntimeKey);
      }

      await editor.applyLiteXML({
        action: 'replace',
        delay,
        litexml: `<li id="${originalId}"><span>two v2</span></li>`,
      });

      const afterFirst = editor.export({ litexml: true });
      const firstId = elementId(afterFirst.litexml!, 'li', 'two v2');
      expect(firstId).toBe(originalId);
      if (!delay) {
        expect(serializedPublicListItemId(editor, 'two v2')).toBe(originalId);
        expect(runtimeListItemKey(editor, 'two v2')).not.toBe(originalRuntimeKey);
      }

      await editor.applyLiteXML({
        action: 'replace',
        delay,
        litexml: `<li id="${firstId}"><span>two v3</span></li>`,
      });

      const afterSecond = editor.export({ litexml: true });
      expect(elementId(afterSecond.litexml!, 'li', 'two v3')).toBe(originalId);
      expect(afterSecond.markdown).toContain('two v3');
    });
  }

  it('applies two delayed replacements in one transaction to the same pending review side', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('Original body');
    const before = editor.export({ litexml: true });
    const textId = elementId(before.litexml!, 'span', 'Original body');

    await editor.applyLiteXML([
      { action: 'replace', delay: true, litexml: `<span id="${textId}">First draft</span>` },
      { action: 'replace', delay: true, litexml: `<span id="${textId}">Final draft</span>` },
    ]);

    expect(nodeTypes(editor).filter((type) => type === 'diff')).toHaveLength(1);
    expect(hasExactText(editor, 'Original body')).toBe(true);
    expect(hasExactText(editor, 'First draft')).toBe(false);
    expect(hasExactText(editor, 'Final draft')).toBe(true);

    await resolveDiff(editor, DiffAction.Accept);

    expect(editor.export().markdown).toBe('Final draft\n');
  });

  it('modifies a freshly inserted ID later in the same applyLiteXML transaction', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('Existing paragraph');
    const before = editor.export({ litexml: true });
    const anchorId = elementId(before.litexml!, 'p', 'Existing paragraph');
    const insertedId = 'issue-218-in-batch-insert';

    await editor.applyLiteXML([
      {
        action: 'insert',
        afterId: anchorId,
        delay: true,
        litexml: `<root><p id="${insertedId}"><span>First version</span></p></root>`,
      },
      {
        action: 'replace',
        delay: true,
        litexml: `<p id="${insertedId}"><span>Final version</span></p>`,
      },
    ]);

    expect(hasExactText(editor, 'First version')).toBe(false);
    expect(hasExactText(editor, 'Final version')).toBe(true);
    expect(nodeTypes(editor).filter((type) => type === 'diff')).toHaveLength(1);

    await resolveDiff(editor, DiffAction.Accept);

    expect(editor.export().markdown).toContain('Final version');
    expect(editor.export().markdown).not.toContain('First version');
  });

  it('carries a paragraph target forward after an earlier inline batch modification', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('Original paragraph');
    const before = editor.export({ litexml: true });
    const paragraphId = elementId(before.litexml!, 'p', 'Original paragraph');
    const textId = elementId(before.litexml!, 'span', 'Original paragraph');

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'modify', litexml: `<span id="${textId}">Inline update</span>` },
      {
        action: 'modify',
        litexml: `<p id="${paragraphId}"><span>Paragraph final</span></p>`,
      },
    ]);

    expect(results).toMatchObject([
      { index: 0, action: 'modify', status: 'applied' },
      { index: 1, action: 'modify', status: 'applied' },
    ]);
    expect(nodeTypes(editor).filter((type) => type === 'diff')).toHaveLength(1);
    expect(hasExactText(editor, 'Paragraph final')).toBe(true);
    expect(hasExactText(editor, 'Inline update')).toBe(false);

    await resolveDiff(editor, DiffAction.Accept);

    expect(editor.export().markdown).toBe('Paragraph final\n');
  });

  it('preserves caller-supplied LiteXML IDs verbatim on read and write', () => {
    const editor = createEditor();
    editor.hydrateLiteXML(
      '<root><p id="caller-paragraph-id"><span id="caller-text-id">Supplied</span></p></root>',
    );

    const { litexml } = editor.export({ litexml: true });
    expect(litexml).toContain('<p id="caller-paragraph-id">');
    expect(litexml).toContain('<span id="caller-text-id">Supplied</span>');
  });

  for (const direction of ['before', 'after'] as const) {
    it(`applies three ${direction}Id batch inserts in array order`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown(LIST_MARKDOWN);
      const before = editor.export({ litexml: true });
      const tailId = elementId(before.litexml!, 'p', 'tail');
      const operations = ['P1', 'P2', 'P3'].map((text) =>
        direction === 'before'
          ? { action: 'insert' as const, beforeId: tailId, litexml: `<p><span>${text}</span></p>` }
          : { action: 'insert' as const, afterId: tailId, litexml: `<p><span>${text}</span></p>` },
      );

      await editor.applyLiteXMLBatch(operations);

      const markdown = editor.export().markdown;
      const indexes = ['P1', 'P2', 'P3'].map((text) => markdown.indexOf(text));
      expect(indexes.every((index) => index >= 0)).toBe(true);
      expect(indexes[0]).toBeLessThan(indexes[1]);
      expect(indexes[1]).toBeLessThan(indexes[2]);
      if (direction === 'before') {
        expect(markdown.indexOf('P3')).toBeLessThan(markdown.indexOf('tail'));
      } else {
        expect(markdown.indexOf('P1')).toBeGreaterThan(markdown.indexOf('tail'));
      }
    });
  }

  it('uses the original afterId anchor when an earlier batch insertion is removed', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('Anchor paragraph');
    const before = editor.export({ litexml: true });
    const anchorId = elementId(before.litexml!, 'p', 'Anchor paragraph');

    const results = await editor.applyLiteXMLBatchWithResults([
      {
        action: 'insert',
        afterId: anchorId,
        litexml: '<root><p id="issue-218-temporary-insert"><span>Temporary</span></p></root>',
      },
      { action: 'remove', id: 'issue-218-temporary-insert' },
      { action: 'insert', afterId: anchorId, litexml: '<root><p><span>Survivor</span></p></root>' },
    ]);

    expect(results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied']);
    expect(editor.export().markdown).toContain('Survivor');
    expect(editor.export().markdown).not.toContain('Temporary');
  });

  it('keeps inline afterId batch inserts in order when a prior inserted span is removed', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('Anchor text');
    const before = editor.export({ litexml: true });
    const anchorId = elementId(before.litexml!, 'span', 'Anchor text');

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'insert', afterId: anchorId, litexml: '<span id="issue-218-inline-a">A</span>' },
      { action: 'insert', afterId: anchorId, litexml: '<span id="issue-218-inline-b">B</span>' },
      { action: 'remove', id: 'issue-218-inline-b' },
      { action: 'insert', afterId: anchorId, litexml: '<span id="issue-218-inline-c">C</span>' },
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    expect(editor.export().markdown).toContain('Anchor textAC');
    expect(editor.export().markdown).not.toContain('B');
  });

  it('reports unknown batch targets by operation and continues with later valid operations', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown(LIST_MARKDOWN);
    const before = editor.export({ litexml: true });
    const tailId = elementId(before.litexml!, 'p', 'tail');
    const missingId = 'issue-218-unknown-target';

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'modify', litexml: `<p id="${missingId}"><span>stale</span></p>` },
      { action: 'insert', afterId: missingId, litexml: '<p><span>orphan</span></p>' },
      { action: 'remove', id: missingId },
      { action: 'insert', afterId: tailId, litexml: '<p><span>valid</span></p>' },
    ]);

    expect(results).toMatchObject([
      { index: 0, action: 'modify', status: 'failed' },
      { index: 1, action: 'insert', status: 'failed' },
      { index: 2, action: 'remove', status: 'failed' },
      { index: 3, action: 'insert', status: 'applied' },
    ]);
    expect(results.slice(0, 3).every((result) => Boolean(result.reason))).toBe(true);
    expect(editor.export().markdown).toContain('valid');
    expect(editor.export().markdown).not.toContain('stale');
    expect(editor.export().markdown).not.toContain('orphan');
  });

  it('reports malformed batch LiteXML and continues with later valid operations', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown(LIST_MARKDOWN);
    const before = editor.export({ litexml: true });
    const tailId = elementId(before.litexml!, 'p', 'tail');

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'modify', litexml: '<p><span>broken</li></p>' },
      { action: 'insert', afterId: tailId, litexml: '<p><span>valid</span></p>' },
    ]);

    expect(results).toMatchObject([
      { index: 0, action: 'modify', status: 'failed' },
      { index: 1, action: 'insert', status: 'applied' },
    ]);
    expect(results[0].reason).toBeTruthy();
    expect(editor.export().markdown).toContain('valid');
    expect(editor.export().markdown).not.toContain('broken');
  });

  it('reports and skips a batch modify that would create an invalid nested table diff', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown('| A | B |\n| --- | --- |\n| Apple | 10 |');
    const before = editor.export({ litexml: true });
    const tableId = elementId(before.litexml!, 'table');
    const firstCellId = elementId(before.litexml!, 'td', 'Apple');

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'remove', id: firstCellId },
      {
        action: 'modify',
        litexml: `<table id="${tableId}"><tr><td><p>Changed</p></td><td><p>Still here</p></td></tr></table>`,
      },
    ]);

    expect(results).toMatchObject([
      { index: 0, action: 'remove', status: 'applied' },
      { index: 1, action: 'modify', status: 'failed' },
    ]);
    expect(results[1].reason).toBeTruthy();
    expect(hasExactText(editor, 'Changed')).toBe(false);
    expect(hasExactText(editor, 'Apple')).toBe(true);
  });

  it('keeps a table cell backslash literal through immediate edit and Markdown serialization/hydration', async () => {
    const editor = createEditor();
    editor.hydrateMarkdown(TABLE_MARKDOWN);
    const before = editor.export({ litexml: true });
    const cellSpanId = elementId(before.litexml!, 'span', 'y');

    await editor.applyLiteXML({
      action: 'replace',
      delay: false,
      litexml: `<span id="${cellSpanId}">${TABLE_LITERAL}</span>`,
    });

    const snapshot = editor.export({ litexml: true });
    expect(tableRowCellCounts(editor)).toEqual([3, 3]);
    expect(snapshot.litexml).toContain(TABLE_LITERAL);

    const markdownCopy = createEditor();
    markdownCopy.hydrateMarkdown(snapshot.markdown);
    expect(hasExactText(markdownCopy, TABLE_LITERAL)).toBe(true);
    expect(tableRowCellCounts(markdownCopy)).toEqual([3, 3]);
  });

  for (const resolution of resolutions) {
    it(`keeps a delayed table-cell literal across editor-data hydration and ${resolution.name}`, async () => {
      const editor = createEditor();
      editor.hydrateMarkdown(TABLE_MARKDOWN);
      const before = editor.export({ litexml: true });
      const cellSpanId = elementId(before.litexml!, 'span', 'y');

      await editor.applyLiteXML({
        action: 'replace',
        delay: true,
        litexml: `<span id="${cellSpanId}">${TABLE_LITERAL}</span>`,
      });

      const pending = editor.export();
      expect(tableRowCellCounts(editor)).toEqual([3, 3]);
      expect(hasExactText(editor, TABLE_LITERAL)).toBe(true);

      const markdownCopy = createEditor();
      markdownCopy.hydrateMarkdown(pending.markdown);
      expect(hasExactText(markdownCopy, TABLE_LITERAL)).toBe(true);
      expect(tableRowCellCounts(markdownCopy)).toEqual([3, 3]);

      const restored = createEditor();
      restored.hydrateEditorData(pending.editorData, { keepId: true });
      expect(tableRowCellCounts(restored)).toEqual([3, 3]);
      expect(hasExactText(restored, TABLE_LITERAL)).toBe(true);

      await resolveDiff(restored, resolution.action);

      expect(tableRowCellCounts(restored)).toEqual([3, 3]);
      if (resolution.accepted) {
        expect(hasExactText(restored, TABLE_LITERAL)).toBe(true);
        expect(hasExactText(restored, 'y')).toBe(false);
      } else {
        expect(hasExactText(restored, 'y')).toBe(true);
        expect(hasExactText(restored, TABLE_LITERAL)).toBe(false);
      }
    });
  }

  it('imports the same document into separate editors without cross-editor ID collisions', async () => {
    const source = createEditor();
    source.hydrateMarkdown(LIST_MARKDOWN);
    const sourceSnapshot = source.export({ litexml: true });
    const sourceIds = elementIds(sourceSnapshot.litexml!, 'li');
    const alphaId = elementId(sourceSnapshot.litexml!, 'li', 'a');
    const firstCopy = createEditor();
    const secondCopy = createEditor();
    const editorData = source.export().editorData;

    firstCopy.hydrateEditorData(editorData, { keepId: true });
    secondCopy.hydrateEditorData(editorData, { keepId: true });

    expect(elementIds(firstCopy.export({ litexml: true }).litexml!, 'li')).toEqual(sourceIds);
    expect(elementIds(secondCopy.export({ litexml: true }).litexml!, 'li')).toEqual(sourceIds);

    await firstCopy.applyLiteXML({
      action: 'replace',
      delay: false,
      litexml: `<li id="${alphaId}"><span>First copy</span></li>`,
    });
    await secondCopy.applyLiteXML({
      action: 'replace',
      delay: false,
      litexml: `<li id="${alphaId}"><span>Second copy</span></li>`,
    });

    expect(markdownListItems(firstCopy.export().markdown)).toEqual(['First copy', 'b', 'c']);
    expect(markdownListItems(secondCopy.export().markdown)).toEqual(['Second copy', 'b', 'c']);
    expect(markdownListItems(source.export().markdown)).toEqual(['a', 'b', 'c']);
  });

  it('assigns a fresh public ID when a document copy is hydrated without keepId', () => {
    const source = createEditor();
    source.hydrateMarkdown(LIST_MARKDOWN);
    const sourceXml = source.export({ litexml: true }).litexml!;
    const sourceIds = elementIds(sourceXml, 'li');
    const copy = createEditor();

    copy.hydrateEditorData(source.export().editorData, { keepId: false });

    const copyIds = elementIds(copy.export({ litexml: true }).litexml!, 'li');
    expect(copyIds).toHaveLength(sourceIds.length);
    expect(new Set(copyIds).size).toBe(copyIds.length);
    expect(copyIds).not.toEqual(sourceIds);
    expect(copyIds.every((id) => !sourceIds.includes(id))).toBe(true);
    expect(markdownListItems(copy.export().markdown)).toEqual(['a', 'b', 'c']);
  });
});
