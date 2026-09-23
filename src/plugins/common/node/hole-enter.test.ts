import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { HoleNode } from './hole';

const artifactSource = '<main>stable artifact</main>';
const codeSource = 'fn sentinel() {}';

const createEditor = async (): Promise<{
  editor: ReturnType<typeof Editor.createEditor>;
  lexical: LexicalEditor;
}> => {
  const editor = Editor.createEditor().registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    MarkdownPlugin,
    ArtifactPlugin,
    CodemirrorPlugin,
  ]);
  editor.initHeadlessEditor();
  editor.setDocument('markdown', 'before\n\nafter sentinel');
  const lexical = editor.getLexicalEditor()!;
  lexical.update(
    () => {
      const before = $getRoot().getFirstChild();
      if (!before || !$isElementNode(before)) throw new Error('before paragraph missing');
      const artifact = $createArtifactNode(artifactSource, 'Stable artifact');
      const code = $createCodeMirrorNode('rust', codeSource);
      before.insertAfter(artifact);
      artifact.insertAfter(code);
    },
    { discrete: true },
  );
  await moment();
  return { editor, lexical };
};

const rootTypes = (lexical: LexicalEditor): string[] =>
  lexical.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => node.getType()),
  );

const countType = (lexical: LexicalEditor, type: string): number =>
  lexical.getEditorState().read(() => {
    let count = 0;
    const visit = (node: LexicalNode): void => {
      if (node.getType() === type) count += 1;
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
    return count;
  });

const selectAfterBoundary = (lexical: LexicalEditor): void => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Artifact Hole after cursor missing');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), 0, 'text');
      selection.focus.set(cursor.getKey(), 0, 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const selectBeforeBoundary = (lexical: LexicalEditor): void => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getBeforeCursor();
      if (!hole || !cursor) throw new Error('Artifact Hole before cursor missing');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const selectRootPointAfterHole = (lexical: LexicalEditor): void => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole) throw new Error('Artifact Hole missing');
      const root = $getRoot();
      const selection = $createRangeSelection();
      const offset = hole.getIndexWithinParent() + 1;
      selection.anchor.set(root.getKey(), offset, 'element');
      selection.focus.set(root.getKey(), offset, 'element');
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const dispatchEnter = (lexical: LexicalEditor): void => {
  const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' });
  expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
};

describe('Hole Enter boundaries', () => {
  it('inserts one paragraph between an Artifact Hole and the following Code block', async () => {
    const { editor, lexical } = await createEditor();
    selectAfterBoundary(lexical);
    dispatchEnter(lexical);
    await moment();

    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'paragraph', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    const selectedNodeType = lexical.getEditorState().read(() => {
      const selection = $getSelection();
      return $isRangeSelection(selection) ? selection.anchor.getNode().getType() : null;
    });
    expect(selectedNodeType).toBe('paragraph');

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    lexical.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'paragraph', 'hole', 'paragraph']);
    editor.destroy();
  });

  it('handles a root element point immediately after the Artifact Hole without appending at root end', async () => {
    const { editor, lexical } = await createEditor();
    selectRootPointAfterHole(lexical);
    dispatchEnter(lexical);
    await moment();

    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'paragraph', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    const insertedAndCode = lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      const codePayload =
        children[3] instanceof HoleNode ? children[3].getContentChildren()[0] : undefined;
      return {
        insertedType: children[2]?.getType(),
        code: codePayload instanceof CodeMirrorNode ? codePayload.code : undefined,
      };
    });
    expect(insertedAndCode).toEqual({ code: codeSource, insertedType: 'paragraph' });
    editor.destroy();
  });

  it('inserts one paragraph before the Artifact Hole when Enter is pressed at its before boundary', async () => {
    const { editor, lexical } = await createEditor();
    selectBeforeBoundary(lexical);
    dispatchEnter(lexical);
    await moment();

    expect(rootTypes(lexical)).toEqual(['paragraph', 'paragraph', 'hole', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    editor.destroy();
  });

  it('does not split an active text payload inside a Hole into duplicate cards', async () => {
    const { editor, lexical } = await createEditor();
    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing');
        const payload = $createParagraphNode().append($createTextNode('active hole text'));
        hole.splice(1, 0, [payload]);
        const text = payload.getFirstChild();
        if (!text) throw new Error('Hole payload text missing');
        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), text.getTextContentSize(), 'text');
        selection.focus.set(text.getKey(), text.getTextContentSize(), 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
    await moment();

    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    editor.destroy();
  });

  it('does not let the Hole guard change ordinary paragraph Shift+Enter behavior', async () => {
    const { editor, lexical } = await createEditor();
    lexical.update(
      () => {
        const paragraph = $getRoot().getFirstChild();
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
        if (!text) throw new Error('ordinary paragraph text missing');
        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), text.getTextContentSize(), 'text');
        selection.focus.set(text.getKey(), text.getTextContentSize(), 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      key: 'Enter',
      shiftKey: true,
    });
    expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(true);
    await moment();
    expect(rootTypes(lexical)).toEqual(['paragraph', 'paragraph', 'hole', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    editor.destroy();
  });

  it('does not intercept Enter or Shift+Enter while a normal CodeMirror block owns selection', async () => {
    const { editor, lexical } = await createEditor();
    lexical.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('CodeMirror node missing');
        const selection = $createNodeSelection();
        selection.add(code.getKey());
        $setSelection(selection);
      },
      { discrete: true },
    );
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' });
    expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(false);
    expect(lexical.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)).toBe(false);
    expect(rootTypes(lexical)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expect(countType(lexical, 'artifact')).toBe(1);
    expect(countType(lexical, 'code')).toBe(1);
    editor.destroy();
  });
});
