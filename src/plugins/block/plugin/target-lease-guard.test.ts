import { $getNodeByKey, $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactNode, ArtifactPlugin } from '@/plugins/artifact';
import { CommonPlugin } from '@/plugins/common';
import { $getNodeId, PropertiesPlugin } from '@/plugins/properties';

import { BlockPlugin } from './index';
import { ICollaborativeTargetLeaseService } from '../service/target-lease';

describe('target lease DOM guard', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let root: HTMLElement | undefined;

  afterEach(() => {
    editor?.destroy();
    root?.remove();
    editor = undefined;
    root = undefined;
  });

  it('installs after a root is attached and blocks leased Artifact focus and input', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      ArtifactPlugin,
      PropertiesPlugin,
      BlockPlugin,
    ]);
    editor.initNodeEditor();
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexical = editor.setRootElement(root);
    editor.setDocument('json', {
      root: {
        children: [
          {
            html: '<main>leased artifact</main>',
            title: 'Leased artifact',
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

    const artifactKey = lexical.read(() => $nodesOfType(ArtifactNode)[0].getKey());
    const nodeId = lexical.read(() => $getNodeId($getNodeByKey(artifactKey)!));
    const host = root.querySelector<HTMLElement>(`[data-block-id="${artifactKey}"]`);
    if (!nodeId || !host) throw new Error('Leased Artifact host is missing durable identity.');

    const service = editor.requireService(ICollaborativeTargetLeaseService)!;
    service.upsertLease({
      capabilities: { delete: true, edit: true, move: true, select: true },
      expiresAt: Date.now() + 60_000,
      id: 'lease-artifact',
      ownerId: 'agent-1',
      requestId: 'request-1',
      target: { nodeId, targetKind: 'node' },
    });
    await moment();

    expect(host.getAttribute('data-collaborative-target-locked')).toBe('true');
    const input = document.createElement('input');
    host.append(input);

    const focus = new FocusEvent('focusin', { bubbles: true, cancelable: true });
    input.dispatchEvent(focus);
    expect(focus.defaultPrevented).toBe(true);

    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'x',
    });
    input.dispatchEvent(beforeInput);
    expect(beforeInput.defaultPrevented).toBe(true);

    const preview = document.createElement('iframe');
    host.append(preview);
    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    preview.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
  });
});
