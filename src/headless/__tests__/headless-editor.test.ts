// @vitest-environment node
import { createHeadlessEditor } from '@lobehub/editor/headless';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import { resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

function findTextNode(
  node: SerializedLexicalNode,
  text: string,
): (SerializedLexicalNode & { text: string }) | null {
  if ('text' in node && node.text === text) {
    return node as SerializedLexicalNode & { text: string };
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findTextNode(child, text);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function getXmlTextId(xml: string, text: string): string {
  const match = xml.match(new RegExp(`<span id="([^"]+)"[^>]*>${text}</span>`));
  expect(match).not.toBeNull();
  return match![1];
}

describe('HeadlessEditor', () => {
  beforeEach(() => {
    resetRandomKey();
  });

  it('hydrates Markdown into editor data and Markdown projection', () => {
    const editor = createHeadlessEditor();

    editor.hydrateMarkdown('# Alpha\n\n- First\n- Second');

    const { editorData, markdown } = editor.export();

    expect(markdown).toBe('# Alpha\n\n- First\n- Second\n');
    expect(editorData.root.children[0].type).toBe('heading');
    expect(editorData.root.children[1].type).toBe('list');
    expect(findTextNode(editorData.root, 'Alpha')).not.toBeNull();
    expect(findTextNode(editorData.root, 'Second')).not.toBeNull();
  });

  it('supports Markdown tables in headless mode', () => {
    const editor = createHeadlessEditor();

    editor.hydrateMarkdown('| Feature | Status |\n| --- | --- |\n| Table | Supported |');

    const { litexml, markdown } = editor.export({ litexml: true });

    expect(litexml).toContain('<table');
    expect(litexml).toContain('<td');
    expect(markdown).toContain('Feature');
    expect(markdown).toContain('Supported');
    editor.destroy();
  });

  it('hydrates JSON editor data without losing Markdown semantics', () => {
    const source = createHeadlessEditor();
    source.hydrateMarkdown('Plain **bold** text');
    const editorData = source.export().editorData;

    const target = createHeadlessEditor();
    target.hydrateEditorData(editorData);

    const snapshot = target.export();

    expect(snapshot.markdown).toBe('Plain **bold** text\n');
    expect(findTextNode(snapshot.editorData.root, 'bold')).not.toBeNull();
  });

  it('applies a LiteXML replace operation without a mounted editor', async () => {
    const editor = createHeadlessEditor();
    editor.hydrateMarkdown('# Original\n\nBody text');
    const before = editor.export({ litexml: true });
    const titleId = getXmlTextId(before.litexml!, 'Original');

    await editor.applyLiteXML({
      action: 'replace',
      litexml: `<span id="${titleId}">Updated</span>`,
    });

    const { editorData, markdown } = editor.export();

    expect(markdown).toBe('# Updated\n\nBody text\n');
    expect(findTextNode(editorData.root, 'Updated')).not.toBeNull();
    expect(findTextNode(editorData.root, 'Original')).toBeNull();
    expect(editor.kernel.getRootElement()).toBeNull();
  });

  it('exports synchronized editor data, Markdown, and optional LiteXML after mutation', async () => {
    const editor = createHeadlessEditor({
      initialValue: {
        content: '# Title\n\nBody',
        type: 'markdown',
      },
    });
    const before = editor.export({ litexml: true });
    const bodyId = getXmlTextId(before.litexml!, 'Body');

    await editor.applyLiteXML({
      action: 'replace',
      litexml: `<span id="${bodyId}" italic="true">Changed body</span>`,
    });

    const snapshot = editor.export({ litexml: true });
    const editorData = snapshot.editorData as SerializedEditorState<SerializedLexicalNode>;

    expect(snapshot.markdown).toBe('# Title\n\n*Changed body*\n');
    expect(snapshot.litexml).toContain('italic="true"');
    expect(findTextNode(editorData.root, 'Changed body')).not.toBeNull();
  });

  it('destroys a hydrated headless editor without throwing', () => {
    const editor = createHeadlessEditor({
      initialValue: {
        content: 'Disposable content',
        type: 'markdown',
      },
    });

    expect(() => editor.destroy()).not.toThrow();
  });
});
