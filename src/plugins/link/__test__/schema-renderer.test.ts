import { describe, expect, it, vi } from 'vitest';

import { LinkService } from '../service/i-link-service';

describe('schema link renderer', () => {
  it('matches schema renderer protocols with or without url separators', () => {
    const render = vi.fn();
    const linkService = new LinkService();

    linkService.setSchemaLinkRenderers([{ protocol: 'schema://', render }]);

    expect(linkService.getSchemaLinkRenderer('schema://card/123')).toBe(render);
    expect(linkService.getSchemaLinkRenderer('http://example.com')).toBeNull();
  });

  it('allows custom protocols to be configured for sanitization', () => {
    const linkService = new LinkService();

    linkService.setAllowedProtocols(['schema://']);

    expect(linkService.getAllowedProtocols().has('schema:')).toBe(true);
  });
});
