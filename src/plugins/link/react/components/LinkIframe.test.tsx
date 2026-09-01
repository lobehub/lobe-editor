import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DefaultLinkIframe } from './LinkIframe';

const renderIframe = (isLoading: boolean) =>
  renderToStaticMarkup(
    <DefaultLinkIframe
      isEditable
      isLoading={isLoading}
      isSelected={false}
      onLoad={vi.fn()}
      onMouseDownCapture={vi.fn()}
      src="https://example.com/embed"
      title="Embed"
      url="https://example.com"
    />,
  );

describe('DefaultLinkIframe', () => {
  it('keeps a lazy iframe in layout while loading', () => {
    const markup = renderIframe(true);

    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('display:block');
    expect(markup).toContain('visibility:hidden');
    expect(markup).not.toContain('display:none');
  });

  it('reveals the iframe after loading', () => {
    const markup = renderIframe(false);

    expect(markup).toContain('visibility:visible');
    expect(markup).not.toContain('Loading embed...');
  });
});
