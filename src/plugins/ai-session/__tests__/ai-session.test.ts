import { $createRangeSelection, $getRoot, $isTextNode, type RangeSelection } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { createHeadlessEditor } from '@/headless';
import { CommonPlugin } from '@/plugins/common';
import { $createCursorNode } from '@/plugins/common/node/cursor';
import { $markNodesAsAIGenerated } from '@/plugins/properties';

import { AISessionPlugin } from '../plugin';
import { IAISessionService } from '../service';
import { AI_SESSION_ACTIVE_HIGHLIGHT_NAME, AI_SESSION_HOVER_HIGHLIGHT_NAME } from '../types';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const createEditor = () => {
  const root = document.createElement('div');
  const kernel = Editor.createEditor().registerPlugins([CommonPlugin, AISessionPlugin]);
  kernel.setRootElement(root);
  kernel.setDocument('text', 'before marked after');
  return { kernel, root };
};

const select = (kernel: ReturnType<typeof Editor.createEditor>): RangeSelection => {
  const lexical = kernel.getLexicalEditor()!;
  let selection: RangeSelection | undefined;
  lexical.update(() => {
    const text = $getRoot().getAllTextNodes()[0];
    if (!$isTextNode(text)) throw new Error('Expected text fixture.');
    selection = $createRangeSelection();
    selection.setTextNodeRange(text, 7, text, 13);
  });
  return selection!;
};

const selectTextNodeRange = (
  kernel: ReturnType<typeof Editor.createEditor>,
  nodeIndex: number,
  startOffset: number,
  endOffset: number,
): RangeSelection => {
  const lexical = kernel.getLexicalEditor()!;
  let selection: RangeSelection | undefined;
  lexical.update(() => {
    const text = $getRoot().getAllTextNodes()[nodeIndex];
    if (!$isTextNode(text)) throw new Error('Expected text fixture.');
    selection = $createRangeSelection();
    selection.setTextNodeRange(text, startOffset, text, endOffset);
  });
  return selection!;
};

const installCSSHighlights = (browserWindow: Window = window) => {
  const highlights = new Map<string, { ranges: Range[] }>();
  const browser = browserWindow as Window & { CSS?: unknown; Highlight?: unknown };
  const originalCSS = browser.CSS;
  const originalHighlight = browser.Highlight;
  class TestHighlight {
    ranges: Range[];

    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }

  Object.defineProperty(browserWindow, 'CSS', {
    configurable: true,
    value: {
      highlights: {
        delete: (name: string) => highlights.delete(name),
        set: (name: string, highlight: TestHighlight) => {
          highlights.set(name, highlight);
          return highlights;
        },
      },
    },
  });
  Object.defineProperty(browserWindow, 'Highlight', {
    configurable: true,
    value: TestHighlight,
  });

  return {
    highlights,
    restore: () => {
      Object.defineProperty(browserWindow, 'CSS', { configurable: true, value: originalCSS });
      Object.defineProperty(browserWindow, 'Highlight', {
        configurable: true,
        value: originalHighlight,
      });
    },
  };
};

const installRangeClientRects = () => {
  const rangePrototype = window.Range.prototype as Range & {
    getClientRects?: () => DOMRect[];
  };
  const original = rangePrototype.getClientRects;
  Object.defineProperty(rangePrototype, 'getClientRects', {
    configurable: true,
    value: () => [
      { bottom: 36, left: 10, right: 30, top: 20, width: 20, height: 16 } as DOMRect,
      { bottom: 36, left: 30, right: 50, top: 20, width: 20, height: 16 } as DOMRect,
      { bottom: 56, left: 10, right: 25, top: 40, width: 15, height: 16 } as DOMRect,
    ],
  });

  return () => {
    if (original) {
      Object.defineProperty(rangePrototype, 'getClientRects', {
        configurable: true,
        value: original,
      });
    } else {
      Reflect.deleteProperty(rangePrototype, 'getClientRects');
    }
  };
};

describe('AISessionPlugin', () => {
  it('marks the exact text range, persists metadata, and restores it', async () => {
    const { kernel } = createEditor();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(select(kernel), {
      requestId: 'request-1',
      sessionId: 'session-1',
      turnIndex: 2,
    });
    await flush();

    expect(service.getAISessionRanges('session-1')).toEqual([
      expect.objectContaining({
        endOffset: 6,
        startOffset: 0,
        text: 'marked',
        turnIndex: 2,
      }),
    ]);
    expect(kernel.getDocument('json')).toEqual(
      expect.objectContaining({
        root: expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              children: expect.arrayContaining([
                expect.objectContaining({
                  $: expect.objectContaining({
                    properties: expect.objectContaining({
                      provenance: expect.objectContaining({
                        requestId: 'request-1',
                        sessionId: 'session-1',
                        source: 'ai',
                        turnIndex: 2,
                      }),
                    }),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      }),
    );

    const restored = createEditor();
    restored.kernel.setDocument('json', kernel.getDocument('json'));
    await flush();
    expect(restored.kernel.requireService(IAISessionService)?.getRanges('session-1')).toEqual([
      expect.objectContaining({ text: 'marked', requestId: 'request-1', turnIndex: 2 }),
    ]);
  });

  it('projects DOM attributes and transient active/hover focus', async () => {
    const { kernel, root } = createEditor();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(select(kernel), { sessionId: 'session-dom' });
    await flush();

    const marked = root.querySelector<HTMLElement>('[data-ai-session-id="session-dom"]');
    expect(marked).not.toBeNull();
    expect(marked?.getAttribute('data-ai-request-id')).toBeNull();
    expect(marked?.getAttribute('data-ai-turn-index')).toBeNull();

    service.focusSession('session-dom');
    service.setHoveredSessionId('session-dom');
    expect(marked?.dataset.aiSessionActive).toBe('true');
    expect(marked?.dataset.aiSessionHover).toBe('true');

    service.clearSessionFocus();
    service.setHoveredSessionId(null);
    expect(marked?.dataset.aiSessionActive).toBeUndefined();
    expect(marked?.dataset.aiSessionHover).toBeUndefined();
  });

  it('merges adjacent marked text nodes into one active and hover CSS range', async () => {
    const { kernel, root } = createEditor();
    kernel.setDocument('text', 'firstmiddlelast');
    await flush();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(selectTextNodeRange(kernel, 0, 0, 5), {
      requestId: 'request-1',
      sessionId: 'session-adjacent',
    });
    service.applyAISessionMark(selectTextNodeRange(kernel, 1, 0, 6), {
      requestId: 'request-2',
      sessionId: 'session-adjacent',
    });
    await flush();

    const customHighlights = installCSSHighlights();
    try {
      service.focusSession('session-adjacent');
      service.setHoveredSessionId('session-adjacent');

      const active = customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME);
      const hover = customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME);
      expect(root.dataset.aiActiveSessionId).toBe('session-adjacent');
      expect(root.dataset.aiHoverSessionId).toBe('session-adjacent');
      expect(root.dataset.aiHighlightRenderer).toBe('css-highlight');
      expect(active?.ranges).toHaveLength(1);
      expect(hover?.ranges).toHaveLength(1);
      expect(active?.ranges[0].toString()).toBe('firstmiddle');
      expect(hover?.ranges[0].toString()).toBe('firstmiddle');
    } finally {
      customHighlights.restore();
    }
  });

  it('uses one endpoint range when another provenance lies between marked nodes', async () => {
    const { kernel, root } = createEditor();
    kernel.setDocument('text', 'firstmiddlelast');
    await flush();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(selectTextNodeRange(kernel, 0, 0, 5), {
      requestId: 'request-1',
      sessionId: 'session-gap',
    });
    service.applyAISessionMark(selectTextNodeRange(kernel, 1, 6, 10), {
      requestId: 'request-2',
      sessionId: 'session-gap',
    });
    service.applyAISessionMark(selectTextNodeRange(kernel, 1, 5, 6), {
      requestId: 'request-other',
      sessionId: 'session-other',
    });
    await flush();

    const customHighlights = installCSSHighlights();
    try {
      service.focusSession('session-gap');
      const active = customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME);
      expect(root.dataset.aiActiveSessionId).toBe('session-gap');
      expect(root.dataset.aiHighlightRenderer).toBe('css-highlight');
      expect(active?.ranges).toHaveLength(1);
      expect(active?.ranges[0].toString()).toBe('firstmiddlelast');
      expect(service.getRanges('session-gap')).toHaveLength(2);
    } finally {
      customHighlights.restore();
    }
  });

  it('aggregates fixed CSS highlight names across editors and root lifecycles', async () => {
    const customHighlights = installCSSHighlights();
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameWindow = iframe.contentWindow!;
    const frameHighlights = installCSSHighlights(frameWindow);
    const first = createEditor();
    const second = createEditor();
    let idle: ReturnType<typeof createEditor> | undefined;
    try {
      first.kernel.setDocument('text', 'first editor text');
      second.kernel.setDocument('text', 'second editor text');
      await flush();

      const firstService = first.kernel.requireService(IAISessionService)!;
      const secondService = second.kernel.requireService(IAISessionService)!;
      firstService.applyAISessionMark(selectTextNodeRange(first.kernel, 0, 0, 5), {
        sessionId: 'first-editor-session',
      });
      secondService.applyAISessionMark(selectTextNodeRange(second.kernel, 0, 0, 6), {
        sessionId: 'second-editor-session',
      });
      await flush();

      firstService.focusSession('first-editor-session');
      secondService.focusSession('second-editor-session');
      firstService.setHoveredSessionId('first-editor-session');
      secondService.setHoveredSessionId('second-editor-session');
      const active = customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME);
      const hover = customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME);
      expect(active?.ranges.map((range) => range.toString())).toEqual(['first', 'second']);
      expect(hover?.ranges.map((range) => range.toString())).toEqual(['first', 'second']);

      // Mount a truly idle editor after both live editors have published their
      // active and hover ranges. Its mount/update refresh must preserve both
      // fixed-name contributions before an explicit refresh and destroy.
      idle = createEditor();
      idle.kernel.setDocument('text', 'idle editor text');
      await flush();
      const idleService = idle.kernel.requireService(IAISessionService)!;
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(2);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        2,
      );
      idleService.refreshHighlights();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(2);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        2,
      );
      idle.kernel.destroy();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(2);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        2,
      );

      const firstRoot = first.root;
      expect(firstRoot.dataset.aiActiveSessionId).toBe('first-editor-session');
      first.kernel.setRootElement(null);
      expect(firstRoot.dataset.aiActiveSessionId).toBeUndefined();
      expect(firstRoot.dataset.aiHoverSessionId).toBeUndefined();
      expect(firstRoot.dataset.aiHighlightRenderer).toBeUndefined();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(1);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        1,
      );

      const frameRoot = frameWindow.document.createElement('div');
      frameWindow.document.body.append(frameRoot);
      first.kernel.setRootElement(frameRoot);
      await flush();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(1);
      expect(frameHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        1,
      );
      expect(frameHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        1,
      );

      first.kernel.setRootElement(null);
      expect(frameHighlights.highlights.has(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)).toBe(false);
      expect(frameHighlights.highlights.has(AI_SESSION_HOVER_HIGHLIGHT_NAME)).toBe(false);
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(1);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        1,
      );

      const reattachedRoot = document.createElement('div');
      first.kernel.setRootElement(reattachedRoot);
      await flush();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(2);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        2,
      );

      first.kernel.destroy();
      expect(
        customHighlights.highlights.get(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)?.ranges,
      ).toHaveLength(1);
      expect(customHighlights.highlights.get(AI_SESSION_HOVER_HIGHLIGHT_NAME)?.ranges).toHaveLength(
        1,
      );
      second.kernel.destroy();
      expect(customHighlights.highlights.has(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)).toBe(false);
      expect(customHighlights.highlights.has(AI_SESSION_HOVER_HIGHLIGHT_NAME)).toBe(false);
    } finally {
      // The assertions above intentionally exercise explicit destruction. Keep
      // cleanup idempotent when an earlier assertion fails.
      if (first.kernel.getLexicalEditor()) first.kernel.destroy();
      if (second.kernel.getLexicalEditor()) second.kernel.destroy();
      if (idle?.kernel.getLexicalEditor()) idle.kernel.destroy();
      frameHighlights.restore();
      customHighlights.restore();
      iframe.remove();
    }
  });

  it('clears CSS highlights on focus reset and service destroy', async () => {
    const { kernel, root } = createEditor();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(select(kernel), { sessionId: 'session-clear' });
    await flush();

    const customHighlights = installCSSHighlights();
    try {
      service.focusSession('session-clear');
      expect(customHighlights.highlights.has(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)).toBe(true);
      service.clearSessionFocus();
      expect(customHighlights.highlights.has(AI_SESSION_ACTIVE_HIGHLIGHT_NAME)).toBe(false);
      expect(root.dataset.aiActiveSessionId).toBeUndefined();
      expect(root.dataset.aiHighlightRenderer).toBe('none');
      service.setHoveredSessionId('session-clear');
      expect(customHighlights.highlights.has(AI_SESSION_HOVER_HIGHLIGHT_NAME)).toBe(true);
      kernel.destroy();
      expect(customHighlights.highlights.has(AI_SESSION_HOVER_HIGHLIGHT_NAME)).toBe(false);
    } finally {
      customHighlights.restore();
    }
  });

  it('uses merged absolute overlays when CSS Custom Highlight is unavailable', async () => {
    const { kernel, root } = createEditor();
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(select(kernel), { sessionId: 'session-overlay' });
    await flush();

    const restoreClientRects = installRangeClientRects();
    try {
      service.focusSession('session-overlay');
      const overlays = document.querySelectorAll<HTMLElement>(
        '[data-ai-session-highlight-overlay="true"] .ai-session-highlight-overlay',
      );
      expect(overlays).toHaveLength(2);
      expect(root.dataset.aiActiveSessionId).toBe('session-overlay');
      expect(root.dataset.aiHighlightRenderer).toBe('overlay');
      expect(overlays[0]?.style.height).toBe('16px');
      expect(overlays[0]?.style.left).toBe('10px');
      expect(overlays[0]?.style.position).toBe('absolute');
      expect(overlays[0]?.style.top).toBe('20px');
      expect(overlays[0]?.style.width).toBe('40px');
      const marked = root.querySelector<HTMLElement>('[data-ai-session-id="session-overlay"]');
      expect(marked?.classList.contains('ai-session-active')).toBe(false);

      kernel.destroy();
      expect(document.querySelector('[data-ai-session-highlight-overlay="true"]')).toBeNull();
    } finally {
      restoreClientRects();
    }
  });

  it('keeps headless provenance while all DOM lifecycle calls remain safe', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Headless generated text');
    const kernel = headless.kernel;
    const lexical = kernel.getLexicalEditor()!;
    let selection: RangeSelection | undefined;
    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      if (!$isTextNode(text)) throw new Error('Expected headless text fixture.');
      selection = $createRangeSelection();
      selection.setTextNodeRange(text, 0, text, text.getTextContentSize());
    });
    const service = kernel.requireService(IAISessionService)!;
    service.applyAISessionMark(selection!, { sessionId: 'headless-session' });
    await flush();

    expect(service.getRanges('headless-session')).toEqual([
      expect.objectContaining({ text: 'Headless generated text' }),
    ]);
    expect(() => service.focusSession('headless-session')).not.toThrow();
    expect(() => service.refresh()).not.toThrow();
    expect(() => service.clearSessionFocus()).not.toThrow();
    expect(() => (service as unknown as { destroy: () => void }).destroy()).not.toThrow();
  });

  it('does not expose invisible cursor sentinels as generated rewrite ranges', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Generated text');
    const lexical = headless.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild();
      const append = (paragraph as { append?: unknown } | null)?.append;
      if (typeof append !== 'function') throw new Error('Expected paragraph fixture.');
      (append as (node: ReturnType<typeof $createCursorNode>) => void).call(
        paragraph,
        $createCursorNode(),
      );
      $markNodesAsAIGenerated($getRoot().getAllTextNodes(), { sessionId: 'cursor-session' });
    });
    await flush();

    expect(headless.kernel.requireService(IAISessionService)?.getRanges('cursor-session')).toEqual([
      expect.objectContaining({ text: 'Generated text' }),
    ]);
    headless.destroy();
  });
});
