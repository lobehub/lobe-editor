// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import { HeadlessEditor } from '../index';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type SerializedNode = {
  $?: { properties?: { nodeId?: unknown } };
  children?: SerializedNode[];
  type?: string;
};

const collectNodeIds = (
  root: SerializedNode,
): Array<{ id: string; path: number[]; type?: string }> => {
  const result: Array<{ id: string; path: number[]; type?: string }> = [];
  const visit = (node: SerializedNode, path: number[]) => {
    const nodeId = node.$?.properties?.nodeId;
    if (typeof nodeId === 'string') result.push({ id: nodeId, path, type: node.type });
    node.children?.forEach((child, index) => visit(child, [...path, index]));
  };
  visit(root, []);
  return result;
};

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

    const sourceData = source.export().editorData.root as unknown as SerializedNode;
    const targetData = target.export().editorData.root as unknown as SerializedNode;
    expect(collectNodeIds(targetData)).toEqual(collectNodeIds(sourceData));
    expect(JSON.stringify(targetData)).not.toContain('lobe-node-id');
    expect(target.export().markdown).not.toContain('lobe-node-id');
  });
});
