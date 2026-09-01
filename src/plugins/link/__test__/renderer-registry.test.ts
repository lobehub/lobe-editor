import { describe, expect, it, vi } from 'vitest';

import { LinkReactRendererRegistry, splitReactSchemaRules } from '../react/renderer-registry';

describe('link react renderer registry', () => {
  it('splits react schema rules into aligned core rules and renderers by id', () => {
    const render = vi.fn(() => 'schema-render');
    const { coreRules, schemaRenderers } = splitReactSchemaRules([
      {
        id: 'schema-card',
        match: (url) => url.startsWith('schema://'),
        render,
      },
    ]);

    expect(coreRules?.[0]).toEqual({
      id: 'schema-card',
      match: expect.any(Function),
    });
    expect(schemaRenderers.get(coreRules?.[0].id || '')).toBe(render);
  });

  it('renders schema nodes by the schemaType id from split rules', () => {
    const render = vi.fn(() => 'schema-render');
    const { schemaRenderers } = splitReactSchemaRules([
      {
        id: 'schema-card',
        match: (url) => url.startsWith('schema://'),
        render,
      },
    ]);
    const registry = new LinkReactRendererRegistry();
    registry.update({ schemaRenderers });

    expect(
      registry.renderSchemaNode({
        editor: {} as any,
        node: {} as any,
        payload: null,
        schema: null,
        schemaType: 'schema-card',
        title: 'Schema card',
        url: 'schema://card/123',
      }),
    ).toBe('schema-render');
    expect(render).toHaveBeenCalledOnce();
  });
});
