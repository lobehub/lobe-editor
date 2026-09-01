import type { LexicalEditor } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiffAction, LITEXML_DIFFNODE_COMMAND } from '@/plugins/litexml';
import type { DiffNode } from '@/plugins/litexml/node/DiffNode';

import ReactDiffNodeToolbar from '../DiffNodeToolbar';

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('DiffNodeToolbar', () => {
  let host: HTMLDivElement;
  let root: Root;
  let dispatchCommand: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    dispatchCommand = vi.fn();

    const editor = { _key: 'toolbar-test', dispatchCommand } as unknown as LexicalEditor;
    const node = { getKey: () => 'diff-node-key' } as unknown as DiffNode;
    await act(async () => {
      root.render(<ReactDiffNodeToolbar editor={editor} node={node} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ['Reject change', DiffAction.Reject],
    ['Accept change', DiffAction.Accept],
  ] as const)('dispatches %s on pointer down before hover is lost', async (label, action) => {
    const button = host.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    expect(button).not.toBeNull();

    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    await act(async () => {
      button!.dispatchEvent(pointerDown);
    });

    expect(pointerDown.defaultPrevented).toBe(true);
    expect(dispatchCommand).toHaveBeenCalledWith(LITEXML_DIFFNODE_COMMAND, {
      action,
      nodeKey: 'diff-node-key',
    });
  });
});
