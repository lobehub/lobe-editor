import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ArtifactPreview from './ArtifactPreview';

describe('ArtifactPreview', () => {
  it('uses a strict iframe sandbox by default', () => {
    const markup = renderToStaticMarkup(
      <ArtifactPreview allowScripts={false} height={320} html="<h1>Hello</h1>" title="Demo" />,
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain('sandbox=""');
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).not.toContain('allow-top-navigation');
    expect(markup).not.toContain('allow-popups');
    expect(markup).not.toContain('allow-downloads');
    expect(markup).not.toContain('allow-forms');
  });

  it('grants only script execution when explicitly enabled', () => {
    const markup = renderToStaticMarkup(
      <ArtifactPreview allowScripts height={320} html="<script></script>" title="Demo" />,
    );

    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).not.toContain('allow-top-navigation');
    expect(markup).not.toContain('allow-popups');
    expect(markup).not.toContain('allow-downloads');
    expect(markup).not.toContain('allow-forms');
  });
});
