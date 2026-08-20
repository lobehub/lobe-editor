import {
  $createTableNodeWithDimensions,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { $getNodeByKey, $getRoot, createEditor, type NodeKey } from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollFocusedTableCellIntoView } from './useScrollFocusedTableCellIntoView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const HookHarness = ({ editor }: { editor: LexicalEditor }) => {
  useScrollFocusedTableCellIntoView(editor);
  return null;
};

describe('useScrollFocusedTableCellIntoView', () => {
  const scrollIntoView = vi.fn();
  const frames: FrameRequestCallback[] = [];
  let host: HTMLDivElement;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
  let reactRoot: Root;

  beforeEach(() => {
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    host = document.createElement('div');
    document.body.append(host);
    reactRoot = createRoot(host);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    act(() => reactRoot.unmount());
    host.remove();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    frames.length = 0;
    scrollIntoView.mockReset();
    vi.unstubAllGlobals();
  });

  const flushFrame = () => {
    const callback = frames.shift();
    expect(callback).toBeDefined();
    callback!(0);
  };

  it('scrolls each newly focused td with nearest alignment and ignores updates within one td', () => {
    const editor = createEditor({ nodes: [TableCellNode, TableNode, TableRowNode] });
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    editor.setRootElement(rootElement);
    act(() => reactRoot.render(<HookHarness editor={editor} />));
    let firstCellKey: NodeKey;
    let secondCellKey: NodeKey;

    act(() => {
      editor.update(
        () => {
          const table = $createTableNodeWithDimensions(1, 2, false);
          const row = table.getFirstChildOrThrow<TableRowNode>();
          const firstCell = row.getFirstChildOrThrow<TableCellNode>();
          const secondCell = row.getLastChildOrThrow<TableCellNode>();
          firstCellKey = firstCell.getKey();
          secondCellKey = secondCell.getKey();
          $getRoot().append(table);
          firstCell.selectStart();
        },
        { discrete: true },
      );
    });

    flushFrame();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' });

    act(() => {
      editor.update(() => $getNodeByKey<TableCellNode>(secondCellKey)!.selectStart(), {
        discrete: true,
      });
    });
    flushFrame();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    act(() => {
      editor.update(() => $getNodeByKey<TableCellNode>(secondCellKey)!.selectEnd(), {
        discrete: true,
      });
    });
    expect(frames).toHaveLength(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    editor.setRootElement(null);
    rootElement.remove();
  });
});
