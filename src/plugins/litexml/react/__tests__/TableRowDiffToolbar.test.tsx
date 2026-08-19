import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  DiffAction,
  LITEXML_DIFFNODE_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';
import type { IEditor } from '@/types';

import TableRowDiffToolbar from '../TableRowDiffToolbar';

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const initialTable = `
<table>
  <tr><td>Name</td><td>Quantity</td><td>Note</td></tr>
  <tr><td>Apple</td><td>10</td><td>Original</td></tr>
</table>`;

const getRowId = (xml: string, text: string) => {
  for (const match of xml.matchAll(/<tr id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    if (match[2].includes(text)) return match[1];
  }
  throw new Error(`Missing row containing ${text}`);
};

describe('TableRowDiffToolbar', () => {
  let editor: IEditor;
  let editorRootElement: HTMLDivElement;
  let reactHost: HTMLDivElement;
  let reactRoot: Root;

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    resetRandomKey();
    editorRootElement = document.createElement('div');
    reactHost = document.createElement('div');
    document.body.append(editorRootElement, reactHost);
    reactRoot = createRoot(reactHost);

    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
    editor.setRootElement(editorRootElement);
    editor.setDocument('litexml', initialTable);

    const xml = editor.getDocument('litexml') as unknown as string;
    const rowId = getRowId(xml, 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<tr id="${rowId}"><td>Orange</td><td>20</td><td>Updated</td></tr>`,
      },
    ]);
    await moment();

    await act(async () => {
      reactRoot.render(<TableRowDiffToolbar editor={editor.getLexicalEditor()!} />);
    });
  });

  afterEach(() => {
    act(() => reactRoot.unmount());
    editor.getLexicalEditor()?.setRootElement(null);
    editorRootElement.remove();
    reactHost.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ['Reject row change', DiffAction.Reject],
    ['Accept row change', DiffAction.Accept],
  ] as const)(
    'dispatches %s on pointer down before the portal can lose hover',
    async (label, action) => {
      const lexicalEditor = editor.getLexicalEditor()!;
      const dispatchSpy = vi.spyOn(lexicalEditor, 'dispatchCommand');
      const diffRow = editorRootElement.querySelector<HTMLElement>('tr[data-diff-type]');
      expect(diffRow).not.toBeNull();

      await act(async () => {
        diffRow!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      });

      const button = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
      expect(button).not.toBeNull();

      const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
      await act(async () => {
        button!.dispatchEvent(pointerDown);
      });

      expect(pointerDown.defaultPrevented).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        LITEXML_DIFFNODE_COMMAND,
        expect.objectContaining({ action }),
      );
    },
  );
});
