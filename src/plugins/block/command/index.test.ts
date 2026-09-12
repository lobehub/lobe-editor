import { $getRoot, $nodesOfType } from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactNode, ArtifactPlugin } from '@/plugins/artifact';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import type { IEditor } from '@/types';

import { BlockPlugin } from '../plugin';
import { MOVE_BLOCK_COMMAND } from './index';

const paragraph = (text: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      type: 'text',
      version: 1,
    },
  ],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
});

describe('MOVE_BLOCK_COMMAND Hole targeting', () => {
  let editor: IEditor;

  beforeEach(async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin, BlockPlugin]);
    editor.initNodeEditor();
    editor.setDocument('json', {
      root: {
        children: [
          paragraph('before'),
          {
            html: '<main>move me</main>',
            title: 'Move me',
            type: 'artifact',
            version: 1,
          },
          paragraph('after'),
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    await moment();
  });

  afterEach(() => editor.destroy());

  it('moves the structural Hole when the source id is its logical child', async () => {
    const lexical = editor.getLexicalEditor()!;
    const { artifactKey, targetKey } = lexical.getEditorState().read(() => ({
      artifactKey: $nodesOfType(ArtifactNode)[0].getKey(),
      targetKey: $getRoot().getLastChild()!.getKey(),
    }));

    expect(
      editor.dispatchCommand(MOVE_BLOCK_COMMAND, {
        placement: 'after',
        sourceBlockId: artifactKey,
        targetBlockId: targetKey,
      }),
    ).toBe(true);
    await moment();

    lexical.getEditorState().read(() => {
      expect($getRoot().getChildren().map((node) => node.getType())).toEqual([
        'paragraph',
        'paragraph',
        'hole',
      ]);
      const hole = $nodesOfType(HoleNode)[0];
      expect(hole.getChildren().map((node) => node.getType())).toEqual([
        'cursor',
        'artifact',
        'cursor',
      ]);
    });
  });
});
