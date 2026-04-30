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

  it('hydrates keepId editor data when the root has a non-numeric id and descendants omit ids', () => {
    const editor = createHeadlessEditor();
    const editorData = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Untitled document',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            tag: 'h1',
            type: 'heading',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        id: 'root',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as unknown as SerializedEditorState<SerializedLexicalNode>;

    editor.hydrateEditorData(editorData, { keepId: true });

    const snapshot = editor.export();

    expect(snapshot.editorData.root.children[0].type).toBe('heading');
    expect(snapshot.markdown).toBe('# Untitled document\n');
    editor.destroy();
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

  it('hydrates editor data with code blocks and horizontal rules', () => {
    const editor = createHeadlessEditor();
    const legacyEditorData = {
      root: {
        children: [
          {
            code: "console.log('hello');",
            codeTheme: 'default',
            id: '10',
            language: 'javascript',
            options: {
              indentWithTabs: false,
              lineNumbers: false,
              tabSize: 2,
            },
            type: 'code',
            version: 1,
          },
          {
            id: '11',
            type: 'horizontalrule',
            version: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                id: '13',
                mode: 'normal',
                style: '',
                text: 'After code',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            id: '12',
            indent: 0,
            tag: 'h2',
            type: 'heading',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as unknown as SerializedEditorState<SerializedLexicalNode>;

    editor.hydrateEditorData(legacyEditorData, { keepId: true });

    const { litexml, markdown } = editor.export({ litexml: true });

    expect(litexml).toContain('<code');
    expect(litexml).toContain('<hr');
    expect(litexml).toContain('<h2');
    expect(markdown).toContain("console.log('hello');");
    expect(markdown).toContain('After code');
    expect(markdown).not.toContain("console.log('hello');\n---");
    editor.destroy();
  });

  it('hydrates editor data with non-numeric legacy ids in keepId mode', () => {
    const editor = createHeadlessEditor();
    const legacyEditorData = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                id: 'title-text',
                mode: 'normal',
                style: '',
                text: 'Legacy title',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            id: 'title-node',
            indent: 0,
            tag: 'h1',
            type: 'heading',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        id: 'root',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as unknown as SerializedEditorState<SerializedLexicalNode>;

    expect(() => editor.hydrateEditorData(legacyEditorData, { keepId: true })).not.toThrow();

    const { litexml, markdown } = editor.export({ litexml: true });

    expect(markdown).toBe('# Legacy title\n');
    expect(litexml).toContain('<h1');
    expect(litexml).toContain('Legacy title');
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
