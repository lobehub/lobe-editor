import {
  $createRangeSelection,
  $getRoot,
  $isTextNode,
  type RangeSelection,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { createHeadlessEditor } from '@/headless';
import { CommonPlugin } from '@/plugins/common';

import { AISessionPlugin } from '../plugin';
import { IAISessionService } from '../service';
import {
  AI_SESSION_ACTIVE_HIGHLIGHT_NAME,
  AI_SESSION_HOVER_HIGHLIGHT_NAME,
} from '../types';

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

const installCSSHighlights = () => {
  const highlights = new Map<string, { ranges: Range[] }>();
  const originalCSS = window.CSS;
  const originalHighlight = (window as Window & { Highlight?: unknown }).Highlight;
  class TestHighlight {
    ranges: Range[];

    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }

  Object.defineProperty(window, 'CSS', {
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
  Object.defineProperty(window, 'Highlight', {
    configurable: true,
    value: TestHighlight,
  });

  return {
    highlights,
    restore: () => {
      Object.defineProperty(window, 'CSS', { configurable: true, value: originalCSS });
      Object.defineProperty(window, 'Highlight', {
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
      const marked = root.querySelector<HTMLElement>(
        '[data-ai-session-id="session-overlay"]',
      );
      expect(marked?.classList.contains('ai-session-active')).toBe(false);

      kernel.destroy();
      expect(
        document.querySelector('[data-ai-session-highlight-overlay="true"]'),
      ).toBeNull();
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
});
