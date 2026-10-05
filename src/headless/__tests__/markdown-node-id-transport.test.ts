// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import { $getRoot, type LexicalNode } from 'lexical';

import { $getLogicalChildren } from '@/plugins/common/node/logical-children';
import { $getNodeId, $isNodeIdentityBlockTarget, $setNodeId } from '@/plugins/properties/utils';

import { HeadlessEditor } from '../index';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type MarkdownNodeIdEntry = { nodeId: string; path: number[] };
type SerializedNode = {
  $?: { properties?: { nodeId?: unknown } };
  children?: SerializedNode[];
  text?: string;
  type?: string;
};

const allNodes = (node: SerializedNode): SerializedNode[] => [
  node,
  ...(node.children ?? []).flatMap(allNodes),
];

const collectBlockNodeIds = (
  editor: HeadlessEditor,
): Array<{ id: string; path: number[]; type: string }> => {
  const result: Array<{ id: string; path: number[]; type: string }> = [];
  const lexicalEditor = editor.kernel.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected an initialized headless editor.');
  lexicalEditor.getEditorState().read(
    () => {
      const visit = (node: LexicalNode, path: number[]) => {
        if ($isNodeIdentityBlockTarget(node)) {
          const nodeId = $getNodeId(node);
          if (nodeId) result.push({ id: nodeId, path, type: node.getType() });
        }
        $getLogicalChildren(node).forEach((child, index) => visit(child, [...path, index]));
      };
      visit($getRoot(), []);
    },
    { editor: lexicalEditor },
  );
  return result;
};

const collectMarkdownNodeIdEntries = (markdown: string): MarkdownNodeIdEntry[] =>
  [...markdown.matchAll(/<!--\s*lobe-node-ids:([^\s]+)\s*-->/g)].flatMap((match) => {
    try {
      const entries = JSON.parse(decodeURIComponent(match[1])) as unknown;
      return Array.isArray(entries) ? (entries as MarkdownNodeIdEntry[]) : [];
    } catch {
      return [];
    }
  });

describe('Markdown durable node-id transport', () => {
  const editors: HeadlessEditor[] = [];

  afterEach(() => {
    while (editors.length > 0) editors.pop()?.destroy();
  });

  it('keeps list, quote, nested list, inline formatting, and table Markdown valid', async () => {
    const source = new HeadlessEditor();
    editors.push(source);
    source.hydrateMarkdown(
      '- **one**\n  - [nested](https://example.com)\n\n> quoted *text*\n\n| Name | Status |\n| --- | --- |\n| Table | **Ready** |',
    );
    await flush();

    const presentation = source.kernel.getDocument('markdown') as unknown as string;
    expect(presentation).not.toContain('lobe-node-id');
    expect(presentation).toContain('- **one**');
    expect(presentation).toContain('> quoted *text*');
    expect(presentation).toContain('| Name');
    expect(presentation).toContain('| Table');

    const transport = source.kernel.getDocument('markdown', {
      includeNodeIds: true,
    }) as unknown as string;
    expect(transport).toContain('<!-- lobe-node-id:');
    expect(transport).toContain('<!-- lobe-node-ids:');
    for (const line of transport.split('\n')) {
      if (/^\s*\|/.test(line)) expect(line).not.toContain('lobe-node-id');
      if (/^\s*>/.test(line)) expect(line).not.toContain('lobe-node-id');
    }

    const target = new HeadlessEditor();
    editors.push(target);
    target.hydrateMarkdown(transport);
    await flush();

    expect(collectBlockNodeIds(target)).toEqual(collectBlockNodeIds(source));
    const targetData = target.export().editorData;
    expect(JSON.stringify(targetData)).not.toContain('lobe-node-id');
    expect(target.export().markdown).not.toContain('lobe-node-id');
  });

  it('keeps following block IDs stable after adjacent same-format text fragments collapse', async () => {
    const source = new HeadlessEditor();
    editors.push(source);
    source.hydrateMarkdown(
      '- **HelloWorld** [Link](https://example.com)\n' + '  - Nested item\n\nFollowing paragraph',
    );
    await flush();

    const sourceLexical = source.kernel.getLexicalEditor()!;
    sourceLexical.update(() => {
      const boldText = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === 'HelloWorld');
      if (!boldText) throw new Error('Expected one formatted text fragment.');
      const [left, right] = boldText.splitText(5);
      if (!left || !right) throw new Error('Expected adjacent formatted text fragments.');
      $setNodeId(left, 'bold-fragment-left');
      $setNodeId(right, 'bold-fragment-right');
    });
    await flush();

    const expectedBlockIds = collectBlockNodeIds(source);
    const sourceData = source.export().editorData.root as unknown as SerializedNode;
    const sourceTextIds = allNodes(sourceData)
      .filter((node) => node.type === 'text' && ['Hello', 'World'].includes(node.text ?? ''))
      .map((node) => node.$?.properties?.nodeId);
    expect(sourceTextIds).toEqual(['bold-fragment-left', 'bold-fragment-right']);

    const transport = source.kernel.getDocument('markdown', {
      includeNodeIds: true,
    }) as unknown as string;
    expect(transport).toContain('**HelloWorld**');
    expect(transport).toContain('[Link](https://example.com)');
    expect(collectMarkdownNodeIdEntries(transport).map(({ nodeId }) => nodeId)).not.toContain(
      'bold-fragment-left',
    );
    expect(collectMarkdownNodeIdEntries(transport).map(({ nodeId }) => nodeId)).not.toContain(
      'bold-fragment-right',
    );
    const sourceLiteXML = source.export({ litexml: true }).litexml;
    expect(sourceLiteXML).toContain('id="bold-fragment-left"');
    expect(sourceLiteXML).toContain('id="bold-fragment-right"');

    const target = new HeadlessEditor();
    editors.push(target);
    target.hydrateMarkdown(transport);
    await flush();

    expect(target.export().markdown).toBe(source.export().markdown);
    expect(collectBlockNodeIds(target)).toEqual(expectedBlockIds);
  });

  it('keeps top-level code and table identities through transparent Hole transport', async () => {
    const source = new HeadlessEditor();
    editors.push(source);
    source.hydrateMarkdown(
      '| Name | Status |\n| --- | --- |\n| Table | **Ready** |\n\n```ts\nconst ready = true;\n```',
    );
    await flush();

    const transport = source.kernel.getDocument('markdown', {
      includeNodeIds: true,
    }) as unknown as string;
    expect(transport).toContain('<!-- lobe-node-id:');
    expect(transport).toContain('| Name');
    expect(transport).toContain('const ready = true;');

    const target = new HeadlessEditor();
    editors.push(target);
    target.hydrateMarkdown(transport);
    await flush();

    expect(
      collectBlockNodeIds(target).filter(({ type }) => type === 'code' || type === 'table'),
    ).toEqual(
      collectBlockNodeIds(source).filter(({ type }) => type === 'code' || type === 'table'),
    );
  });

  it('writes logical sidecar paths for code and table Holes nested in containers', async () => {
    const markdown =
      '> | Name | Status |\n> | --- | --- |\n> | Nested | **Ready** |\n\n- item\n\n  ```ts\n  const nested = true;\n  ```';
    const source = new HeadlessEditor();
    editors.push(source);
    source.hydrateMarkdown(markdown);
    await flush();

    const nestedSourceIds = collectBlockNodeIds(source).filter(
      ({ type }) => type === 'code' || type === 'table',
    );
    expect(nestedSourceIds.map(({ type }) => type)).toEqual(['table', 'code']);

    const transport = source.kernel.getDocument('markdown', {
      includeNodeIds: true,
    }) as unknown as string;
    const tableId = nestedSourceIds.find(({ type }) => type === 'table')?.id;
    const codeId = nestedSourceIds.find(({ type }) => type === 'code')?.id;
    expect(tableId).toBeDefined();
    expect(codeId).toBeDefined();

    expect(collectMarkdownNodeIdEntries(transport)).toEqual(
      expect.arrayContaining([
        { nodeId: tableId, path: [0] },
        { nodeId: codeId, path: [1, 0] },
      ]),
    );
  });
});
