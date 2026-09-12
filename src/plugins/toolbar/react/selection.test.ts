import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $nodesOfType,
  $setSelection,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { INSERT_ARTIFACT_COMMAND } from '@/plugins/artifact/command';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import type { IEditor } from '@/types';

import { $shouldSuppressTextToolbar } from './selection';

describe('$shouldSuppressTextToolbar', () => {
  let editor: IEditor;

  beforeEach(async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
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
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main>toolbar</main>',
      title: 'Toolbar',
    });
    await moment();
  });

  it('suppresses Artifact/Hole node and cross-block range selections', () => {
    editor.getLexicalEditor()!.update(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      const hole = $nodesOfType(HoleNode)[0];
      if (!artifact || !hole) throw new Error('Artifact Hole missing');

      const artifactSelection = $createNodeSelection();
      artifactSelection.add(artifact.getKey());
      expect($shouldSuppressTextToolbar(artifactSelection)).toBe(true);

      const holeSelection = $createNodeSelection();
      holeSelection.add(hole.getKey());
      expect($shouldSuppressTextToolbar(holeSelection)).toBe(true);

      const before = $createParagraphNode().append($createTextNode('before'));
      const after = $createParagraphNode().append($createTextNode('after'));
      hole.insertBefore(before);
      hole.insertAfter(after);
      const range = $createRangeSelection();
      range.setTextNodeRange(before.getFirstChild()!, 0, after.getFirstChild()!, 5);
      expect($shouldSuppressTextToolbar(range)).toBe(true);

      const boundary = $createRangeSelection();
      const beforeCursor = hole.getBeforeCursor()!;
      boundary.setTextNodeRange(beforeCursor, 0, beforeCursor, 1);
      expect($shouldSuppressTextToolbar(boundary)).toBe(true);
    });
  });

  it('keeps ordinary text ranges eligible after selection leaves the Hole', () => {
    editor.getLexicalEditor()!.update(() => {
      const text = $createTextNode('ordinary text');
      const paragraph = $createParagraphNode().append(text);
      $nodesOfType(HoleNode)[0].insertBefore(paragraph);
      const range = $createRangeSelection();
      range.setTextNodeRange(text, 0, text, 8);
      $setSelection(range);
      expect($shouldSuppressTextToolbar(range)).toBe(false);
    });
  });
});
