import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FileBody from '../FileBody';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  MaterialFileTypeIcon: ({ filename }: { filename: string }) => (
    <span data-icon={filename} data-testid="icon" />
  ),
}));

describe('FileBody', () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = async (props: Partial<Parameters<typeof FileBody>[0]> = {}) => {
    await act(async () => {
      root.render(
        <FileBody
          downloadLabel="Download"
          fileUrl="https://cdn/report"
          mimeType="application/pdf"
          name="report"
          previewLabel="Preview"
          size={42}
          {...props}
        />,
      );
    });
  };

  const action = (name: string) =>
    host.querySelector<HTMLAnchorElement>(`[data-file-action="${name}"]`)!;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
  });

  it('renders a type icon and download / preview anchors', async () => {
    await render();

    expect(host.querySelector('[data-testid="icon"]')?.getAttribute('data-icon')).toBe(
      'report.pdf',
    );
    expect(action('download').getAttribute('download')).toBe('report');
    expect(action('download').getAttribute('href')).toBe('https://cdn/report');
    expect(action('preview').getAttribute('target')).toBe('_blank');
  });

  it('hides actions without a file url', async () => {
    await render({ fileUrl: undefined });
    expect(host.querySelector('[data-file-actions]')).toBeNull();
  });

  it('calls custom handlers with the file payload', async () => {
    const onPreview = vi.fn();
    const onDownload = vi.fn();
    await render({ ext: 'pdf', onDownload, onPreview });

    await act(async () => {
      action('preview').click();
      action('download').click();
    });

    const payload = {
      ext: 'pdf',
      fileUrl: 'https://cdn/report',
      mimeType: 'application/pdf',
      name: 'report',
      size: 42,
    };
    expect(onPreview).toHaveBeenCalledWith(payload);
    expect(onDownload).toHaveBeenCalledWith(payload);
  });

  it('opens a new tab for the default preview', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await render();

    await act(async () => {
      action('preview').click();
    });

    expect(open).toHaveBeenCalledWith('https://cdn/report', '_blank', 'noopener,noreferrer');
  });

  it('triggers a download anchor for the default download', async () => {
    const clicks: HTMLAnchorElement[] = [];
    const original = HTMLAnchorElement.prototype.click;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      if (this.dataset.fileAction) return original.call(this);
      clicks.push(this);
    });
    await render();

    await act(async () => {
      action('download').click();
    });

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('report');
    expect(clicks[0].href).toBe('https://cdn/report');
    expect(clicks[0].isConnected).toBe(false);
  });
});
