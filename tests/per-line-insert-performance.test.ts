import {
  $createParagraphNode,
  $getRoot,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CodePlugin } from '@/plugins/code';
import { CommonPlugin } from '@/plugins/common';
import { LinkPlugin } from '@/plugins/link';
import { ListPlugin } from '@/plugins/list';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';
import { TocPlugin } from '@/plugins/toc';
import type { IEditor } from '@/types';

/**
 * A browser that bypasses `paste` (automation, extensions, some IMEs) types a block of text one
 * line at a time: an insertText for the line, then Enter, each committed as its own update. Every
 * per-update cost that scans the document makes the total grow with lines x document size.
 *
 * Lexical itself does some O(document) work per commit whatever plugins are loaded (it clones the
 * node map, and without a DOM recomputes the text content), so the timing below covers the
 * editor's own code: every update listener, node transform and command handler registered on the
 * Lexical editor, outermost call only.
 */

const editors: IEditor[] = [];

function createEditor(): IEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    MarkdownPlugin,
    [LinkPlugin, { enableHotkey: false }],
    CodePlugin,
    ListPlugin,
    TablePlugin,
    TocPlugin,
    LitexmlPlugin,
  ]);
  editor.initNodeEditor();
  const root = document.createElement('div');
  document.body.append(root);
  editor.setRootElement(root);
  editors.push(editor);
  return editor;
}

function meterEditorCallbacks(lexical: LexicalEditor) {
  const meter = { ms: 0 };
  let depth = 0;
  const wrap = <T extends (...args: any[]) => any>(callback: T): T =>
    ((...args: Parameters<T>) => {
      if (depth > 0) return callback(...args);
      depth += 1;
      const start = performance.now();
      try {
        return callback(...args);
      } finally {
        meter.ms += performance.now() - start;
        depth -= 1;
      }
    }) as T;
  const rewrap = <T extends (...args: any[]) => any>(callbacks: Set<T>) => {
    const ordered = [...callbacks];
    callbacks.clear();
    ordered.forEach((callback) => callbacks.add(wrap(callback)));
  };

  const updateListeners = lexical._listeners.update;
  const ordered = [...updateListeners];
  updateListeners.clear();
  ordered.forEach(([listener, cleanup]) => updateListeners.set(wrap(listener), cleanup));
  lexical._nodes.forEach(({ transforms }) => rewrap(transforms));
  lexical._commands.forEach((priorities) => priorities.forEach(rewrap));
  return meter;
}

const line = (index: number) =>
  `Line ${String(index + 1).padStart(4, '0')}: the quick brown fox jumps over the lazy dog`;

function insertLines(count: number) {
  const editor = createEditor();
  const lexical = editor.getLexicalEditor()!;
  lexical.update(
    () => {
      const paragraph = $createParagraphNode();
      $getRoot().clear().append(paragraph);
      paragraph.select();
    },
    { discrete: true },
  );

  let updates = 0;
  const unregister = lexical.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
    if (dirtyElements.size > 0 || dirtyLeaves.size > 0) updates += 1;
  });
  const callbacks = meterEditorCallbacks(lexical);

  const start = performance.now();
  for (let index = 0; index < count; index++) {
    lexical.update(() => lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, line(index)), {
      discrete: true,
    });
    lexical.update(() => lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), {
      discrete: true,
    });
  }
  const ms = performance.now() - start;
  unregister();

  const markdown = editor.getDocument('markdown') as unknown as string;
  return { callbackMs: callbacks.ms, markdown, ms, updates };
}

/** Fastest of a few runs: scheduling noise only ever adds time. */
function measure(count: number, runs = 3) {
  let best = insertLines(count);
  for (let run = 1; run < runs; run++) {
    const next = insertLines(count);
    if (next.callbackMs < best.callbackMs) best = next;
  }
  return best;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.innerHTML = '';
});

describe('per-line insertion', () => {
  it('keeps every inserted line', () => {
    const { markdown, updates } = insertLines(50);
    const lines = markdown.split('\n').filter(Boolean);

    expect(updates).toBe(100);
    expect(lines).toHaveLength(50);
    expect(lines[0]).toBe(line(0));
    expect(lines[49]).toBe(line(49));
  });

  it('grows linearly in time and update count with the number of lines', () => {
    insertLines(100); // warm up the JIT

    const small = 300;
    const large = 1200;
    const smallRun = measure(small);
    const largeRun = measure(large);

    // One update for the text, one for Enter: nothing re-runs per line.
    expect(smallRun.updates).toBe(2 * small);
    expect(largeRun.updates).toBe(2 * large);

    // 4x the lines: linear work takes ~4x, work that rescans the document per line ~16x.
    const ratio = largeRun.callbackMs / smallRun.callbackMs;
    const report =
      `editor callbacks ${smallRun.callbackMs.toFixed(0)}ms -> ${largeRun.callbackMs.toFixed(0)}ms, ` +
      `total ${smallRun.ms.toFixed(0)}ms -> ${largeRun.ms.toFixed(0)}ms for ${small} -> ${large} lines`;
    expect(ratio, report).toBeLessThan(7);
  }, 120_000);
});
