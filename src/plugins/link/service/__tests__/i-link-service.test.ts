import type { LexicalEditor } from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import type { LinkNode } from '../../node/LinkNode';
import { LinkService, LinkToolbarRenderContext } from '../i-link-service';

const context: LinkToolbarRenderContext = {
  close: vi.fn(),
  editor: {} as LexicalEditor,
  linkDom: null,
  linkNode: {} as LinkNode,
};

describe('LinkService', () => {
  it('registers, filters, sorts, and unregisters toolbar items', () => {
    const service = new LinkService();

    const unregisterSecond = service.registerToolbarItem({
      icon: 'copy',
      key: 'copy',
      label: 'Copy',
      onClick: vi.fn(),
      order: 20,
    });
    service.registerToolbarItem({
      icon: 'open',
      key: 'open',
      label: 'Open',
      onClick: vi.fn(),
      order: 10,
    });
    service.registerToolbarItem({
      icon: 'unlink',
      key: 'hidden',
      label: 'Hidden',
      onClick: vi.fn(),
      order: 5,
      when: () => false,
    });

    expect(service.getToolbarItems(context).map((item) => item.key)).toEqual(['open', 'copy']);

    unregisterSecond();

    expect(service.getToolbarItems(context).map((item) => item.key)).toEqual(['open']);
  });

  it('notifies subscribers when toolbar items change', () => {
    const service = new LinkService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    const unregister = service.registerToolbarItem({
      icon: 'edit',
      key: 'edit',
      label: 'Edit',
      onClick: vi.fn(),
    });
    unregister();
    unsubscribe();
    service.registerToolbarItem({
      icon: 'open',
      key: 'open',
      label: 'Open',
      onClick: vi.fn(),
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
