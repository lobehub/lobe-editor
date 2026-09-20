import { describe, expect, it, vi } from 'vitest';
import { createEditor } from 'lexical';
import { LoroDoc } from 'loro-crdt';

import type { ICodeMirrorInstance } from '@/codemirror';
import type {
  CollaborationEmbeddedText,
  CollaborationEmbeddedTextChange,
} from '@/common/collaboration';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { LoroLexicalBinding } from '../binding';
import { LoroCanonicalDocument, getAttachedText } from '../index';

import { computeEmbeddedTextChange, EmbeddedTextAdapter } from './embedded-text';

class FakeEmbeddedText implements CollaborationEmbeddedText {
  readonly id = 'body-1';
  private readonly listeners = new Set<() => void>();
  value = 'abc';
  redo = vi.fn(() => false);
  undo = vi.fn(() => true);

  applyLocalChange(from: number, to: number, insert: string): void {
    this.value = `${this.value.slice(0, from)}${insert}${this.value.slice(to)}`;
    this.listeners.forEach((listener) => listener());
  }

  applyLocalChanges(changes: readonly CollaborationEmbeddedTextChange[]): void {
    let adjustment = 0;
    for (const change of changes) {
      const from = change.from + adjustment;
      const to = change.to + adjustment;
      this.value = `${this.value.slice(0, from)}${change.insert}${this.value.slice(to)}`;
      adjustment += change.insert.length - (change.to - change.from);
    }
    this.listeners.forEach((listener) => listener());
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  read(): string {
    return this.value;
  }

  remote(next: string): void {
    this.value = next;
    this.listeners.forEach((listener) => listener());
  }
}

const createLoroBodySource = (
  canonical: LoroCanonicalDocument,
  nodeId: string,
): CollaborationEmbeddedText => {
  const node = canonical.findNodeById(nodeId);
  const body = node && getAttachedText(node, 'body');
  if (!body) throw new Error('embedded test body missing');
  const apply = (changes: readonly CollaborationEmbeddedTextChange[]) => {
    canonical.commit(
      () => {
        let adjustment = 0;
        for (const change of changes) {
          const from = change.from + adjustment;
          const to = change.to + adjustment;
          if (to > from) body.delete(from, to - from);
          if (change.insert) body.insert(from, change.insert);
          adjustment += change.insert.length - (change.to - change.from);
        }
      },
      { origin: 'loro:embedded/test' },
    );
  };
  return {
    applyLocalChange: (from, to, insert) => apply([{ from, insert, to }]),
    applyLocalChanges: apply,
    id: body.id,
    onChange: (listener) =>
      canonical.subscribe((event) => {
        if (event.events.some((change) => change.target === body.id)) listener();
      }),
    read: () => body.toString(),
  };
};

const createBoundLoroBodySource = (
  canonical: LoroCanonicalDocument,
  binding: LoroLexicalBinding,
  nodeId: string,
): CollaborationEmbeddedText => {
  const node = canonical.findNodeById(nodeId);
  const body = node && getAttachedText(node, 'body');
  if (!body) throw new Error('bound embedded test body missing');
  const apply = (changes: readonly CollaborationEmbeddedTextChange[]) => {
    binding.runLocalTransaction('loro:embedded/local', () => {
      let adjustment = 0;
      for (const change of changes) {
        const from = change.from + adjustment;
        const to = change.to + adjustment;
        if (to > from) body.delete(from, to - from);
        if (change.insert) body.insert(from, change.insert);
        adjustment += change.insert.length - (change.to - change.from);
      }
    });
  };
  return {
    applyLocalChange: (from, to, insert) => apply([{ from, insert, to }]),
    applyLocalChanges: apply,
    id: body.id,
    onChange: (listener) =>
      canonical.subscribe((event) => {
        if (event.events.some((change) => change.target === body.id)) listener();
      }),
    read: () => body.toString(),
    redo: () => binding.redo(),
    undo: () => binding.undo(),
  };
};

const waitForCondition = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for the embedded binding projection.');
};

const createInstance = (initial: string) => {
  let value = initial;
  let dispatchCalls = 0;
  const changeListeners = new Set<() => void>();
  const instance = {
    getValue: () => value,
    on: (event: string, listener: () => void) => {
      if (event === 'change') changeListeners.add(listener);
    },
    view: {
      dispatch: ({ changes }: { changes: unknown }) => {
        dispatchCalls += 1;
        if (Array.isArray(changes)) {
          for (const change of changes as Array<{ from: number; to: number; insert: string }>) {
            value = `${value.slice(0, change.from)}${change.insert}${value.slice(change.to)}`;
          }
        } else if (
          changes &&
          typeof changes === 'object' &&
          typeof (changes as { from?: unknown }).from === 'number'
        ) {
          const change = changes as { from: number; to?: number; insert?: string };
          value = `${value.slice(0, change.from)}${change.insert ?? ''}${value.slice(
            change.to ?? change.from,
          )}`;
        } else if (
          changes &&
          typeof (changes as { iterChanges?: unknown }).iterChanges === 'function'
        ) {
          const specs: Array<{ from: number; to: number; insert: string }> = [];
          (changes as { iterChanges: (callback: (...args: any[]) => void) => void }).iterChanges(
            (from: number, to: number, _fromB: number, _toB: number, insert: string) =>
              specs.push({ from, insert, to }),
          );
          let adjustment = 0;
          for (const change of specs) {
            const from = change.from + adjustment;
            const to = change.to + adjustment;
            value = `${value.slice(0, from)}${change.insert}${value.slice(to)}`;
            adjustment += change.insert.length - (change.to - change.from);
          }
        }
        changeListeners.forEach((listener) => listener());
      },
    },
    getDispatchCalls: () => dispatchCalls,
    userEdit: (next: string) => {
      value = next;
      changeListeners.forEach((listener) => listener());
    },
  } as unknown as ICodeMirrorInstance & {
    getDispatchCalls: () => number;
    userEdit: (next: string) => void;
  };
  return instance;
};

describe('EmbeddedTextAdapter', () => {
  it('maps one local CodeMirror change into a Loro body transaction', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const onLocalChange = vi.fn();
    const adapter = new EmbeddedTextAdapter(instance, source, {
      canWrite: () => true,
      onLocalChange,
    });
    adapter.start();

    instance.userEdit('aXbc');

    expect(source.value).toBe('aXbc');
    expect(onLocalChange).toHaveBeenCalledWith('aXbc');
    adapter.dispose();
  });

  it('keeps surrogate pairs intact when replacing one non-BMP character', () => {
    const source = new FakeEmbeddedText();
    source.value = '😀';
    const instance = createInstance('😀');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();

    instance.userEdit('😃');

    expect(source.value).toBe('😃');
    adapter.dispose();
  });

  it('produces an exact next string for same-high and same-low surrogate replacements', () => {
    const samples = [
      [String.fromCodePoint(0x1f600), String.fromCodePoint(0x1fa00)],
      [String.fromCodePoint(0x1f600), String.fromCodePoint(0x1f601)],
      [
        `before-${String.fromCodePoint(0x1f600)}-after`,
        `before-${String.fromCodePoint(0x1fa00)}-after`,
      ],
    ] as const;
    for (const [previous, next] of samples) {
      const change = computeEmbeddedTextChange(previous, next);
      expect(change).toBeTruthy();
      const roundTrip = `${previous.slice(0, change!.from)}${change!.insert}${previous.slice(change!.to)}`;
      expect(roundTrip).toBe(next);
    }
  });

  it('applies a remote delta through the CodeMirror transaction surface without echoing it', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const onLocalChange = vi.fn();
    const adapter = new EmbeddedTextAdapter(instance, source, {
      canWrite: () => true,
      onLocalChange,
    });
    adapter.start();

    source.remote('aYbc');

    expect(instance.getValue()).toBe('aYbc');
    expect(onLocalChange).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('preserves a multi-hunk CodeMirror ChangeSet instead of collapsing it to one range', () => {
    const source = new FakeEmbeddedText();
    source.value = 'abcdef';
    const instance = createInstance('abcdef');
    const applyLocalChanges = vi.spyOn(source, 'applyLocalChanges');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();
    const changes = {
      iterChanges: (callback: (...args: any[]) => void) => {
        callback(1, 2, 1, 2, 'X');
        callback(4, 5, 4, 5, 'Y');
      },
    };

    (instance.view.dispatch as unknown as (value: unknown) => void)({ changes });

    expect(source.value).toBe('aXcdYf');
    expect(applyLocalChanges).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('maps a plain CodeMirror TransactionSpec through the binding gate', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();

    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      changes: { from: 1, to: 2, insert: 'X' },
    });

    expect(instance.getValue()).toBe('aXc');
    expect(source.value).toBe('aXc');
    adapter.dispose();
  });

  it('restores a raced local edit when readonly/remote lock wins', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    let writable = false;
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => writable });
    adapter.start();

    instance.userEdit('blocked');

    expect(instance.getValue()).toBe('abc');
    expect(source.value).toBe('abc');
    adapter.dispose();
  });

  it('rejects direct CodeMirror document dispatches before readonly view mutation', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    let writable = false;
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => writable });
    adapter.start();

    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      changes: { from: 1, to: 2, insert: 'X' },
    });

    expect(instance.getValue()).toBe('abc');
    expect(source.value).toBe('abc');
    // The adapter may forward a selection/effects-only replacement spec, but
    // the original view must receive no document changes.
    expect(instance.getDispatchCalls()).toBe(1);

    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      docChanged: true,
      changes: [{ from: 1, to: 2, insert: 'Y' }],
    });

    expect(instance.getValue()).toBe('abc');
    expect(source.value).toBe('abc');
    expect(instance.getDispatchCalls()).toBe(1);

    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      selection: { anchor: 1, head: 1 },
    });

    expect(instance.getValue()).toBe('abc');
    expect(instance.getDispatchCalls()).toBe(2);
    adapter.dispose();
  });

  it('allows a remote dispatch while the local document is readonly', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => false });
    adapter.start();

    source.remote('aYbc');

    expect(instance.getValue()).toBe('aYbc');
    expect(source.value).toBe('aYbc');
    adapter.dispose();
  });

  it('attaches after a source/view mismatch without routing initialization through legacy debounce', () => {
    const source = new FakeEmbeddedText();
    source.value = 'source';
    const instance = createInstance('view');
    let adapter: EmbeddedTextAdapter | null = null;
    const legacyWrite = vi.fn();
    instance.on('change', () => {
      if (!adapter) legacyWrite(instance.getValue());
    });

    const nextAdapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter = nextAdapter;
    nextAdapter.start();
    source.remote('remote');

    expect(instance.getValue()).toBe('remote');
    expect(legacyWrite).not.toHaveBeenCalled();
    nextAdapter.dispose();
  });

  it('routes undo/redo key commands to the binding-owned manager', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();
    const event = {
      ctrlKey: true,
      key: 'z',
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    expect(adapter.handleKeyDown(event)).toBe(true);
    expect(source.undo).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('consumes empty binding history instead of falling through to CodeMirror history', () => {
    const source = new FakeEmbeddedText();
    source.undo.mockReturnValue(false);
    source.redo.mockReturnValue(false);
    const instance = createInstance('abc');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();
    const event = (key: string, shiftKey = false) =>
      ({
        ctrlKey: true,
        key,
        metaKey: false,
        altKey: false,
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }) as unknown as KeyboardEvent;

    const undoEvent = event('z');
    const redoEvent = event('y');
    expect(adapter.handleKeyDown(undoEvent)).toBe(true);
    expect(adapter.handleKeyDown(redoEvent)).toBe(true);
    expect(source.undo).toHaveBeenCalledOnce();
    expect(source.redo).toHaveBeenCalledOnce();
    expect(undoEvent.preventDefault).toHaveBeenCalledOnce();
    expect(redoEvent.preventDefault).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('consumes readonly undo/redo without invoking binding history', () => {
    const source = new FakeEmbeddedText();
    const instance = createInstance('abc');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => false });
    adapter.start();
    const event = {
      ctrlKey: true,
      key: 'z',
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    expect(adapter.handleKeyDown(event)).toBe(true);
    expect(source.undo).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('keeps binding-owned body typing in separate undo groups after the merge window', async () => {
    const descriptor = { bindingSchema: 'lexical-loro-v1', engine: 'loro', epoch: 0 } as const;
    const canonical = new LoroCanonicalDocument(new LoroDoc(), descriptor);
    canonical.commit(
      () => {
        canonical.createNode({
          attrs: { title: 'Undo body' },
          body: 'seed',
          nodeId: 'undo-body',
          role: 'block-decorator',
          type: 'artifact',
        });
      },
      { origin: 'loro:test/seed' },
    );
    const lexical = createEditor({
      namespace: 'loro-embedded-undo-test',
      nodes: [ArtifactNode],
      onError: (error) => {
        throw error;
      },
    });
    const binding = new LoroLexicalBinding({
      descriptor,
      doc: canonical,
      editor: lexical,
      shouldBootstrap: false,
    });
    binding.setHistoryMergeInterval(40);
    await waitForCondition(() => binding.getReadiness() === 'ready');

    const source = createBoundLoroBodySource(canonical, binding, 'undo-body');
    const instance = createInstance('seed');
    const adapter = new EmbeddedTextAdapter(instance, source, { canWrite: () => true });
    adapter.start();

    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      changes: { from: 4, to: 4, insert: ' first' },
    });
    await waitForCondition(() => instance.getValue() === 'seed first');
    await new Promise((resolve) => setTimeout(resolve, 100));
    (instance.view.dispatch as unknown as (transaction: unknown) => void)({
      changes: { from: 10, to: 10, insert: ' second' },
    });
    await waitForCondition(() => instance.getValue() === 'seed first second');

    const undoEvent = {
      ctrlKey: false,
      key: 'z',
      metaKey: true,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    expect(adapter.handleKeyDown(undoEvent)).toBe(true);
    await waitForCondition(() => instance.getValue() === 'seed first');
    expect(source.read()).toBe('seed first');

    expect(
      adapter.handleKeyDown({
        ...undoEvent,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent),
    ).toBe(true);
    await waitForCondition(() => instance.getValue() === 'seed');
    expect(source.read()).toBe('seed');

    adapter.dispose();
    binding.dispose();
    canonical.doc.free();
  });

  it('round-trips a real Loro body through two transaction-backed editor peers', () => {
    const descriptor = { bindingSchema: 'lexical-loro-v1', engine: 'loro', epoch: 0 } as const;
    const left = new LoroCanonicalDocument(new LoroDoc(), descriptor);
    left.commit(
      () => {
        left.createNode({
          body: 'abc',
          nodeId: 'code-body',
          role: 'block-decorator',
          type: 'code',
        });
      },
      { origin: 'loro:test-seed' },
    );
    const base = left.doc.version();
    const right = LoroCanonicalDocument.fromSnapshot(left.exportSnapshot(), descriptor);
    const leftInstance = createInstance('abc');
    const leftAdapter = new EmbeddedTextAdapter(
      leftInstance,
      createLoroBodySource(left, 'code-body'),
      { canWrite: () => true },
    );
    leftAdapter.start();
    const rightInstance = createInstance('abc');
    const rightAdapter = new EmbeddedTextAdapter(
      rightInstance,
      createLoroBodySource(right, 'code-body'),
      { canWrite: () => true },
    );
    rightAdapter.start();
    leftInstance.userEdit('aXbc');
    right.import(left.exportUpdate(base));

    expect(rightInstance.getValue()).toBe('aXbc');
    leftAdapter.dispose();
    rightAdapter.dispose();
    left.doc.free();
    right.doc.free();
  });
});
