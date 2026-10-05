import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  $getNodeByKey,
  $getRoot,
  $nodesOfType,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  resetRandomKey,
} from 'lexical';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactNode, ArtifactPlugin } from '@/plugins/artifact';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import {
  OPEN_ANNOTATION_COMPOSER_COMMAND,
  PropertiesPlugin,
  type OpenAnnotationComposerPayload,
} from '@/plugins/properties';
import type { IEditor } from '@/types';

import { BlockPlugin, getBlockClipboardData } from './index';
import { IBlockMenuService } from '../service';

describe('BlockPlugin annotation menu', () => {
  let blockElement: HTMLElement;
  let blockId: string;
  let editor: IEditor;
  let lexicalEditor: LexicalEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor().registerPlugins([CommonPlugin, PropertiesPlugin, BlockPlugin]);
    lexicalEditor = editor.initNodeEditor()!;
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Whole block comment',
                type: 'text',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
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
    blockId = lexicalEditor.read(() => $getRoot().getFirstChild()!.getKey());
    blockElement = document.createElement('p');
    blockElement.dataset.blockId = blockId;
    vi.spyOn(blockElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 400, 80));
  });

  it('places Comment below Copy and targets the whole block', () => {
    const service = editor.requireService(IBlockMenuService)!;
    const context = { blockElement, blockId, editor };
    const menus = service.getMenus(context);
    expect(menus.map((item) => item.key)).toEqual([
      '__block_default_select',
      '__block_default_copy',
      '__block_default_comment',
      '__block_default_delete',
    ]);

    let payload: OpenAnnotationComposerPayload | null = null;
    lexicalEditor.registerCommand(
      OPEN_ANNOTATION_COMPOSER_COMMAND,
      (nextPayload) => {
        payload = nextPayload;
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    menus.find((item) => item.key === '__block_default_comment')!.onClick(context);

    expect(payload).toMatchObject({
      kind: 'comment',
      nodeKeys: [blockId],
      payload: null,
      quotedText: 'Whole block comment',
      rect: expect.objectContaining({ height: 80, left: 20, top: 30, width: 400 }),
    });
  });

  it('does not expose Comment in a readonly editor', () => {
    editor.setEditable(false);
    const service = editor.requireService(IBlockMenuService)!;
    const menus = service.getMenus({ blockElement, blockId, editor });
    expect(menus.map((item) => item.key)).not.toContain('__block_default_comment');
  });

  it('targets the Hole child logically while retaining one structural DOM host', async () => {
    const holeEditor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      PropertiesPlugin,
      BlockPlugin,
    ]);
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.append(root);
    const holeLexical = holeEditor.setRootElement(root);
    holeEditor.setDocument('json', {
      root: {
        children: [
          {
            html: '<main>logical child</main>',
            title: 'Logical child',
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
    });
    await moment();

    const { artifactKey, holeKey } = holeLexical.read(() => ({
      artifactKey: $nodesOfType(ArtifactNode)[0].getKey(),
      holeKey: $nodesOfType(HoleNode)[0].getKey(),
    }));
    const host = root.querySelector<HTMLElement>(`[data-block-id="${artifactKey}"]`);
    if (!host) throw new Error('Hole block host missing');
    expect(root.querySelectorAll('[data-block-id]')).toHaveLength(1);
    expect(host.dataset.blockId).toBe(artifactKey);
    expect(host.dataset.blockStructuralId).toBe(holeKey);

    const service = holeEditor.requireService(IBlockMenuService)!;
    const context = { blockElement: host, blockId: artifactKey, editor: holeEditor };
    const menus = service.getMenus(context);
    let payload: OpenAnnotationComposerPayload | null = null;
    holeLexical.registerCommand(
      OPEN_ANNOTATION_COMPOSER_COMMAND,
      (nextPayload) => {
        payload = nextPayload;
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    menus.find((item) => item.key === '__block_default_comment')!.onClick(context);
    expect(payload).toMatchObject({
      nodeKeys: [artifactKey],
      quotedText: '\n',
    });

    const clipboard = holeLexical.read(() => {
      const artifact = $getNodeByKey(artifactKey);
      if (!artifact) throw new Error('Artifact missing');
      return getBlockClipboardData(artifact);
    });
    const lexicalPayload = JSON.parse(clipboard['application/x-lexical-editor'] || '{}');
    expect(lexicalPayload.nodes[0].type).toBe('hole');
    expect(lexicalPayload.nodes[0].children.map((child: any) => child.type)).toEqual([
      'cursor',
      'artifact',
      'cursor',
    ]);

    menus.find((item) => item.key === '__block_default_delete')!.onClick(context);
    await moment();
    holeLexical.getEditorState().read(() => {
      expect($nodesOfType(ArtifactNode)).toHaveLength(0);
      expect($nodesOfType(HoleNode)).toHaveLength(0);
    });

    holeEditor.destroy();
    root.remove();
  });
});
