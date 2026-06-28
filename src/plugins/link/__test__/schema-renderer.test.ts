import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  type LexicalEditor,
  createEditor,
} from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import { LinkNode } from '../node/LinkNode';
import { SchemaNode } from '../node/SchemaNode';
import { normalizeSchemaLinkNode } from '../plugin';
import { LinkService } from '../service/i-link-service';

const editor = {} as LexicalEditor;

describe('link display rules', () => {
  it('matches generic and amap embed rules by configuration', () => {
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        allowIframe: true,
        id: 'amap',
        match: (url) => url.includes('uri.amap.com'),
      },
      {
        allowCard: true,
        id: 'generic',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    const context = { editor, text: 'map', title: 'map' };

    expect(linkService.getEmbedRule('https://uri.amap.com/marker', context)?.id).toBe('amap');
    expect(linkService.getEmbedRule('https://lobehub.com', context)?.id).toBe('generic');
    expect(linkService.getEmbedRule('schema://card/123', context)).toBeNull();
  });

  it('matches schema rules for schema and custom protocols', () => {
    const linkService = new LinkService();
    linkService.setSchemaRules([
      {
        id: 'schema',
        match: (url) => url.startsWith('schema://'),
      },
      {
        id: 'alipay',
        match: (url) => url.startsWith('alipay://'),
      },
    ]);

    const context = { editor, text: 'pay', title: 'pay' };

    expect(linkService.getSchemaRule('schema://card/123', context)?.id).toBe('schema');
    expect(linkService.getSchemaRule('alipay://pay/2088', context)?.id).toBe('alipay');
    expect(linkService.getSchemaRule('https://lobehub.com', context)).toBeNull();
  });

  it('parses schema url details for renderers', () => {
    const linkService = new LinkService();
    const schema = linkService.parseSchemaUrl('schema://card/123?source=demo#top');

    expect(schema).toEqual({
      hash: '#top',
      host: 'card',
      params: { source: 'demo' },
      pathname: '/123',
      protocol: 'schema:',
      raw: 'schema://card/123?source=demo#top',
      search: '?source=demo',
    });
  });

  it('allows custom protocols to be configured for sanitization', () => {
    const linkService = new LinkService();

    linkService.setAllowedProtocols(['schema://', 'alipay:']);

    expect(linkService.getAllowedProtocols().has('schema:')).toBe(true);
    expect(linkService.getAllowedProtocols().has('alipay:')).toBe(true);
  });

  it('keeps toolbar base enabled separate from suppression tokens', () => {
    const linkService = new LinkService();
    const handleChange = vi.fn();
    linkService.on('linkToolbarChange', handleChange);

    const token = linkService.suppressLinkToolbar('test-toolbar');
    expect(linkService.enableLinkToolbar).toBe(false);
    expect(handleChange).toHaveBeenLastCalledWith(false);

    linkService.setLinkToolbar(true);
    expect(linkService.enableLinkToolbar).toBe(false);

    linkService.restoreLinkToolbar(token);
    expect(linkService.enableLinkToolbar).toBe(true);
    expect(handleChange).toHaveBeenLastCalledWith(true);

    linkService.setLinkToolbar(false);
    expect(linkService.enableLinkToolbar).toBe(false);
    const secondToken = linkService.suppressLinkToolbar('second-toolbar');
    linkService.restoreLinkToolbar(secondToken);
    expect(linkService.enableLinkToolbar).toBe(false);

    linkService.setLinkToolbar(true);
    expect(linkService.enableLinkToolbar).toBe(true);
  });

  it('keeps legacy schema renderer protocol matching available', () => {
    const linkService = new LinkService();

    linkService.setSchemaLinkRenderers([{ protocol: 'schema://' }]);

    expect(linkService.hasSchemaLinkRenderer('schema://card/123')).toBe(true);
    expect(linkService.hasSchemaLinkRenderer('https://lobehub.com')).toBe(false);
  });

  it('updates protocol, schema rules, and legacy renderers through service config', () => {
    const linkService = new LinkService();

    linkService.updateConfig({
      allowedProtocols: ['alipay://'],
      schemaLinkRenderers: [{ protocol: 'schema://' }],
      schemaRules: [
        {
          id: 'alipay',
          match: (url) => url.startsWith('alipay://'),
        },
      ],
    });

    const context = { editor, text: 'pay', title: 'pay' };
    expect(linkService.getAllowedProtocols().has('alipay:')).toBe(true);
    expect(linkService.getAllowedProtocols().has('schema:')).toBe(true);
    expect(linkService.hasSchemaLinkRenderer('schema://card/123')).toBe(true);
    expect(linkService.getSchemaRule('schema://card/123', context)?.id).toBe('schema');
    expect(linkService.getSchemaRule('alipay://pay/2088', context)?.id).toBe('alipay');
  });

  it('converts legacy schema renderer links to schema nodes automatically', async () => {
    const linkService = new LinkService();
    const lexicalEditor = createEditor({
      nodes: [LinkNode, SchemaNode],
    });
    linkService.setSchemaLinkRenderers([{ protocol: 'schema://' }]);
    linkService.setSchemaRules([
      {
        id: 'schema',
        match: (url) => url.startsWith('schema://'),
      },
    ]);

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('schema://card/123', {
        rel: 'noreferrer',
        target: '_blank',
        title: 'Schema title',
      });
      linkNode.append($createTextNode('Schema card'));
      paragraph.append(linkNode);
      $getRoot().append(paragraph);

      expect(normalizeSchemaLinkNode(linkNode, lexicalEditor, linkService)).toBe(true);
    });

    let childType = '';
    let schemaTitle = '';
    await lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const schemaNode = paragraph.getChildren()[0];
      childType = schemaNode.getType();
      schemaTitle = schemaNode.getTextContent();
    });

    expect(childType).toBe('schema-link');
    expect(schemaTitle).toBe('Schema title');
  });

  it('normalizes schema rule links without legacy renderer registration', async () => {
    const linkService = new LinkService();
    const lexicalEditor = createEditor({
      nodes: [LinkNode, SchemaNode],
    });
    linkService.setSchemaRules([
      {
        id: 'alipay',
        match: (url) => url.startsWith('alipay://'),
      },
    ]);

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('alipay://pay/2088?amount=10', {
        title: 'Pay now',
      });
      linkNode.append($createTextNode('Pay'));
      paragraph.append(linkNode);
      $getRoot().append(paragraph);

      expect(normalizeSchemaLinkNode(linkNode, lexicalEditor, linkService)).toBe(true);
    });

    let childType = '';
    let schemaTitle = '';
    await lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const schemaNode = paragraph.getChildren()[0];
      childType = schemaNode.getType();
      schemaTitle = schemaNode.getTextContent();
    });

    expect(childType).toBe('schema-link');
    expect(schemaTitle).toBe('Pay now');
  });
});
