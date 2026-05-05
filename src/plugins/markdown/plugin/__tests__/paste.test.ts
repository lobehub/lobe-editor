import { describe, expect, it, vi } from 'vitest';

import { MarkdownPlugin } from '../index';

const createKernelMock = () =>
  ({
    registerDataSource: vi.fn(),
    registerService: vi.fn(),
  }) as any;

const createClipboardDataMock = (payload: Record<string, string>) =>
  ({
    getData: (type: string) => payload[type] || '',
  }) as DataTransfer;

describe('Markdown paste', () => {
  it('should disable paste markdown handling when autoFormatMarkdown is false', () => {
    const plugin = new MarkdownPlugin(createKernelMock(), {
      autoFormatMarkdown: false,
    }) as any;

    expect(plugin.shouldHandlePasteMarkdown()).toBe(false);
  });

  it('should skip markdown detection when rich HTML content is present', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.hasRichHTML(
      createClipboardDataMock({
        'text/html': '<p><strong>Bold</strong> text</p>',
      }),
    );

    expect(result).toBe(true);
  });

  it('should not treat VS Code HTML markers as rich HTML for markdown bypass', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.hasRichHTML(
      createClipboardDataMock({
        'text/html': '<div data-vscode="true"><strong>Bold</strong></div>',
      }),
    );

    expect(result).toBe(false);
  });
});
