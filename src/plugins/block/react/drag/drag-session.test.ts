import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IEditor } from '@/types';

import { MOVE_BLOCK_COMMAND } from '../../command';
import type { IBlockMenuRenderContext } from '../../service';
import { createRuntimeContext } from '../core/runtime-context';
import { startBlockDragSession } from './drag-session';

const createPointerEvent = (type: string, clientX = 0, clientY = 0): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { configurable: true, value: clientX },
    clientY: { configurable: true, value: clientY },
  });
  return event;
};

const createFixture = () => {
  const root = document.createElement('div');
  const source = document.createElement('p');
  const target = document.createElement('p');
  source.dataset.blockId = 'source';
  target.dataset.blockId = 'target';
  vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 300, 40));
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 300, 40));
  root.append(source, target);
  document.body.append(root);

  const editor = {
    dispatchCommand: vi.fn(() => true),
    getRootElement: () => root,
  } as unknown as IEditor;
  const setDragIndicator = vi.fn();
  const clearDragPreview = vi.fn(() => setDragIndicator(null));
  const contextRef = { current: createRuntimeContext() };
  const menuContext = {
    blockElement: source,
    blockId: 'source',
    editor,
  } as unknown as IBlockMenuRenderContext;
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const requestAnimationFrame = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      const id = nextFrame++;
      callbacks.set(id, callback);
      return id;
    });
  const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });

  startBlockDragSession({
    clearDragPreview,
    clientX: 10,
    clientY: 30,
    contextRef,
    editor,
    menuContext,
    setDragIndicator,
    setOperationMenuContext: vi.fn(),
    setOperationMenuOpen: vi.fn(),
  });

  return {
    callbacks,
    cancelAnimationFrame,
    clearDragPreview,
    contextRef,
    editor,
    requestAnimationFrame,
    root,
    setDragIndicator,
  };
};

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('startBlockDragSession cleanup', () => {
  it('keeps the normal pointerup move commit after the drag threshold', () => {
    const fixture = createFixture();
    window.dispatchEvent(createPointerEvent('pointermove', 40, 120));
    fixture.callbacks.get(2)?.(0);
    window.dispatchEvent(createPointerEvent('pointerup', 40, 120));

    expect(fixture.editor.dispatchCommand).toHaveBeenCalledWith(MOVE_BLOCK_COMMAND, {
      placement: 'before',
      sourceBlockId: 'source',
      targetBlockId: 'target',
    });
    expect(fixture.contextRef.current.dragCleanup).toBeNull();
  });

  it('does not draw an insertion indicator before the drag threshold and cancels tap RAFs', () => {
    const fixture = createFixture();

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(createPointerEvent('pointerup', 10, 30));

    expect(fixture.setDragIndicator.mock.calls.filter(([value]) => value !== null)).toHaveLength(0);
    expect(fixture.clearDragPreview).toHaveBeenCalledTimes(2);
    expect(fixture.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(fixture.contextRef.current.dragCleanup).toBeNull();
    expect(fixture.editor.dispatchCommand).not.toHaveBeenCalledWith(
      MOVE_BLOCK_COMMAND,
      expect.anything(),
    );
  });

  it.each(['pointercancel', 'blur', 'dragend'] as const)(
    'cleans the active session on %s without moving the block',
    (eventType) => {
      const fixture = createFixture();
      window.dispatchEvent(createPointerEvent('pointermove', 40, 120));
      fixture.callbacks.get(2)?.(0);
      expect(fixture.setDragIndicator).toHaveBeenCalledWith(expect.any(Object));

      if (eventType === 'dragend') {
        document.dispatchEvent(new Event(eventType));
      } else if (eventType === 'blur') {
        window.dispatchEvent(new Event(eventType));
      } else {
        window.dispatchEvent(createPointerEvent(eventType));
      }

      expect(fixture.setDragIndicator).toHaveBeenLastCalledWith(null);
      expect(fixture.clearDragPreview).toHaveBeenCalled();
      expect(fixture.cancelAnimationFrame).toHaveBeenCalledWith(1);
      expect(fixture.contextRef.current.dragCleanup).toBeNull();
      expect(fixture.contextRef.current.draggingSource).toBeNull();
      expect(fixture.editor.dispatchCommand).not.toHaveBeenCalledWith(
        MOVE_BLOCK_COMMAND,
        expect.anything(),
      );
    },
  );
});
