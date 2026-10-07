// @vitest-environment node
import { $getNodeById, createHeadlessEditor, INodeIdentityService } from '@lobehub/editor/headless';
import { afterEach, describe, expect, it } from 'vitest';

type TestEditor = ReturnType<typeof createHeadlessEditor>;
type NodeData = {
  $?: { properties?: Record<string, unknown> };
  children?: NodeData[];
  id?: number | string;
  text?: string;
  type?: string;
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

function setSerializedId(node: NodeData, id: number | string, inState = true): void {
  node.id = id;
  if (inState) {
    node.$ = { ...node.$, properties: { ...node.$?.properties, nodeId: id } };
  } else if (node.$?.properties) {
    delete node.$.properties.nodeId;
  }
}

function allNodes(node: NodeData): NodeData[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}

function contentIds(editor: TestEditor): string[] {
  const root = editor.export().editorData.root as unknown as NodeData;
  return allNodes(root)
    .slice(1)
    .map((node) => node.$?.properties?.nodeId)
    .filter((id): id is string => typeof id === 'string');
}

function publicNode(
  editor: TestEditor,
  id: string,
): { key: string; text: string; type: string } | null {
  const lexical = editor.kernel.getLexicalEditor();
  if (!lexical) throw new Error('Expected a headless Lexical editor.');
  return lexical.getEditorState().read(
    () => {
      const node = $getNodeById(id);
      return node
        ? { key: node.getKey(), text: node.getTextContent(), type: node.getType() }
        : null;
    },
    { editor: lexical },
  );
}

function serviceNode(editor: TestEditor, id: string) {
  const service = editor.kernel.requireService(INodeIdentityService);
  if (!service) throw new Error('Expected the common node identity service.');
  return service.getNodeById(id);
}

const MIXED_DOCUMENT =
  '<root>' +
  '<p id="intro"><span id="intro-text">Original intro</span></p>' +
  '<p id="second"><span id="second-text">Original second</span></p>' +
  '<table id="grid" colWidths="200,200">' +
  '<tr id="row"><td id="cell-a"><p id="cell-p-a"><span id="cell-text-a">A</span></p></td>' +
  '<td id="cell-b"><p id="cell-p-b"><span id="cell-text-b">B</span></p></td></tr>' +
  '</table></root>';

const VALID_INTRO = '<p id="intro"><span>Changed intro</span></p>';
const INVALID_ROW = '<tr id="row"><td><p>Only one cell</p></td></tr>';

async function createMixedEditor(): Promise<TestEditor> {
  const editor = createEditor();
  editor.hydrateLiteXML(MIXED_DOCUMENT);
  // Let Lexical's initial trailing-paragraph normalization settle before snapshots.
  await editor.applyLiteXML([]);
  return editor;
}

describe('headless public identity edge cases', () => {
  it('repairs reserved and duplicate root content IDs in keepId JSON without mutating input', () => {
    const source = createEditor();
    source.hydrateMarkdown('Reserved one\n\nReserved two\n\nOpaque three');
    const input = structuredClone(source.export().editorData);
    const root = input.root as unknown as NodeData;
    const [reserved, padded, opaque] = root.children ?? [];
    if (!reserved || !padded || !opaque) throw new Error('Expected three paragraphs.');
    setSerializedId(reserved, 'root');
    setSerializedId(padded, ' root ');
    setSerializedId(opaque, 'opaque-paragraph');
    setSerializedId(reserved.children![0], 'opaque-text');
    setSerializedId(opaque.children![0], 42, false);
    const originalInput = structuredClone(input);

    const editor = createEditor();
    editor.hydrateEditorData(input, { keepId: true });

    expect(input).toEqual(originalInput);
    expect(editor.export().markdown).toContain('Reserved one');
    expect(editor.export().markdown).toContain('Reserved two');
    expect(editor.export().markdown).toContain('Opaque three');
    expect(publicNode(editor, 'root')).toBeNull();
    expect(serviceNode(editor, 'root')).toBeNull();
    expect(publicNode(editor, 'opaque-paragraph')?.text).toBe('Opaque three');
    expect(serviceNode(editor, 'opaque-text')?.textContent).toBe('Reserved one');
    expect(publicNode(editor, '42')?.text).toBe('Opaque three');

    const ids = contentIds(editor);
    expect(ids).not.toContain('root');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repairs LiteXML content and inserted IDs named root while retaining root anchors', async () => {
    const editor = createEditor();
    editor.hydrateLiteXML(
      '<root><p id="root"><span id="opaque-text">Original</span></p>' +
        '<p id="opaque-paragraph"><span>Tail</span></p></root>',
    );

    expect(editor.export().markdown).toContain('Original');
    expect(publicNode(editor, 'root')).toBeNull();
    expect(serviceNode(editor, 'root')).toBeNull();
    expect(publicNode(editor, 'opaque-paragraph')?.text).toBe('Tail');
    expect(serviceNode(editor, 'opaque-text')?.textContent).toBe('Original');

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'insert', afterId: 'root', litexml: '<p id="root">Appended</p>' },
      { action: 'insert', beforeId: 'root', litexml: '<p id=" root ">Prepended</p>' },
    ]);

    expect(results.map((result) => result.status)).toEqual(['applied', 'applied']);
    const markdown = editor.export().markdown;
    expect(markdown.indexOf('Prepended')).toBeLessThan(markdown.indexOf('Original'));
    expect(markdown.indexOf('Original')).toBeLessThan(markdown.indexOf('Tail'));
    expect(markdown.indexOf('Tail')).toBeLessThan(markdown.indexOf('Appended'));
    expect(publicNode(editor, 'root')).toBeNull();
    expect(serviceNode(editor, 'root')).toBeNull();
    const ids = contentIds(editor);
    expect(ids).not.toContain('root');
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const [name, fragments] of [
    ['valid paragraph first', [VALID_INTRO, INVALID_ROW]],
    ['invalid table row first', [INVALID_ROW, VALID_INTRO]],
  ] as const) {
    it(`rejects an entire mixed modify when the ${name}`, async () => {
      const editor = await createMixedEditor();
      const before = editor.export({ litexml: true });

      const failed = await editor.applyLiteXMLBatchWithResults([
        { action: 'modify', litexml: [...fragments] },
      ]);

      expect(failed).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
      expect(failed[0].reason).toBeTruthy();
      expect(editor.export({ litexml: true })).toEqual(before);
      expect(publicNode(editor, 'intro')?.text).toBe('Original intro');
      expect(serviceNode(editor, 'row')?.type).toBe('tablerow');

      const later = await editor.applyLiteXMLBatchWithResults([
        { action: 'modify', litexml: VALID_INTRO },
      ]);
      expect(later).toMatchObject([{ action: 'modify', index: 0, status: 'applied' }]);
      expect(editor.export().markdown).toContain('Changed intro');
      expect(publicNode(editor, 'intro')).not.toBeNull();
    });
  }

  it('continues later operations in a batch after one atomic modify fails', async () => {
    const editor = await createMixedEditor();
    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'modify', litexml: [VALID_INTRO, INVALID_ROW] },
      { action: 'modify', litexml: '<p id="second"><span>Later second</span></p>' },
    ]);

    expect(results.map((result) => result.status)).toEqual(['failed', 'applied']);
    expect(editor.export().markdown).toContain('Original intro');
    expect(editor.export().markdown).toContain('Later second');
    expect(editor.export().markdown).not.toContain('Changed intro');
  });

  it('applies every target of a valid multi-root modify', async () => {
    const editor = await createMixedEditor();
    const results = await editor.applyLiteXMLBatchWithResults([
      {
        action: 'modify',
        litexml: [
          '<root><p id="intro"><span>Changed intro</span></p></root>',
          '<root><p id="second"><span>Changed second</span></p></root>',
        ],
      },
    ]);

    expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'applied' }]);
    expect(editor.export().markdown).toContain('Changed intro');
    expect(editor.export().markdown).toContain('Changed second');
    expect(publicNode(editor, 'intro')).not.toBeNull();
    expect(publicNode(editor, 'second')).not.toBeNull();
  });

  it('applies two distinct inline sibling targets in one modify', async () => {
    const editor = createEditor();
    editor.hydrateLiteXML(
      '<root><p id="inline"><span id="first">Alpha </span>' +
        '<span id="second" bold="true">Beta</span></p></root>',
    );
    expect(publicNode(editor, 'first')).not.toBeNull();
    expect(publicNode(editor, 'second')).not.toBeNull();

    const results = await editor.applyLiteXMLBatchWithResults([
      {
        action: 'modify',
        litexml:
          '<root><span id="first">Changed </span>' +
          '<span id="second" bold="true">Words</span></root>',
      },
    ]);

    expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'applied' }]);
    expect(editor.export().markdown).toContain('Changed');
    expect(editor.export().markdown).toContain('Words');
  });

  for (const [name, fragment] of [
    ['missing target', '<p id="missing"><span>Missing target</span></p>'],
    ['malformed XML', '<p id="second"><span>Broken</li></p>'],
    ['unsupported row replacement', '<p id="row"><span>Wrong type</span></p>'],
  ] as const) {
    it(`leaves the entire modify unchanged when another fragment has a ${name}`, async () => {
      const editor = await createMixedEditor();
      const before = editor.export({ litexml: true });
      const results = await editor.applyLiteXMLBatchWithResults([
        { action: 'modify', litexml: [VALID_INTRO, fragment] },
      ]);

      expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
      expect(results[0].reason).toBeTruthy();
      expect(editor.export({ litexml: true })).toEqual(before);
    });
  }

  it('rejects an inline target replaced by a block without applying a valid sibling edit', async () => {
    const editor = await createMixedEditor();
    const before = editor.export({ litexml: true });
    const results = await editor.applyLiteXMLBatchWithResults([
      {
        action: 'modify',
        litexml: [
          '<p id="second"><span>Changed second</span></p>',
          '<p id="intro-text">Nested block</p>',
        ],
      },
    ]);

    expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
    expect(results[0].reason).toBeTruthy();
    expect(editor.export({ litexml: true })).toEqual(before);
    expect(publicNode(editor, 'intro-text')?.type).toBe('text');
    expect(publicNode(editor, 'second')?.text).toBe('Original second');
  });

  it('rejects a list item replaced by a root-level paragraph without applying a sibling edit', async () => {
    const editor = createEditor();
    editor.hydrateLiteXML('<root><p id="p">original</p><ul><li id="li">item</li></ul></root>');
    await editor.applyLiteXML([]);
    const before = editor.export({ litexml: true });

    const results = await editor.applyLiteXMLBatchWithResults([
      {
        action: 'modify',
        litexml: ['<p id="p">updated</p>', '<p id="li">wrong type</p>'],
      },
    ]);

    expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
    expect(results[0].reason).toBeTruthy();
    expect(editor.export({ litexml: true })).toEqual(before);
    expect(publicNode(editor, 'p')?.type).toBe('paragraph');
    expect(publicNode(editor, 'li')?.type).toBe('listitem');
    expect(editor.export({ litexml: true }).litexml).toContain('<li id="li">');
  });

  it('rejects a root-level paragraph replaced by a list item', async () => {
    const editor = createEditor();
    editor.hydrateLiteXML('<root><p id="p">original</p><ul><li id="li">item</li></ul></root>');
    await editor.applyLiteXML([]);
    const before = editor.export({ litexml: true });

    const results = await editor.applyLiteXMLBatchWithResults([
      { action: 'modify', litexml: '<li id="p">wrong type</li>' },
    ]);

    expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
    expect(results[0].reason).toBeTruthy();
    expect(editor.export({ litexml: true })).toEqual(before);
    expect(publicNode(editor, 'p')?.type).toBe('paragraph');
    expect(publicNode(editor, 'li')?.type).toBe('listitem');
  });

  for (const [name, fragments] of [
    ['repeated target', [VALID_INTRO, '<p id="intro"><span>Second version</span></p>']],
    ['ancestor then descendant', [VALID_INTRO, '<span id="intro-text">Inline</span>']],
    ['descendant then ancestor', ['<span id="intro-text">Inline</span>', VALID_INTRO]],
  ] as const) {
    it(`rejects the whole modify for a ${name}`, async () => {
      const editor = await createMixedEditor();
      const before = editor.export({ litexml: true });
      const results = await editor.applyLiteXMLBatchWithResults([
        { action: 'modify', litexml: [...fragments] },
      ]);

      expect(results).toMatchObject([{ action: 'modify', index: 0, status: 'failed' }]);
      expect(results[0].reason).toBeTruthy();
      expect(editor.export({ litexml: true })).toEqual(before);
    });
  }
});
