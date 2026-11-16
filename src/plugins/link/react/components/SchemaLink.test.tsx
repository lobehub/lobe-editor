import { $getRoot, createEditor } from 'lexical';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { $createSchemaNode, SchemaNode } from '../../node/SchemaNode';
import { LinkReactRendererRegistry } from '../renderer-registry';
import SchemaLink from './SchemaLink';

describe('SchemaLink', () => {
  it('renders the latest node state outside a Lexical read context', () => {
    const editor = createEditor({ nodes: [SchemaNode] });
    let node!: SchemaNode;
    editor.update(
      () => {
        node = $createSchemaNode({ schemaType: 'card', title: 'Original', url: 'schema://card' });
        $getRoot().append(node);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        node.setTitle('Updated card');
      },
      { discrete: true },
    );

    const markup = renderToStaticMarkup(
      <SchemaLink editor={editor} node={node} rendererRegistry={new LinkReactRendererRegistry()} />,
    );

    expect(markup).toContain('href="schema://card"');
    expect(markup).toContain('Updated card');
    expect(markup).not.toContain('Original');
  });

  it('passes schema data to the custom renderer outside a Lexical read context', () => {
    const editor = createEditor({ nodes: [SchemaNode] });
    const rendererRegistry = new LinkReactRendererRegistry();
    let node!: SchemaNode;
    editor.update(
      () => {
        node = $createSchemaNode({
          payload: { id: '123' },
          schemaType: 'alipay',
          title: 'Alipay action',
          url: 'alipay://action',
        });
        $getRoot().append(node);
      },
      { discrete: true },
    );
    rendererRegistry.update({
      renderSchema: ({ payload, schemaType, title, url }) => (
        <a href={url}>
          {title} / {schemaType} / {JSON.stringify(payload)}
        </a>
      ),
    });

    const markup = renderToStaticMarkup(
      <SchemaLink editor={editor} node={node} rendererRegistry={rendererRegistry} />,
    );

    expect(markup).toContain('href="alipay://action"');
    expect(markup).toContain('Alipay action / alipay / {&quot;id&quot;:&quot;123&quot;}');
  });
});
