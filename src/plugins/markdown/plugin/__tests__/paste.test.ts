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

describe('Markdown paste auto conversion', () => {
  it('should auto convert multi-paragraph markdown with strong structural signals', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.getMarkdownDetectionResult('# Title\n\nBody paragraph');

    expect(result).toEqual({
      matchedPatterns: ['headers', 'multi-paragraph'],
      score: 10,
      shouldAutoConvert: true,
    });
  });

  it('should keep lightweight inline markdown as plain text below the default threshold', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.getMarkdownDetectionResult('Use `foo` here');

    expect(result).toEqual({
      matchedPatterns: ['inline-code', 'short-text-penalty', 'single-line-penalty'],
      score: -4,
      shouldAutoConvert: false,
    });
  });

  it('should keep short single-line markdown-looking text below the default threshold', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.getMarkdownDetectionResult('# Title');

    expect(result).toEqual({
      matchedPatterns: ['headers', 'short-text-penalty', 'single-line-penalty'],
      score: 0,
      shouldAutoConvert: false,
    });
  });

  it('should respect a custom auto-convert threshold', () => {
    const plugin = new MarkdownPlugin(createKernelMock(), {
      pasteMarkdownAutoConvertThreshold: 11,
    }) as any;

    const result = plugin.getMarkdownDetectionResult('# Title\n\nBody paragraph');

    expect(result).toEqual({
      matchedPatterns: ['headers', 'multi-paragraph'],
      score: 10,
      shouldAutoConvert: false,
    });
  });

  it('should detect task list markdown as strong enough to auto convert', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.getMarkdownDetectionResult('- [x] done\n- [ ] todo');

    expect(result).toEqual({
      matchedPatterns: ['task-lists', 'unordered-lists'],
      score: 5,
      shouldAutoConvert: true,
    });
  });

  it('should never auto convert content that is classified as code', () => {
    const plugin = new MarkdownPlugin(createKernelMock()) as any;

    const result = plugin.getMarkdownDetectionResult('const value = 1;\nconsole.log(value);');

    expect(result).toEqual({
      matchedPatterns: [],
      score: 0,
      shouldAutoConvert: false,
    });
  });

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
