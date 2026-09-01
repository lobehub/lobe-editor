import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DefaultLinkCard } from './LinkCard';

const renderCard = (isLoading: boolean) =>
  renderToStaticMarkup(
    <DefaultLinkCard
      description="Description"
      icon="https://example.com/favicon.ico"
      isLoading={isLoading}
      isSelected={false}
      layout="block"
      onClickCapture={vi.fn()}
      onMouseDownCapture={vi.fn()}
      openTarget="_blank"
      title="Example"
      url="https://example.com"
    />,
  );

describe('DefaultLinkCard', () => {
  it('shows a loading state while metadata is pending', () => {
    const markup = renderCard(true);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Loading link preview');
    expect(markup).toContain('Loading preview...');
  });

  it('shows resolved metadata after loading', () => {
    const markup = renderCard(false);

    expect(markup).toContain('Description');
    expect(markup).not.toContain('Loading preview...');
  });
});
