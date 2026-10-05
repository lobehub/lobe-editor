import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $setSelection,
  createEditor,
  type LexicalEditor,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureCaretViewportAnchor,
  createRemoteCaretViewportStabilizer,
  restoreCaretViewportAnchor,
} from './caret-viewport-anchor';

interface TestEditor {
  editor: LexicalEditor;
  host: HTMLDivElement;
  root: HTMLDivElement;
  text: ReturnType<typeof $createTextNode>;
}

const setDimensions = (element: HTMLElement, clientHeight: number, scrollHeight: number) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
};

const createTestEditor = (
  options: { editable?: boolean; scrollable?: boolean } = {},
): TestEditor => {
  const editor = createEditor({
    editable: options.editable ?? true,
    namespace: `caret-viewport-anchor-${Math.random()}`,
    onError: (error) => {
      throw error;
    },
  });
  const host = document.createElement('div');
  const root = document.createElement('div');
  root.tabIndex = 0;
  root.contentEditable = 'true';
  host.append(root);
  document.body.append(host);

  if (options.scrollable ?? true) {
    host.style.overflowY = 'auto';
    setDimensions(host, 100, 1000);
  }

  editor.setRootElement(root);

  let text!: ReturnType<typeof $createTextNode>;
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      text = $createTextNode('hello world');
      paragraph.append(text);
      $getRoot().append(paragraph);

      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 5, 'text');
      selection.focus.set(text.getKey(), 5, 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
  root.focus();

  return { editor, host, root, text };
};

describe('caret viewport anchor', () => {
  let rangeTop = 100;
  let originalRangeRect: Range['getBoundingClientRect'] | undefined;
  let testEditor: TestEditor | undefined;

  beforeEach(() => {
    rangeTop = 100;
    originalRangeRect = Range.prototype.getBoundingClientRect;
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(20, rangeTop, 1, 20),
    });
  });

  afterEach(() => {
    if (originalRangeRect) {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalRangeRect,
      });
    } else {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: undefined,
      });
    }
    testEditor?.editor.setRootElement(null);
    document.body.replaceChildren();
    testEditor = undefined;
  });

  it('compensates the scroll container when content is inserted above the caret', () => {
    testEditor = createTestEditor();
    const anchor = captureCaretViewportAnchor(testEditor.editor);

    expect(anchor).not.toBeNull();
    rangeTop = 132;
    restoreCaretViewportAnchor(testEditor.editor, anchor);

    expect(testEditor.host.scrollTop).toBe(32);
  });

  it('does not compensate when content changes below the caret', () => {
    testEditor = createTestEditor();
    const anchor = captureCaretViewportAnchor(testEditor.editor);

    expect(anchor).not.toBeNull();
    rangeTop = 100;
    restoreCaretViewportAnchor(testEditor.editor, anchor);

    expect(testEditor.host.scrollTop).toBe(0);
  });

  it('skips a non-collapsed selection', () => {
    testEditor = createTestEditor();
    testEditor.editor.update(
      () => {
        const selection = $createRangeSelection();
        selection.anchor.set(testEditor!.text.getKey(), 1, 'text');
        selection.focus.set(testEditor!.text.getKey(), 3, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );

    expect(captureCaretViewportAnchor(testEditor.editor)).toBeNull();
  });

  it('skips when the selection has no DOM range', () => {
    testEditor = createTestEditor();
    const outside = document.createElement('span');
    outside.textContent = 'outside';
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(captureCaretViewportAnchor(testEditor.editor)).toBeNull();
  });

  it('skips readonly editors', () => {
    testEditor = createTestEditor({ editable: false });

    expect(captureCaretViewportAnchor(testEditor.editor)).toBeNull();
  });

  it('safely skips headless editors without a DOM root', () => {
    const editor = {
      getRootElement: () => {
        throw new Error('getRootElement is not supported in headless mode');
      },
      isEditable: () => true,
    } as unknown as LexicalEditor;

    expect(() => captureCaretViewportAnchor(editor)).not.toThrow();
    expect(captureCaretViewportAnchor(editor)).toBeNull();
  });

  it('skips an editor that is not focused', () => {
    testEditor = createTestEditor();
    testEditor.root.blur();

    expect(captureCaretViewportAnchor(testEditor.editor)).toBeNull();
  });

  it('uses the document viewport when the editor has no local scroll container', () => {
    testEditor = createTestEditor({ scrollable: false });
    const originalScrollingElementDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'scrollingElement',
    );
    const scrollingElement = document.documentElement;
    Object.defineProperty(document, 'scrollingElement', {
      configurable: true,
      value: scrollingElement,
    });
    const target = scrollingElement;
    const originalClientHeight = target.clientHeight;
    const originalScrollHeight = target.scrollHeight;
    Object.defineProperties(target, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1000 },
    });

    try {
      const anchor = captureCaretViewportAnchor(testEditor.editor);
      expect(anchor).not.toBeNull();
      rangeTop = 132;
      restoreCaretViewportAnchor(testEditor.editor, anchor);

      expect(scrollingElement.scrollTop).toBe(32);
    } finally {
      Object.defineProperties(target, {
        clientHeight: { configurable: true, value: originalClientHeight },
        scrollHeight: { configurable: true, value: originalScrollHeight },
      });
      if (originalScrollingElementDescriptor) {
        Object.defineProperty(document, 'scrollingElement', originalScrollingElementDescriptor);
      } else {
        Reflect.deleteProperty(document, 'scrollingElement');
      }
    }
  });

  it('skips safely when there is no scrollable container', () => {
    testEditor = createTestEditor({ scrollable: false });

    expect(captureCaretViewportAnchor(testEditor.editor)).toBeNull();
  });

  it('does not override a user scroll that happens during the remote update', () => {
    testEditor = createTestEditor();
    const anchor = captureCaretViewportAnchor(testEditor.editor);

    expect(anchor).not.toBeNull();
    testEditor.host.scrollTop = 18;
    testEditor.host.dispatchEvent(new Event('scroll'));
    rangeTop = 132;
    restoreCaretViewportAnchor(testEditor.editor, anchor);

    expect(testEditor.host.scrollTop).toBe(18);
  });

  it('anchors each update independently without accumulating a stale delta', () => {
    testEditor = createTestEditor();
    let anchor = captureCaretViewportAnchor(testEditor.editor);

    expect(anchor).not.toBeNull();
    rangeTop = 120;
    restoreCaretViewportAnchor(testEditor.editor, anchor);
    expect(testEditor.host.scrollTop).toBe(20);

    rangeTop = 100;
    anchor = captureCaretViewportAnchor(testEditor.editor);
    expect(anchor).not.toBeNull();
    rangeTop = 112;
    restoreCaretViewportAnchor(testEditor.editor, anchor);

    expect(testEditor.host.scrollTop).toBe(32);
  });

  it('retains the first anchor for multiple remote chunks in one frame', () => {
    testEditor = createTestEditor();
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        (requestAnimationFrame as unknown as { callback?: FrameRequestCallback }).callback =
          callback;
        return 1;
      });
    const stabilizer = createRemoteCaretViewportStabilizer(testEditor.editor);

    stabilizer.captureBeforeRemoteUpdate();
    rangeTop = 120;
    stabilizer.captureBeforeRemoteUpdate();
    rangeTop = 160;
    stabilizer.scheduleAfterRemoteUpdate();

    expect(testEditor.host.scrollTop).toBe(0);
    (requestAnimationFrame as unknown as { callback: FrameRequestCallback }).callback?.(0);
    expect(testEditor.host.scrollTop).toBe(60);

    stabilizer.dispose();
    requestAnimationFrame.mockRestore();
  });

  it('cancels a pending frame during cleanup', () => {
    testEditor = createTestEditor();
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const cancelAnimationFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const stabilizer = createRemoteCaretViewportStabilizer(testEditor.editor);

    stabilizer.captureBeforeRemoteUpdate();
    stabilizer.scheduleAfterRemoteUpdate();
    stabilizer.dispose();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(testEditor.host.scrollTop).toBe(0);
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
  });
});
