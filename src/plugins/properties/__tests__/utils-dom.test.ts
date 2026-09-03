import { $getRoot, $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactNode, ArtifactPlugin } from '@/plugins/artifact';
import { BlockPlugin } from '@/plugins/block';
import { CommonPlugin } from '@/plugins/common';

import {
  findNearestScrollContainer,
  getAnnotationElementsFromDOM,
  getBlockElementByNodeKey,
  getEditorDocumentY,
  getEditorViewportY,
  measureAnnotationAnchor,
  syncNodePropertiesToDOM,
} from '../utils-dom';
import { $getNodeProperties, $setNodeProperties } from '../state';
import { PropertiesPlugin } from '../plugin';

const setRect = (element: HTMLElement, top: number, bottom = top + 20) => {
  const rect = new DOMRect(10, top, 100, bottom - top);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
};

describe('annotation DOM utilities', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('resolves node-key and data-attribute annotation elements without duplicates', () => {
    const root = document.createElement('div');
    const range = document.createElement('span');
    const block = document.createElement('p');
    range.dataset.annotationIds = 'comment-1';
    block.dataset.annotationIds = 'comment-1,comment-2';
    root.append(block, range);

    const lexicalEditor = {
      getElementByKey: vi.fn((key: string) => (key === 'range-key' ? range : null)),
    };

    expect(
      getAnnotationElementsFromDOM(
        root,
        { id: 'comment-1', nodeKeys: ['range-key'] },
        lexicalEditor,
      ),
    ).toEqual([range, block]);
    expect(lexicalEditor.getElementByKey).toHaveBeenCalledWith('range-key');
  });

  it('measures an anchor in root document coordinates while the root scrolls', () => {
    const root = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.dataset.annotationIds = 'comment-1';
    second.dataset.annotationIds = 'comment-1';
    root.append(first, second);
    setRect(root, 100, 900);
    setRect(first, 220, 240);
    setRect(second, 320, 360);
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 40 });
    Object.defineProperty(root, 'clientTop', { configurable: true, value: 2 });

    const measurement = measureAnnotationAnchor(root, { id: 'comment-1' });

    expect(measurement).toMatchObject({
      anchorY: 158,
      element: first,
      elements: [first, second],
      height: 140,
    });
  });

  it('uses the nearest semantic block as a stable group key across split text nodes', () => {
    const root = document.createElement('div');
    const outerBlock = document.createElement('section');
    const block = document.createElement('p');
    const first = document.createElement('span');
    const second = document.createElement('span');
    outerBlock.dataset.blockId = 'outer-block';
    block.dataset.blockId = 'paragraph-block';
    first.dataset.annotationIds = 'comment-1';
    second.dataset.annotationIds = 'comment-2';
    block.append(first, second);
    outerBlock.append(block);
    root.append(outerBlock);
    setRect(root, 100, 500);
    setRect(first, 140, 160);
    setRect(second, 240, 260);

    const firstMeasurement = measureAnnotationAnchor(root, { id: 'comment-1' });
    const secondMeasurement = measureAnnotationAnchor(root, { id: 'comment-2' });

    expect(firstMeasurement?.anchorGroupKey).toBe(secondMeasurement?.anchorGroupKey);
    expect(firstMeasurement?.anchorGroupKey).toContain('paragraph-block');
    expect(firstMeasurement?.anchorGroupKey).not.toContain('outer-block');
  });

  it('does not use the editor root as a semantic block', () => {
    const root = document.createElement('div');
    const annotation = document.createElement('span');
    root.dataset.blockId = 'editor-root';
    annotation.dataset.annotationIds = 'comment-root';
    root.append(annotation);
    setRect(root, 100, 500);
    setRect(annotation, 140, 160);

    expect(measureAnnotationAnchor(root, { id: 'comment-root' })?.anchorGroupKey).toBeUndefined();
  });

  it('converts composer viewport rects to the same root coordinate system', () => {
    const root = document.createElement('div');
    setRect(root, 400, 800);
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 60 });
    Object.defineProperty(root, 'clientTop', { configurable: true, value: 4 });

    expect(getEditorDocumentY(root, new DOMRect(10, 525, 0, 0))).toBe(181);
  });

  it('resolves the current scroll viewport instead of the document origin', () => {
    const root = document.createElement('div');
    const scrollContainer = document.createElement('div');
    setRect(root, -600, 200);
    setRect(scrollContainer, 0, 800);
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 12 });
    Object.defineProperty(root, 'clientTop', { configurable: true, value: 2 });

    expect(getEditorViewportY(root, scrollContainer)).toBe(610);
  });

  it('finds the nearest scrolling ancestor instead of falling back to window', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const root = document.createElement('div');
    outer.style.overflowY = 'auto';
    inner.style.overflowY = 'scroll';
    outer.append(inner);
    inner.append(root);

    expect(findNearestScrollContainer(root)).toBe(inner);
    expect(findNearestScrollContainer(document.createElement('div'))).toBeNull();

    root.style.overflowY = 'auto';
    expect(findNearestScrollContainer(root)).toBe(root);
  });

  it('maps an annotated Hole child to its visual block wrapper and clears stale range attrs', async () => {
    const editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      PropertiesPlugin,
      BlockPlugin,
    ]);
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.append(root);
    const lexical = editor.setRootElement(root);
    editor.setDocument('json', {
      root: {
        children: [
          {
            html: '<main>annotation</main>',
            title: 'Annotation',
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

    const artifactKey = lexical
      .getEditorState()
      .read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const nested = lexical.getElementByKey(artifactKey)!;
    nested.dataset.annotationIds = 'legacy-comment';
    nested.dataset.annotation = 'true';
    nested.dataset.annotationScope = 'range';
    lexical.update(() => {
      $setNodeProperties($nodesOfType(ArtifactNode)[0], {
        annotationIds: ['artifact-comment'],
      });
    });
    await moment();
    syncNodePropertiesToDOM(lexical);

    const wrapper = root.querySelector<HTMLElement>(`[data-block-id="${artifactKey}"]`)!;
    const currentNested = lexical.getElementByKey(artifactKey)!;
    expect(wrapper.dataset.annotationIds).toBe('artifact-comment');
    expect(wrapper.dataset.annotationScope).toBe('block');
    expect(currentNested.dataset.annotationIds).toBeUndefined();
    expect(currentNested.dataset.annotationScope).toBeUndefined();

    lexical.update(() => {
      $setNodeProperties($nodesOfType(ArtifactNode)[0], {});
    });
    await moment();
    syncNodePropertiesToDOM(lexical);
    const currentWrapper = root.querySelector<HTMLElement>(`[data-block-id="${artifactKey}"]`)!;
    expect(currentWrapper.dataset.annotationIds).toBeUndefined();
    expect(currentWrapper.dataset.annotationScope).toBeUndefined();

    editor.destroy();
  });

  it('preserves Artifact annotation properties across a projected JSON reload', async () => {
    const plugins = [CommonPlugin, ArtifactPlugin, PropertiesPlugin, BlockPlugin];
    const source = Editor.createEditor().registerPlugins(plugins);
    const sourceRoot = document.createElement('div');
    document.body.append(sourceRoot);
    const sourceLexical = source.setRootElement(sourceRoot);
    source.setDocument('json', {
      root: {
        children: [
          { html: '<main>persist</main>', title: 'Persist', type: 'artifact', version: 1 },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    await moment();
    let sourceKey = '';
    sourceLexical.update(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      sourceKey = artifact.getKey();
      $setNodeProperties(artifact, { annotationIds: ['persisted-artifact-comment'] });
    });
    await moment();
    const snapshot = source.getDocument('json') as any;
    expect(snapshot.root.children[0].$.properties.annotationIds).toEqual([
      'persisted-artifact-comment',
    ]);

    const target = Editor.createEditor().registerPlugins(plugins);
    const targetRoot = document.createElement('div');
    document.body.append(targetRoot);
    const targetLexical = target.setRootElement(targetRoot);
    target.setDocument('json', snapshot);
    await moment();
    let targetKey = '';
    let ids: string[] = [];
    targetLexical.getEditorState().read(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      targetKey = artifact.getKey();
      ids = $getNodeProperties(artifact).annotationIds ?? [];
    });
    expect(targetKey).not.toBe(sourceKey);
    expect(ids).toEqual(['persisted-artifact-comment']);
    syncNodePropertiesToDOM(targetLexical);
    const wrapper = targetRoot.querySelector<HTMLElement>(`[data-block-id="${targetKey}"]`)!;
    expect(wrapper.dataset.annotationIds).toBe('persisted-artifact-comment');
    expect(wrapper.dataset.annotationScope).toBe('block');

    source.destroy();
    target.destroy();
  });

  it('keeps text annotations as range scope', async () => {
    const editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      PropertiesPlugin,
      BlockPlugin,
    ]);
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.append(root);
    const lexical = editor.setRootElement(root);
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
                text: 'range annotation',
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
    await moment();

    let textKey = '';
    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      textKey = text.getKey();
      $setNodeProperties(text, { annotationIds: ['range-comment'] });
    });
    await moment();
    syncNodePropertiesToDOM(lexical);
    const textElement = lexical.getElementByKey(textKey)!;
    expect(textElement.dataset.annotationIds).toBe('range-comment');
    expect(textElement.dataset.annotationScope).toBe('range');
    editor.destroy();
  });

  it('falls back to exact block-id matching when CSS.escape is unavailable', () => {
    vi.stubGlobal('CSS', undefined);
    const root = document.createElement('div');
    const block = document.createElement('div');
    block.dataset.blockId = 'logical:"key"';
    root.append(block);
    expect(getBlockElementByNodeKey(root, 'logical:"key"')).toBe(block);
  });
});
