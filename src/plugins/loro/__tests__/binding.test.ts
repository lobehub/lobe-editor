// @vitest-environment node
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $setSelection,
  $isRangeSelection,
  createEditor,
  ParagraphNode,
  type ElementNode,
  type TextNode,
} from 'lexical';
import { ArtifactNode, $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { HoleNode, $createHoleNode } from '@/plugins/common/node/hole';
import { CursorNode } from '@/plugins/common/node/cursor';
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from '@/plugins/hr/node/HorizontalRuleNode';
import {
  $createCodeHighlightNode,
  $createCodeNode,
  CodeHighlightNode,
  CodeNode,
} from '@lexical/code-core';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $createQuoteNode, QuoteNode } from '@lexical/rich-text';
import { $getNodeId, $getNodeProperties, $setNodeProperties } from '@/plugins/properties';
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import {
  createLoroCollaborationService,
  LORO_FORMAT_PREFIX,
  LoroCanonicalDocument,
  LoroLexicalBinding,
} from '../index';

const makeEditor = (nodes: ReadonlyArray<unknown> = [ParagraphNode]) =>
  createEditor({
    namespace: 'loro-binding-test',
    nodes: nodes as never,
    onError: (error) => {
      throw error;
    },
  });

const readText = (editor: ReturnType<typeof makeEditor>): string =>
  editor.getEditorState().read(() => $getRoot().getTextContent());

describe('LoroLexicalBinding', () => {
  it('does not bootstrap metadata while joining an empty existing room', async () => {
    const doc = new LoroCanonicalDocument(new LoroDoc(), undefined, { initialize: false });
    const versionBefore = doc.doc.version().toJSON();
    const editor = makeEditor();
    const binding = new LoroLexicalBinding({ doc, editor, shouldBootstrap: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc.meta.get('schemaVersion')).toBeUndefined();
    expect(doc.doc.version().toJSON()).toEqual(versionBefore);
    binding.dispose();
  });

  it('bootstraps a headless paragraph and projects a remote text update', async () => {
    const leftEditor = makeEditor([ParagraphNode, QuoteNode]);
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readText(leftEditor)).toBe('hello');
    expect(leftBinding.getReadiness()).toBe('ready');

    const snapshot = leftBinding.exportSnapshot();
    const rightEditor = makeEditor([ParagraphNode, QuoteNode]);
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readText(rightEditor)).toBe('hello');

    const version = leftDoc.doc.version();
    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode | null;
      (paragraph?.getFirstChild() as TextNode | null)?.setTextContent('hello world');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readText(rightEditor)).toBe('hello world');

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('keeps QuoteNode text in its fixed flow owner', async () => {
    const editor = makeEditor([ParagraphNode, QuoteNode]);
    editor.update(() => {
      $getRoot().append($createQuoteNode().append($createTextNode('quoted')));
    });
    const doc = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc, editor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const quote = doc.getNodes().find((node) => doc.readNode(node).type === 'quote');
    expect(quote && doc.readNode(quote).flow?.toString()).toBe('quoted');
    expect(readText(editor)).toBe('quoted');
    binding.dispose();
  });

  it('converges concurrent insert and format, then undoes only the local insert', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    leftBinding.undoManager.clear();

    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();
    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.undoManager.clear();

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode | null;
      (paragraph?.getFirstChild() as TextNode | null)?.setTextContent('hello left');
    });
    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode | null;
      const text = paragraph?.getFirstChild();
      (text as TextNode | null)?.setFormat('bold');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const leftUpdate = leftDoc.exportUpdate(baseVersion);
    const rightUpdate = rightDoc.exportUpdate(baseVersion);
    leftBinding.applyUpdate(rightUpdate);
    rightBinding.applyUpdate(leftUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readText(leftEditor)).toBe(readText(rightEditor));
    const leftDelta = leftDoc.readNode(leftDoc.getNodes()[0]).flow?.toDelta();
    const rightDelta = rightDoc.readNode(rightDoc.getNodes()[0]).flow?.toDelta();
    expect(leftDelta).toEqual(rightDelta);
    expect(leftDelta?.[0]).toMatchObject({
      attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true },
    });

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode | null;
      const text = paragraph?.getFirstChild();
      if (!text || !('getTextContentSize' in text)) return;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text as never, 2, text as never, 2);
      $setSelection(selection);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const selection = leftBinding.captureSelection();
    expect(selection?.anchor.flowNodeId).toBeTruthy();
    expect(selection?.anchor.encodedCursor.byteLength).toBeGreaterThan(0);
    expect(leftBinding.undo()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readText(leftEditor)).toContain('hello');

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('projects Hole payloads as logical nodes instead of dropping the target', async () => {
    const editor = makeEditor([ParagraphNode, ArtifactNode, HoleNode, CursorNode]);
    editor.update(() => {
      $getRoot().append($createHoleNode($createArtifactNode('<p>artifact</p>', 'A')));
    });
    const doc = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({
      capabilities: [
        {
          create: (data) => $createArtifactNode(String(data.body?.toString() ?? ''), 'A'),
          role: 'block-decorator',
          type: 'artifact',
        },
      ],
      doc,
      editor,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc.getNodes()).toHaveLength(1);
    expect(doc.readNode(doc.getNodes()[0]).type).toBe('artifact');
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('\n');
    binding.dispose();
  });

  it('keeps default HR/code/table/artifact Hole payloads in the logical CRDT tree', async () => {
    const editor = makeEditor([
      ParagraphNode,
      ArtifactNode,
      HoleNode,
      CursorNode,
      HorizontalRuleNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableRowNode,
      TableCellNode,
    ]);
    editor.update(() => {
      const table = $createTableNode().append(
        $createTableRowNode().append(
          $createTableCellNode().append($createParagraphNode().append($createTextNode('cell'))),
        ),
      );
      $getRoot().append(
        $createHoleNode($createHorizontalRuleNode()),
        $createHoleNode(
          $createCodeNode('javascript').append($createCodeHighlightNode('const x = 1;')),
        ),
        $createHoleNode(table),
        $createHoleNode($createArtifactNode('<main>artifact</main>', 'Artifact')),
      );
    });
    const doc = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc, editor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const types = doc.getNodes().map((node) => doc.readNode(node).type);
    expect(types.slice(0, 4)).toEqual(['horizontalrule', 'code', 'table', 'artifact']);
    expect(types).toEqual(expect.arrayContaining(['tablerow', 'tablecell', 'paragraph']));
    expect(types).not.toContain('hole');
    expect(types).not.toContain('cursor');
    expect(
      doc.getNodes().find((node) => doc.readNode(node).type === 'code') &&
        doc
          .readNode(doc.getNodes().find((node) => doc.readNode(node).type === 'code')!)
          .body?.toString(),
    ).toContain('const x');
    binding.dispose();
  });

  it('reuses the current peer NodeKey for same-parent reorder and cross-parent move', async () => {
    const leftEditor = makeEditor([ParagraphNode, QuoteNode]);
    let movedId = '';
    leftEditor.update(() => {
      const first = $createParagraphNode().append($createTextNode('first'));
      const moved = $createParagraphNode().append($createTextNode('moved'));
      const quote = $createQuoteNode();
      $getRoot().append(first, moved, quote);
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    movedId = leftDoc
      .getNodes()
      .map((node) => leftDoc.readNode(node))
      .find((node) => node.flow?.toString() === 'moved')!.nodeId!;
    const snapshot = leftBinding.exportSnapshot();
    const rightEditor = makeEditor([ParagraphNode, QuoteNode]);
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const before = rightEditor.getEditorState().read(() => {
      const node = rightEditor.getEditorState().read(() => {
        const root = $getRoot();
        return root.getChildren().find((child) => $getNodeId(child) === movedId)!;
      });
      return { key: node.getKey(), text: rootText(rightEditor, 'first') };
    });
    const reorderVersion = leftDoc.doc.version();
    leftEditor.update(() => {
      const root = $getRoot();
      root.append(root.getFirstChild()!);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(reorderVersion));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reordered = rightEditor.getEditorState().read(() => {
      const root = $getRoot();
      const moved = root.getChildren().find((child) => $getNodeId(child) === movedId)!;
      return { key: moved.getKey(), firstKey: rootText(rightEditor, 'first') };
    });
    expect(reordered.key).toBe(before.key);
    expect(reordered.firstKey).toBe(before.text);
    const version = leftDoc.doc.version();
    leftEditor.update(() => {
      const root = $getRoot();
      const children = root.getChildren();
      const moved = children.find((child) => $getNodeId(child) === movedId)!;
      const quote = children.find((child) => child.getType() === 'quote') as ElementNode;
      quote.append(moved);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const after = rightEditor.getEditorState().read(() => {
      const quote = $getRoot()
        .getChildren()
        .find((child) => child.getType() === 'quote')!;
      const moved = (quote as ElementNode).getChildren()[0];
      return { key: moved.getKey(), text: rootText(rightEditor, 'first') };
    });
    expect(after.key).toBe(before.key);
    expect(after.text).toBe(before.text);

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('rebases a local Lexical update made in the same tick as a remote import', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('hello left');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const leftUpdate = leftDoc.exportUpdate(baseVersion);

    // Queue the local update first. applyUpdate must flush this Lexical
    // transaction into Loro before admitting the remote bytes.
    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('hello right');
    });
    rightBinding.applyUpdate(leftUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rightUpdate = rightDoc.exportUpdate(baseVersion);
    leftBinding.applyUpdate(rightUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readText(leftEditor)).toBe(readText(rightEditor));
    expect(readText(leftEditor)).toContain('left');
    expect(readText(leftEditor)).toContain('right');

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('finishes controlled remote structure, format, body and attrs projection before applyUpdate returns', async () => {
    const leftEditor = makeEditor([ParagraphNode, ArtifactNode]);
    leftEditor.update(() => {
      $getRoot().append(
        $createParagraphNode().append($createTextNode('base')),
        $createArtifactNode('<old>artifact</old>', 'old'),
      );
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor([ParagraphNode, ArtifactNode]);
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      const root = $getRoot();
      const paragraph = root.getFirstChild() as ElementNode;
      const text = paragraph.getFirstChild() as TextNode;
      text.setTextContent('remote');
      text.setFormat('bold');
      const artifact = root
        .getChildren()
        .find((node) => node.getType() === 'artifact') as ArtifactNode;
      artifact.setHtml('<new>remote</new>').setTitle('remote title');
      root.append($createParagraphNode().append($createTextNode('remote paragraph')));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));
    const immediate = rightEditor.getEditorState().read(() => {
      const root = $getRoot();
      const paragraph = root.getFirstChild() as ElementNode;
      const text = paragraph.getFirstChild() as TextNode;
      const artifact = root
        .getChildren()
        .find((node) => node.getType() === 'artifact') as ArtifactNode;
      return {
        artifactHtml: artifact.getHtml(),
        artifactTitle: artifact.getTitle(),
        format: text.getFormat(),
        rootTexts: root.getChildren().map((node) => node.getTextContent()),
        text: text.getTextContent(),
      };
    });
    expect(immediate).toMatchObject({
      artifactHtml: '<new>remote</new>',
      artifactTitle: 'remote title',
      format: 1,
      text: 'remote',
    });
    expect(immediate.rootTexts).toContain('remote paragraph');

    rightEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('local paragraph')));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const finalTexts = rightEditor.getEditorState().read(() =>
      $getRoot()
        .getChildren()
        .map((node) => node.getTextContent()),
    );
    expect(finalTexts).toEqual(expect.arrayContaining(['remote paragraph', 'local paragraph']));

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('rejects raw external Loro import instead of silently projecting a stale editor', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('base')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(leftBinding.exportSnapshot()));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    const rightService = createLoroCollaborationService(rightBinding);
    await new Promise((resolve) => setTimeout(resolve, 0));
    leftEditor.update(() => {
      (($getRoot().getFirstChild() as ElementNode).getFirstChild() as TextNode).setTextContent(
        'remote',
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    rightDoc.doc.import(leftDoc.exportUpdate(baseVersion));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rightBinding.getPhase()).toBe('incompatible');
    expect(rightService.getReadiness()).toBe('incompatible');
    expect(readText(rightEditor)).toBe('base');
    const remoteVersion = rightDoc.doc.version().toJSON();
    rightEditor.update(() => {
      (($getRoot().getFirstChild() as ElementNode).getFirstChild() as TextNode).setTextContent(
        'stale local typing',
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rightBinding.getPhase()).toBe('incompatible');
    expect(rightDoc.doc.version().toJSON()).toEqual(remoteVersion);
    expect(rightDoc.readNode(rightDoc.getNodes()[0]).flow?.toString()).toBe('remote');

    leftBinding.dispose();
    rightService.dispose();
  });

  it('preserves paragraph split content and marks before publishing concurrent suffix edits', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('abcdef')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      const root = $getRoot();
      const paragraph = root.getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('abc');
      paragraph.insertAfter($createParagraphNode().append($createTextNode('def')));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      const text = paragraph.getFirstChild() as TextNode;
      text.setTextContent('abcdXef');
      text.setFormat('bold');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const leftUpdate = leftDoc.exportUpdate(baseVersion);
    const rightUpdate = rightDoc.exportUpdate(baseVersion);
    leftBinding.applyUpdate(rightUpdate);
    rightBinding.applyUpdate(leftUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const leftFlows = leftDoc.getNodes().map((node) => leftDoc.readNode(node).flow?.toString());
    const rightFlows = rightDoc.getNodes().map((node) => rightDoc.readNode(node).flow?.toString());
    expect(leftFlows).toEqual(['abcX', 'def']);
    expect(rightFlows).toEqual(leftFlows);
    expect(leftFlows.join('')).toBe('abcXdef');
    expect(rightFlows.join('')).toBe('abcXdef');
    expect(leftDoc.readNode(leftDoc.getNodes()[0]).flow?.toDelta()[0]).toMatchObject({
      attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true },
    });
    expect(leftDoc.readNode(leftDoc.getNodes()[1]).flow?.toDelta()).toEqual([{ insert: 'def' }]);
    expect(leftDoc.readNode(leftDoc.getNodes()[0]).flow?.toDelta()).toEqual(
      rightDoc.readNode(rightDoc.getNodes()[0]).flow?.toDelta(),
    );
    expect(leftDoc.readNode(leftDoc.getNodes()[1]).flow?.toDelta()).toEqual(
      rightDoc.readNode(rightDoc.getNodes()[1]).flow?.toDelta(),
    );

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('keeps the CRDT-backed caret when the active flow changes before it', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      const text = paragraph.getFirstChild() as TextNode;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text, 4, text, 4);
      $setSelection(selection);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = rightBinding.captureSelection();
    expect(before).not.toBeNull();

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('Xhello');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const after = rightBinding.captureSelection();
    expect(after?.anchor.flowNodeId).toBe(before?.anchor.flowNodeId);
    const afterOffset = rightEditor.getEditorState().read(() => {
      const selection = $getSelection();
      return $isRangeSelection(selection) ? selection.anchor.offset : -1;
    });
    expect(afterOffset).toBe(5);

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('restores a reverse selection across bold and plain leaves after a pre-import capture', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      const bold = $createTextNode('he').setFormat('bold');
      $getRoot().append($createParagraphNode().append(bold, $createTextNode('llo')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      const [bold, plain] = paragraph.getChildren() as [TextNode, TextNode];
      const selection = $createRangeSelection();
      selection.setTextNodeRange(plain, 3, bold, 1);
      $setSelection(selection);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rightBinding.captureSelection()?.backward).toBe(true);

    leftEditor.update(() => {
      const text = ($getRoot().getFirstChild() as ElementNode).getFirstChild() as TextNode;
      text.setTextContent('Xhe');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));

    const result = rightEditor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      const anchor = selection.anchor.getNode() as TextNode;
      const focus = selection.focus.getNode() as TextNode;
      return {
        anchorFormat: anchor.getFormat(),
        anchorOffset: selection.anchor.offset,
        anchorText: anchor.getTextContent(),
        backward: selection.isBackward(),
        focusFormat: focus.getFormat(),
        focusOffset: selection.focus.offset,
        focusText: focus.getTextContent(),
      };
    });
    expect(result).toMatchObject({
      anchorFormat: 0,
      anchorOffset: 3,
      anchorText: 'llo',
      backward: true,
      focusFormat: 1,
      focusOffset: 2,
      focusText: 'Xhe',
    });

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('keeps merge delete-wins deterministic when the removed suffix is edited and marked remotely', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append(
        $createParagraphNode().append($createTextNode('abc')),
        $createParagraphNode().append($createTextNode('def')),
      );
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const suffixId = rightDoc
      .getNodes()
      .map((node) => rightDoc.readNode(node))
      .find((node) => node.flow?.toString() === 'def')!.nodeId!;

    leftEditor.update(() => {
      const root = $getRoot();
      const children = root.getChildren();
      ((children[0] as ElementNode).getFirstChild() as TextNode).setTextContent('abcdef');
      children[1].remove();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightEditor.update(() => {
      const suffix = $getRoot().getChildren()[1] as ElementNode;
      const text = suffix.getFirstChild() as TextNode;
      text.setTextContent('deXf');
      text.setFormat('bold');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftBinding.applyUpdate(rightDoc.exportUpdate(baseVersion));
    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));

    const visibleFlows = (doc: LoroCanonicalDocument) =>
      doc.getNodes().map((node) => doc.readNode(node).flow?.toString());
    expect(visibleFlows(leftDoc)).toEqual(['abcdef']);
    expect(visibleFlows(rightDoc)).toEqual(['abcdef']);
    expect(readText(leftEditor)).toBe('abcdef');
    expect(readText(rightEditor)).toBe('abcdef');

    const deletedLeft = leftDoc
      .getNodes(true)
      .find((node) => leftDoc.readNodeId(node) === suffixId)!;
    const deletedRight = rightDoc
      .getNodes(true)
      .find((node) => rightDoc.readNodeId(node) === suffixId)!;
    expect(deletedLeft.isDeleted()).toBe(true);
    expect(deletedRight.isDeleted()).toBe(true);
    expect(leftDoc.readNode(deletedLeft).flow?.toString()).toBe('deXf');
    expect(rightDoc.readNode(deletedRight).flow?.toString()).toBe('deXf');
    expect(leftDoc.readNode(deletedLeft).flow?.toDelta()).toEqual(
      rightDoc.readNode(deletedRight).flow?.toDelta(),
    );
    expect(leftDoc.readNode(deletedLeft).flow?.toDelta()[0]).toMatchObject({
      attributes: { [`${LORO_FORMAT_PREFIX}bold`]: true },
    });

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('keeps a fixed flow owner container through empty initial input and clearing', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode());
    });
    const doc = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc, editor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.readNode(doc.getNodes()[0]).flow?.toString()).toBe('');
    editor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      paragraph.append($createTextNode('x'));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    editor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.readNode(doc.getNodes()[0]).flow?.toString()).toBe('');
    binding.dispose();
  });

  it('projects remote attrs and Properties map changes without a full tree rewrite', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('attrs')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const version = leftDoc.doc.version();
    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      paragraph.setDirection('rtl').setFormat('center').setIndent(2);
      const node = paragraph.getFirstChild()!;
      $setNodeProperties(node.getParent()!, { provenance: { source: 'ai', model: 'test' } });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(version));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const result = rightEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      return {
        direction: paragraph.getDirection(),
        format: paragraph.getFormatType(),
        indent: paragraph.getIndent(),
        properties: $getNodeProperties(paragraph),
      };
    });
    expect(result).toMatchObject({
      direction: 'rtl',
      format: 'center',
      indent: 2,
      properties: { provenance: { source: 'ai', model: 'test' } },
    });
    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('merges concurrent binding attrs and Properties fields from each peer cache', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      const paragraph = $createParagraphNode().append($createTextNode('merge attrs'));
      paragraph.setDirection('ltr').setIndent(2);
      $setNodeProperties(paragraph, { title: 'seed' });
      $getRoot().append(paragraph);
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      ($getRoot().getFirstChild() as ElementNode).setDirection('rtl');
    });
    rightEditor.update(() => {
      $setNodeProperties($getRoot().getFirstChild()!, { title: 'agent' });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const leftUpdate = leftDoc.exportUpdate(baseVersion);
    const rightUpdate = rightDoc.exportUpdate(baseVersion);
    leftBinding.applyUpdate(rightUpdate);
    rightBinding.applyUpdate(leftUpdate);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const readResult = (editor: ReturnType<typeof makeEditor>) =>
      editor.getEditorState().read(() => {
        const paragraph = $getRoot().getFirstChild() as ElementNode;
        return {
          direction: paragraph.getDirection(),
          indent: paragraph.getIndent(),
          properties: $getNodeProperties(paragraph),
        };
      });
    expect(readResult(leftEditor)).toMatchObject({
      direction: 'rtl',
      indent: 2,
      properties: { title: 'agent' },
    });
    expect(readResult(leftEditor)).toEqual(readResult(rightEditor));

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('projects table optional width and row-height fields on initial load, edits, and deletion', async () => {
    const leftEditor = makeEditor([ParagraphNode, TableNode, TableRowNode, TableCellNode]);
    leftEditor.update(() => {
      const cell = $createTableCellNode().append(
        $createParagraphNode().append($createTextNode('cell')),
      );
      const row = $createTableRowNode(40).append(cell);
      const table = $createTableNode().setColWidths([100]).append(row);
      cell.setWidth(120);
      $getRoot().append(table);
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor([ParagraphNode, TableNode, TableRowNode, TableCellNode]);
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const readTableFields = (editor: ReturnType<typeof makeEditor>) =>
      editor.getEditorState().read(() => {
        const table = $getRoot().getFirstChild() as TableNode;
        const row = table.getFirstChild() as TableRowNode;
        const cell = row.getFirstChild() as TableCellNode;
        return {
          cellWidth: cell.getWidth(),
          colWidths: table.getColWidths(),
          rowHeight: row.getHeight(),
        };
      });
    expect(readTableFields(rightEditor)).toMatchObject({
      cellWidth: 120,
      colWidths: [100],
      rowHeight: 40,
    });

    leftEditor.update(() => {
      const table = $getRoot().getFirstChild() as TableNode;
      const row = table.getFirstChild() as TableRowNode;
      const cell = row.getFirstChild() as TableCellNode;
      table.setColWidths(undefined);
      row.setHeight(undefined);
      cell.setWidth(undefined);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));
    expect(readTableFields(rightEditor)).toMatchObject({
      cellWidth: undefined,
      colWidths: undefined,
      rowHeight: undefined,
    });

    const nextVersion = leftDoc.doc.version();
    leftEditor.update(() => {
      const table = $getRoot().getFirstChild() as TableNode;
      const row = table.getFirstChild() as TableRowNode;
      const cell = row.getFirstChild() as TableCellNode;
      table.setColWidths([80]);
      row.setHeight(50);
      cell.setWidth(90);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(nextVersion));
    expect(readTableFields(rightEditor)).toMatchObject({
      cellWidth: 90,
      colWidths: [80],
      rowHeight: 50,
    });

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('does not resurrect remotely deleted Properties after a full-tree projection and local typing', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      const paragraph = $createParagraphNode().append($createTextNode('base'));
      $setNodeProperties(paragraph, {
        annotationIds: ['annotation-1'],
        nodeId: 'paragraph-property-delete',
        title: 'remote title',
      });
      $getRoot().append(paragraph);
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightDoc = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const rightBinding = new LoroLexicalBinding({ doc: rightDoc, editor: rightEditor });
    await new Promise((resolve) => setTimeout(resolve, 0));

    leftEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      const nodeId = $getNodeId(paragraph)!;
      $setNodeProperties(paragraph, { nodeId });
      $getRoot().append($createParagraphNode().append($createTextNode('tree change')));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rightBinding.applyUpdate(leftDoc.exportUpdate(baseVersion));

    const readProperties = (editor: ReturnType<typeof makeEditor>) =>
      editor.getEditorState().read(() => $getNodeProperties($getRoot().getFirstChild()!));
    expect(readProperties(rightEditor)).toEqual({ nodeId: 'paragraph-property-delete' });

    rightEditor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getFirstChild() as TextNode).setTextContent('typed');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const canonicalProperties = rightDoc
      .getNodes()
      .map((node) => rightDoc.readNode(node))
      .find((node) => node.nodeId === 'paragraph-property-delete')!.properties;
    expect(canonicalProperties).toEqual({ nodeId: 'paragraph-property-delete' });

    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('rejects an incoming unsupported node before changing the active Loro version', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('safe')));
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const snapshot = binding.exportSnapshot();
    const base = binding.canonical.doc.version();
    const rogue = LoroDoc.fromSnapshot(snapshot);
    const tree = rogue.getTree('lobe:lexical:v1');
    const node = tree.createNode();
    node.data.set('type', 'unknown-node');
    node.data.set('role', 'element');
    node.data.ensureMergeableMap('properties').set('nodeId', 'rogue-node');
    rogue.commit();
    const versionBefore = binding.canonical.doc.version().toJSON();
    expect(() =>
      binding.applyUpdate(rogue.export({ mode: 'update', from: base }), { trusted: false }),
    ).toThrow('No Loro capability registered');
    expect(binding.canonical.doc.version().toJSON()).toEqual(versionBefore);
    expect(readText(editor)).toBe('safe');
    binding.dispose();
  });

  it('does not emit a Loro transaction for a selection-only Lexical update', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('selection')));
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = binding.canonical.doc.version().toJSON();
    editor.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      const text = paragraph.getFirstChild() as TextNode;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text, 2, text, 2);
      $setSelection(selection);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(binding.canonical.doc.version().toJSON()).toEqual(before);
    binding.dispose();
  });
});

const rootText = (editor: ReturnType<typeof makeEditor>, text: string): string =>
  editor.getEditorState().read(
    () =>
      $getRoot()
        .getChildren()
        .find((node) => node.getTextContent() === text)
        ?.getKey() ?? '',
  );
