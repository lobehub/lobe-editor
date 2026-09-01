import {
  $createNodeSelection,
  $createRangeSelection,
  $getRoot,
  $nodesOfType,
  $setSelection,
  REDO_COMMAND,
  resetRandomKey,
  UNDO_COMMAND,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_ARTIFACT_COMMAND } from '../command';
import { ArtifactNode } from '../node/ArtifactNode';
import { ArtifactPlugin } from '../plugin';
import { $isHoleNode, HoleNode } from '@/plugins/common/node/hole';

const html = '<main><h1>Hello</h1><style>h1 { color: red; }</style></main>';

const legacyArtifactDocument = {
  root: {
    children: [
      {
        html,
        title: 'Legacy',
        type: 'artifact',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

describe('ArtifactPlugin', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ArtifactPlugin]);
    editor.initNodeEditor();
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [],
            direction: null,
            format: '',
            indent: 0,
            textFormat: 0,
            textStyle: '',
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
  });

  it('inserts and reloads an artifact through JSON', async () => {
    expect(editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' })).toBe(true);
    await moment();

    const json = editor.getDocument('json') as any;
    expect(json.root.children[0]).toMatchObject({
      html,
      title: 'Demo',
      type: 'artifact',
    });
    expect(JSON.stringify(json)).not.toContain('"hole"');
    expect(JSON.stringify(json)).not.toContain('"cursor"');
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect(
          $nodesOfType(HoleNode)[0]
            .getChildren()
            .map((child) => child.getType()),
        ).toEqual(['cursor', 'artifact', 'cursor']);
      });

    editor.setDocument('json', json, { keepId: true });
    await moment();
    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html,
      title: 'Demo',
      type: 'artifact',
    });
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
      });
  });

  it('wraps legacy JSON artifacts once and keeps the artifact key stable', async () => {
    editor.setDocument('json', legacyArtifactDocument);
    await moment();

    const first = editor.getDocument('json') as any;
    expect(first.root.children[0].type).toBe('artifact');
    const artifactKey = first.root.children[0].id;
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
      });

    editor.setDocument('json', first, { keepId: true });
    await moment();

    const second = editor.getDocument('json') as any;
    expect(second.root.children).toHaveLength(1);
    expect(second.root.children[0].type).toBe('artifact');
    expect(second.root.children[0].id).toBe(artifactKey);
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect($nodesOfType(HoleNode)[0].getChildren()).toHaveLength(3);
      });
  });

  it('repairs a partially persisted Hole without duplicating its boundary cursors', async () => {
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                html,
                title: 'Hole payload',
                type: 'artifact',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'hole',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    await moment();

    const json = editor.getDocument('json') as any;
    expect(json.root.children[0].type).toBe('artifact');
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect(
          $nodesOfType(HoleNode)[0]
            .getChildren()
            .map((child) => child.getType()),
        ).toEqual(['cursor', 'artifact', 'cursor']);
      });
  });

  it('creates paragraphs above and below a Hole boundary cursor', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getBeforeCursor();
      if (!hole || !cursor) throw new Error('Hole boundary cursor missing');
      cursor.setTextContent('\uFEFFbefore');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    });
    await moment();
    await moment();

    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Hole boundary cursor missing');
      cursor.setTextContent('\uFEFFafter');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    });
    await moment();
    await moment();

    lexicalEditor.getEditorState().read(() => {
      const rootChildren = $getRoot().getChildren();
      expect(rootChildren.map((child) => child.getType())).toEqual([
        'paragraph',
        'hole',
        'paragraph',
      ]);
      expect(rootChildren[0].getTextContent()).toBe('before');
      expect(rootChildren[2].getTextContent()).toBe('after');
      const hole = rootChildren[1];
      if (!$isHoleNode(hole)) throw new Error('Expected Hole node');
      expect(hole.getChildren().map((child) => child.getType())).toEqual([
        'cursor',
        'artifact',
        'cursor',
      ]);
      expect(hole.getBeforeCursor()?.getTextContent()).toBe('\uFEFF');
      expect(hole.getAfterCursor()?.getTextContent()).toBe('\uFEFF');
      expect(hole.getTextContent()).toBe('\n');
    });
  });

  it('projects runtime Hole boundaries out of selection JSON', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Selected' });
    await moment();

    editor.getLexicalEditor()!.update(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      if (!artifact) throw new Error('Artifact missing');
      const selection = $createNodeSelection();
      selection.add(artifact.getKey());
      $setSelection(selection);
    });
    await moment();

    const selected = editor.getSelectionDocument('json') as any[];
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ html, title: 'Selected', type: 'artifact' });
    expect(JSON.stringify(selected)).not.toContain('"hole"');
    expect(JSON.stringify(selected)).not.toContain('"cursor"');
  });

  it('does not materialize a boundary cursor while readonly', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();
    editor.setEditable(false);

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getBeforeCursor();
      if (!cursor) throw new Error('Hole boundary cursor missing');
      cursor.setTextContent('\uFEFFreadonly');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    });
    await moment();
    await moment();

    lexicalEditor.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((child) => child.getType()),
      ).toEqual(['hole']);
      expect($nodesOfType(HoleNode)[0]?.getBeforeCursor()?.getTextContent()).toBe('\uFEFFreadonly');
    });
  });

  it('removes the Hole when its Artifact content is deleted and restores it with undo', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      $nodesOfType(ArtifactNode)[0]?.remove();
    });
    await moment();
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 600));

    lexicalEditor.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
    });

    lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(1);
      expect($nodesOfType(ArtifactNode)).toHaveLength(1);
    });

    lexicalEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    lexicalEditor.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
    });
  });

  it('keeps boundary paragraph insertion undoable and redoable as one operation', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getBeforeCursor();
      if (!cursor) throw new Error('Hole boundary cursor missing');
      cursor.setTextContent('\uFEFFundo me');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    });
    await moment();
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 600));

    lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();

    lexicalEditor.getEditorState().read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((child) => child.getType()),
      ).toEqual(['hole']);
    });

    lexicalEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();

    const redoJSON = editor.getDocument('json') as any;
    expect(redoJSON.root.children.map((child: any) => child.type)).toEqual([
      'paragraph',
      'artifact',
    ]);
    expect(redoJSON.root.children[0].children[0].text).toBe('undo me');
  });

  it('exposes immutable decorator snapshot values outside an editor read scope', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();

    const artifact = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0] ?? null);

    expect(artifact?.getHtml()).toBe(html);
    expect(artifact?.getTitle()).toBe('Demo');
  });

  it('round-trips artifact HTML through LiteXML', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();
    const xml = editor.getDocument('litexml') as unknown as string;

    expect(xml).toContain('<artifact');
    expect(xml).toContain('title="Demo"');
    expect(xml).toContain('&lt;main&gt;');

    editor.setDocument('litexml', xml);
    await moment();
    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html,
      title: 'Demo',
      type: 'artifact',
    });
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const hole = $nodesOfType(HoleNode)[0];
        const artifact = $nodesOfType(ArtifactNode)[0];
        expect(hole?.hasValidBoundaryCursors()).toBe(true);
        expect(hole?.getContentChildren()).toEqual([artifact]);
        expect(hole?.getKey()).not.toBe(artifact?.getKey());
      });
  });

  it('round-trips artifact HTML through a fenced Markdown block', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html, title: 'Demo' });
    await moment();
    const markdown = editor.getDocument('markdown') as unknown as string;

    expect(markdown).toContain('```artifact');
    expect(markdown).toContain(html);

    editor.setDocument('markdown', markdown);
    await moment();
    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html,
      title: 'Demo',
      type: 'artifact',
    });
  });

  it('keeps Markdown titles and source fences round-trippable', async () => {
    const source = '<script>const fence = ```;</script>';
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html: source, title: 'A Demo Title' });
    await moment();

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('````artifact title=A%20Demo%20Title');
    expect(markdown).toContain('````');

    editor.setDocument('markdown', markdown);
    await moment();
    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html: source,
      title: 'A Demo Title',
      type: 'artifact',
    });
  });

  it('preserves leading and trailing newlines in Markdown source', async () => {
    const source = '\n<main>line one</main>\n';
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html: source, title: 'Newlines' });
    await moment();

    const markdown = editor.getDocument('markdown') as unknown as string;
    editor.setDocument('markdown', markdown);
    await moment();

    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html: source,
      title: 'Newlines',
      type: 'artifact',
    });
  });

  it('preserves an empty Markdown title', async () => {
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, { html: '<main>untitled</main>', title: '' });
    await moment();

    const markdown = editor.getDocument('markdown') as unknown as string;
    editor.setDocument('markdown', markdown);
    await moment();

    expect((editor.getDocument('json') as any).root.children[0]).toMatchObject({
      html: '<main>untitled</main>',
      title: '',
      type: 'artifact',
    });
  });
});
