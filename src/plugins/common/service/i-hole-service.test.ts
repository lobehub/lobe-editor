import {
  $createNodeSelection,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $nodesOfType,
  $setSelection,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { INSERT_ARTIFACT_COMMAND } from '@/plugins/artifact/command';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CommonPlugin } from '@/plugins/common';

import { HoleNode } from '../node/hole';
import { HoleService } from './hole';
import { type HoleBoundaryChange, type HoleBoundaryState, IHoleService } from './i-hole-service';

const editors: Array<ReturnType<typeof Editor.createEditor>> = [];

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

const createArtifactEditor = async () => {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin, ArtifactPlugin]);
  editors.push(editor);
  editor.initHeadlessEditor();
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
    html: '<main>service</main>',
    title: 'Service',
  });
  await moment();
  editor.getLexicalEditor()!.update(() => $setSelection(null), { discrete: true });
  await moment();
  return editor;
};

const artifactKeys = (editor: ReturnType<typeof Editor.createEditor>): string[] =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => $nodesOfType(ArtifactNode).map((node) => node.getKey()));

const selectArtifact = (editor: ReturnType<typeof Editor.createEditor>, key: string): void => {
  editor.getLexicalEditor()!.update(
    () => {
      const selection = $createNodeSelection();
      selection.add(key);
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const selectHoleBoundary = (
  editor: ReturnType<typeof Editor.createEditor>,
  side: 'before' | 'after',
): void => {
  editor.getLexicalEditor()!.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
      if (!cursor) throw new Error(`${side} Hole boundary is missing`);
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
};

describe('IHoleService', () => {
  it('reports committed semantic selection transitions without exposing Hole nodes', async () => {
    const editor = await createArtifactEditor();
    const lexicalEditor = editor.getLexicalEditor()!;
    const artifactKey = artifactKeys(editor)[0];
    const service = editor.requireService(IHoleService);
    if (!artifactKey || !service) throw new Error('Artifact or Hole service is missing');

    expect(service.getBoundaryState(artifactKey)).toEqual({
      covered: false,
      directNodeSelection: false,
      position: 'outside',
      targetKey: artifactKey,
    });
    const events: HoleBoundaryState[] = [];
    const changes: HoleBoundaryChange[] = [];
    const unsubscribe = service.subscribe((change) => {
      changes.push(change);
      events.push(change.next);
    });

    selectArtifact(editor, artifactKey);
    await moment();
    expect(service.getBoundaryState(artifactKey)).toEqual({
      covered: true,
      directNodeSelection: true,
      position: 'selected',
      targetKey: artifactKey,
    });
    expect(events).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: artifactKey },
    ]);
    expect(changes[0]).toEqual({
      next: {
        covered: true,
        directNodeSelection: true,
        position: 'selected',
        targetKey: artifactKey,
      },
      previous: {
        covered: false,
        directNodeSelection: false,
        position: 'outside',
        targetKey: artifactKey,
      },
    });
    const snapshot = service.getBoundaryState(artifactKey) as unknown as { covered: boolean };
    Reflect.set(snapshot, 'covered', false);
    expect(service.getBoundaryState(artifactKey).covered).toBe(true);

    events.length = 0;
    lexicalEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Hole missing');
        const selection = $createNodeSelection();
        selection.add(hole.getKey());
        $setSelection(selection);
      },
      { discrete: true },
    );
    await moment();
    expect(service.getBoundaryState(artifactKey)).toEqual({
      covered: true,
      directNodeSelection: false,
      position: 'selected',
      targetKey: artifactKey,
    });
    expect(events).toEqual([
      { covered: true, directNodeSelection: false, position: 'selected', targetKey: artifactKey },
    ]);

    events.length = 0;
    selectHoleBoundary(editor, 'before');
    await moment();
    expect(service.getBoundaryState(artifactKey)).toEqual({
      covered: false,
      directNodeSelection: false,
      position: 'before',
      targetKey: artifactKey,
    });
    expect(events).toEqual([
      { covered: false, directNodeSelection: false, position: 'before', targetKey: artifactKey },
    ]);

    events.length = 0;
    selectHoleBoundary(editor, 'after');
    await moment();
    expect(service.getBoundaryState(artifactKey)).toEqual({
      covered: false,
      directNodeSelection: false,
      position: 'after',
      targetKey: artifactKey,
    });
    expect(events).toEqual([
      { covered: false, directNodeSelection: false, position: 'after', targetKey: artifactKey },
    ]);

    lexicalEditor.getEditorState().read(() => {
      expect($getSelection()).not.toBeNull();
    });
    unsubscribe();
  });

  it('notifies both old and new targets when selection moves between blocks', async () => {
    const editor = await createArtifactEditor();
    editor.getLexicalEditor()!.update(
      () => {
        const paragraph = $createParagraphNode();
        $getRoot().append(paragraph);
        paragraph.selectEnd();
      },
      { discrete: true },
    );
    await moment();
    editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main>second</main>',
      title: 'Second',
    });
    await moment();
    const [firstKey, secondKey] = artifactKeys(editor);
    const service = editor.requireService(IHoleService);
    if (!firstKey || !secondKey || !service) throw new Error('Artifact or Hole service is missing');

    selectArtifact(editor, firstKey);
    await moment();
    const events: HoleBoundaryState[] = [];
    const changes: HoleBoundaryChange[] = [];
    const unsubscribe = service.subscribe((change) => {
      changes.push(change);
      events.push(change.next);
    });
    selectArtifact(editor, secondKey);
    await moment();

    expect(events).toEqual([
      {
        covered: false,
        directNodeSelection: false,
        position: 'outside',
        targetKey: firstKey,
      },
      {
        covered: true,
        directNodeSelection: true,
        position: 'selected',
        targetKey: secondKey,
      },
    ]);
    expect(changes).toEqual([
      {
        next: {
          covered: false,
          directNodeSelection: false,
          position: 'outside',
          targetKey: firstKey,
        },
        previous: {
          covered: true,
          directNodeSelection: true,
          position: 'selected',
          targetKey: firstKey,
        },
      },
      {
        next: {
          covered: true,
          directNodeSelection: true,
          position: 'selected',
          targetKey: secondKey,
        },
        previous: {
          covered: false,
          directNodeSelection: false,
          position: 'outside',
          targetKey: secondKey,
        },
      },
    ]);
    expect(service.getBoundaryState(firstKey).position).toBe('outside');
    expect(service.getBoundaryState(secondKey).position).toBe('selected');
    unsubscribe();
  });

  it('isolates editors and stops callbacks after unsubscribe and editor destroy', async () => {
    const first = await createArtifactEditor();
    const second = await createArtifactEditor();
    const firstKey = artifactKeys(first)[0];
    const secondKey = artifactKeys(second)[0];
    const firstService = first.requireService(IHoleService);
    const secondService = second.requireService(IHoleService);
    if (!firstKey || !secondKey || !firstService || !secondService) {
      throw new Error('Artifact or Hole service is missing');
    }

    const firstEvents: HoleBoundaryState[] = [];
    const secondEvents: HoleBoundaryState[] = [];
    const unsubscribeFirst = firstService.subscribe((change) => firstEvents.push(change.next));
    secondService.subscribe((change) => secondEvents.push(change.next));
    const destroyEvents: HoleBoundaryChange[] = [];
    firstService.subscribe((change) => destroyEvents.push(change));
    selectArtifact(first, firstKey);
    await moment();
    expect(firstEvents).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: firstKey },
    ]);
    expect(secondEvents).toEqual([]);

    unsubscribeFirst();
    selectHoleBoundary(first, 'before');
    await moment();
    expect(firstEvents).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: firstKey },
    ]);

    destroyEvents.length = 0;
    first.destroy();
    expect(destroyEvents).toEqual([]);
    expect(firstService.getBoundaryState(firstKey)).toEqual({
      covered: false,
      directNodeSelection: false,
      position: 'outside',
      targetKey: firstKey,
    });
    selectArtifact(second, secondKey);
    await moment();
    expect(secondEvents).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: secondKey },
    ]);
    expect(firstEvents).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: firstKey },
    ]);
  });

  it('does not let a stale disposer tear down a same-editor rebind', async () => {
    const editor = await createArtifactEditor();
    const lexicalEditor = editor.getLexicalEditor()!;
    const artifactKey = artifactKeys(editor)[0];
    if (!artifactKey) throw new Error('Artifact is missing');

    const service = new HoleService();
    const firstDispose = service.bindEditor(lexicalEditor);
    const secondDispose = service.bindEditor(lexicalEditor);
    const events: HoleBoundaryState[] = [];
    const unsubscribe = service.subscribe((change) => events.push(change.next));

    firstDispose();
    selectArtifact(editor, artifactKey);
    await moment();
    expect(events).toEqual([
      { covered: true, directNodeSelection: true, position: 'selected', targetKey: artifactKey },
    ]);

    unsubscribe();
    secondDispose();
  });
});
