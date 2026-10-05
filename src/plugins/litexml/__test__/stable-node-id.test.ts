import { describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $getNodeId, $findNodeById, PropertiesPlugin } from '@/plugins/properties';
import {
  DiffAction,
  LITEXML_APPLY_COMMAND,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';
import type { IEditor } from '@/types';
import { $getRoot } from 'lexical';

describe('LiteXML durable node IDs', () => {
  it('writes IDs from NodeState and resolves direct modify/remove/insert targets', async () => {
    const editor: IEditor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, PropertiesPlugin]);
    editor.initNodeEditor();
    editor.setDocument('markdown', 'First\n\nSecond');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const ids: string[] = [];
    lexical.getEditorState().read(() => {
      const children = lexical.getEditorState()._nodeMap;
      children.forEach((node) => {
        const nodeId = $getNodeId(node);
        if (nodeId && node.getType() === 'paragraph') ids.push(nodeId);
      });
    });
    expect(ids).toHaveLength(2);

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain(`id="${ids[0]}"`);
    expect(xml).not.toContain('id="ll63"');

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<p id="${ids[0]}"><span>Changed</span></p>`,
    });
    await moment();

    lexical.getEditorState().read(() => {
      const target = $findNodeById(ids[0]);
      expect(target?.getTextContent()).toBe('Changed');
      expect($getNodeId(target!)).toBe(ids[0]);
    });

    editor.dispatchCommand(LITEXML_INSERT_COMMAND, {
      afterId: ids[0],
      litexml: '<p><span>Inserted</span></p>',
    });
    await moment();
    expect(lexical.getEditorState().read(() => $getRoot().getTextContent())).toContain('Inserted');

    editor.dispatchCommand(LITEXML_REMOVE_COMMAND, { id: ids[0] });
    await moment();
    lexical.getEditorState().read(() => {
      expect($findNodeById(ids[0])).toBeNull();
    });
    editor.destroy();
  });

  it('keeps the target ID through a delayed diff and acceptance', async () => {
    const editor: IEditor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, PropertiesPlugin]);
    editor.initNodeEditor();
    editor.setDocument('markdown', 'Before');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const targetId = lexical.getEditorState().read(() => $getNodeId($getRoot().getFirstChild()!));
    expect(targetId).toBeTruthy();

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: `<p id="${targetId}"><span>After</span></p>`,
    });
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();

    lexical.getEditorState().read(() => {
      const target = $findNodeById(targetId!);
      expect(target?.getTextContent()).toBe('After');
      expect($getNodeId(target!)).toBe(targetId);
    });
    editor.destroy();
  });

  it('keeps a table cell ID through a delayed cell diff', async () => {
    const editor: IEditor = Editor.createEditor();
    editor.registerPlugins([
      LitexmlPlugin,
      MarkdownPlugin,
      CommonPlugin,
      TablePlugin,
      PropertiesPlugin,
    ]);
    editor.initNodeEditor();
    editor.setDocument('markdown', '| Before |\n| --- |');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const cellId = lexical.getEditorState().read(() => {
      const cell = [...lexical.getEditorState()._nodeMap.values()].find(
        (node) => node.getType() === 'tablecell',
      );
      return cell ? $getNodeId(cell) : undefined;
    });
    expect(cellId).toBeTruthy();

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: `<td id="${cellId}"><span>After</span></td>`,
    });
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();

    lexical.getEditorState().read(() => {
      const target = $findNodeById(cellId!);
      expect(target?.getTextContent()).toBe('After');
      expect($getNodeId(target!)).toBe(cellId);
    });
    editor.destroy();
  });
});
