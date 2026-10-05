import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $nodesOfType,
  KEY_ENTER_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { BlockPlugin } from '@/plugins/block/plugin';
import { SELECT_AFTER_CODEMIRROR_COMMAND } from '@/plugins/codemirror-block/command';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { CommonPlugin } from '@/plugins/common/plugin';
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from '@/plugins/hr/node/HorizontalRuleNode';
import { HRPlugin } from '@/plugins/hr/plugin';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { $getNodeId } from '@/plugins/properties/utils';

describe('Hole boundary DOM reconciliation', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let rootElement: HTMLDivElement | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    rootElement?.remove();
    rootElement = undefined;
  });

  it('keeps the paragraph and following HR outside the CodeMirror Hole in a mounted Lexical root', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      CodemirrorPlugin,
      HRPlugin,
      PropertiesPlugin,
      BlockPlugin,
    ]);
    rootElement = document.createElement('div');
    rootElement.contentEditable = 'true';
    document.body.append(rootElement);
    const lexical = editor.setRootElement(rootElement);

    const code = 'const acceptance = 203;';
    lexical.update(
      () => {
        $getRoot().append($createCodeMirrorNode('javascript', code));
      },
      { discrete: true },
    );
    await moment();

    const codeKey = lexical.getEditorState().read(() => $nodesOfType(CodeMirrorNode)[0]?.getKey());
    if (!codeKey) throw new Error('CodeMirror node missing');
    expect(lexical.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: codeKey })).toBe(true);
    await moment();

    const enter = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' });
    expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, enter)).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    await moment();

    const paragraphKey = lexical.getEditorState().read(() =>
      $getRoot()
        .getChildren()
        .find((node) => node.getType() === 'paragraph')
        ?.getKey(),
    );
    if (!paragraphKey) throw new Error('Enter did not create an outside paragraph');

    // Model the following block insertion while the Enter-created paragraph is
    // still the structural sibling after the CodeMirror Hole.
    lexical.update(
      () => {
        const paragraph = $getNodeByKey(paragraphKey);
        if (!$isElementNode(paragraph)) throw new Error('Enter-created paragraph disappeared');
        paragraph.append($createTextNode('following block'));
        paragraph.insertAfter($createHorizontalRuleNode());
      },
      { discrete: true },
    );
    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      const holes = $nodesOfType(HoleNode);
      const codeHole = holes.find((hole) =>
        hole.getContentChildren().some((node) => node instanceof CodeMirrorNode),
      );
      const hrHole = holes.find((hole) =>
        hole.getContentChildren().some((node) => node instanceof HorizontalRuleNode),
      );
      const paragraph = $getNodeByKey(paragraphKey);
      expect(children.map((node) => node.getType())).toEqual(['hole', 'paragraph', 'hole']);
      expect(codeHole).toBeDefined();
      expect(hrHole).toBeDefined();
      expect(paragraph?.getTextContent()).toBe('following block');

      const paragraphId = paragraph && $getNodeId(paragraph);
      expect(paragraphId).toBeTruthy();

      const paragraphElement = lexical.getElementByKey(paragraphKey);
      const codeHoleElement = codeHole && lexical.getElementByKey(codeHole.getKey());
      const hrHoleElement = hrHole && lexical.getElementByKey(hrHole.getKey());
      expect(paragraphElement?.parentElement).toBe(rootElement);
      expect(codeHoleElement?.parentElement).toBe(rootElement);
      expect(hrHoleElement?.parentElement).toBe(rootElement);
      expect(codeHoleElement?.contains(paragraphElement ?? null)).toBe(false);
      expect(codeHoleElement?.contains(hrHoleElement ?? null)).toBe(false);
      expect(paragraphElement?.getAttribute('data-node-id')).toBe(paragraphId);
      expect(rootElement?.contains(paragraphElement ?? null)).toBe(true);
    });
  });
});
