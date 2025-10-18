import { describe, expect, it, vi } from 'vitest';

import { HOVER_COMMAND, registerEvent } from '../event';

describe('registerEvent', () => {
  it('should dispatch hover command when event is triggered and cleanup properly', () => {
    const dispatchCommand = vi.fn();
    const editor = { dispatchCommand } as unknown as import('lexical').LexicalEditor;
    const dom = document.createElement('div');

    const dispose = registerEvent(editor, dom);

    const event = new window.MouseEvent('mouseenter');
    dom.dispatchEvent(event);

    expect(dispatchCommand).toHaveBeenCalledTimes(1);
    expect(dispatchCommand).toHaveBeenCalledWith(HOVER_COMMAND, event);

    dispose();

    dom.dispatchEvent(new window.MouseEvent('mouseenter'));
    expect(dispatchCommand).toHaveBeenCalledTimes(1);
  });
});
