import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  type LexicalEditor,
  createEditor,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import {
  getLinkToolbarCapabilities,
  replaceWithBlockIframeNode,
  replaceWithCardNode,
  replaceWithIframeNode,
  replaceWithInlineNode,
} from '../conversion';
import { LinkCardNode } from '../node/LinkCardNode';
import { LinkIframeNode } from '../node/LinkIframeNode';
import { LinkNode } from '../node/LinkNode';
import { SchemaNode } from '../node/SchemaNode';
import { LinkService } from '../service/i-link-service';

async function readCapabilities(
  callback: (editor: LexicalEditor) => ReturnType<typeof getLinkToolbarCapabilities>,
) {
  const lexicalEditor = createEditor({
    nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
  });
  let capabilities: ReturnType<typeof getLinkToolbarCapabilities> | undefined;

  await lexicalEditor.update(() => {
    capabilities = callback(lexicalEditor);
  });

  return capabilities;
}

describe('link toolbar conversions', () => {
  it('shows card and iframe conversion for matching regular links', async () => {
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        allowIframe: true,
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new LinkNode('https://lobehub.com', { title: 'LobeHub' }),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToCard: true,
      canConvertToIframe: true,
      canConvertToLink: false,
      canConvertToSchema: false,
    });
  });

  it('shows schema conversion only for matching schema links', async () => {
    const linkService = new LinkService();
    linkService.setSchemaRules([
      {
        id: 'alipay',
        match: (url) => url.startsWith('alipay://'),
      },
    ]);

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new LinkNode('alipay://pay/2088', { title: 'Pay' }),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToCard: false,
      canConvertToIframe: false,
      canConvertToLink: false,
      canConvertToSchema: true,
    });
  });

  it('allows card and iframe to convert to each other and back to link', async () => {
    const linkService = new LinkService();

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new LinkCardNode('https://lobehub.com', 'LobeHub'),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToCard: false,
      canConvertToIframe: true,
      canConvertToLink: true,
      canConvertToSchema: false,
    });

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new LinkIframeNode('https://lobehub.com', undefined, 'LobeHub'),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToCard: true,
      canConvertToIframe: false,
      canConvertToLink: true,
      canConvertToSchema: false,
    });
  });

  it('allows schema nodes to convert back only to link', async () => {
    const linkService = new LinkService();

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new SchemaNode('schema://card/123', 'card', { id: 123 }, 'Schema card'),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToCard: false,
      canConvertToIframe: false,
      canConvertToLink: true,
      canConvertToSchema: false,
    });
  });

  it('replaces an empty paragraph wrapper when converting a card to iframe', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const cardNode = new LinkCardNode('https://lobehub.com', 'LobeHub');
      paragraph.append(cardNode);
      $getRoot().append(paragraph);

      replaceWithBlockIframeNode(
        cardNode,
        new LinkIframeNode('https://lobehub.com', 'https://lobehub.com', 'LobeHub'),
      );
    });

    let rootChildrenTypes: string[] = [];
    await lexicalEditor.getEditorState().read(() => {
      rootChildrenTypes = $getRoot()
        .getChildren()
        .map((node) => node.getType());
    });

    expect(rootChildrenTypes).toEqual(['link-iframe']);
  });

  it('converts a regular link node to a card node', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        getCardPayload: (url) => ({ title: 'Card title', url }),
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'LobeHub' });
      linkNode.append($createTextNode('LobeHub'));
      paragraph.append(linkNode);
      $getRoot().append(paragraph);

      replaceWithCardNode(linkNode, lexicalEditor, linkService);
    });

    let childType = '';
    let title = '';
    await lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const child = paragraph.getChildren()[0];
      childType = child.getType();
      title = child.getTextContent();
    });

    expect(childType).toBe('link-card');
    expect(title).toBe('Card title');
  });

  it('converts a regular link node to a block iframe node', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowIframe: true,
        getIframePayload: (url) => ({ src: `${url}/embed`, title: 'Iframe title', url }),
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'LobeHub' });
      linkNode.append($createTextNode('LobeHub'));
      paragraph.append(linkNode);
      $getRoot().append(paragraph);

      replaceWithIframeNode(linkNode, lexicalEditor, linkService);
    });

    let rootChildrenTypes: string[] = [];
    let textContent = '';
    await lexicalEditor.getEditorState().read(() => {
      const child = $getRoot().getFirstChildOrThrow();
      rootChildrenTypes = $getRoot()
        .getChildren()
        .map((node) => node.getType());
      textContent = child.getTextContent();
    });

    expect(rootChildrenTypes).toEqual(['link-iframe']);
    expect(textContent).toBe('Iframe title');
  });

  it('splits a paragraph when converting an inline link in the middle to iframe', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowIframe: true,
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'LobeHub' });
      linkNode.append($createTextNode('LobeHub'));
      paragraph.append($createTextNode('before '), linkNode, $createTextNode(' after'));
      $getRoot().append(paragraph);

      replaceWithIframeNode(linkNode, lexicalEditor, linkService);
    });

    let rootChildrenTypes: string[] = [];
    let rootChildrenText: string[] = [];
    await lexicalEditor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      rootChildrenTypes = children.map((node) => node.getType());
      rootChildrenText = children.map((node) => node.getTextContent());
    });

    expect(rootChildrenTypes).toEqual(['paragraph', 'link-iframe', 'paragraph']);
    expect(rootChildrenText).toEqual(['before ', 'LobeHub', ' after']);
  });

  it('wraps a block iframe in a paragraph when converting to card', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    await lexicalEditor.update(() => {
      const iframeNode = new LinkIframeNode('https://lobehub.com', undefined, 'LobeHub');
      $getRoot().append(iframeNode);

      replaceWithCardNode(iframeNode, lexicalEditor, linkService);
    });

    let rootChildrenTypes: string[] = [];
    let paragraphChildrenTypes: string[] = [];
    await lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      rootChildrenTypes = $getRoot()
        .getChildren()
        .map((node) => node.getType());
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      paragraphChildrenTypes = paragraph.getChildren().map((node) => node.getType());
    });

    expect(rootChildrenTypes).toEqual(['paragraph']);
    expect(paragraphChildrenTypes).toEqual(['link-card']);
  });

  it('wraps a block iframe in a paragraph when converting to link', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });

    await lexicalEditor.update(() => {
      const iframeNode = new LinkIframeNode('https://lobehub.com', undefined, 'LobeHub');
      const linkNode = new LinkNode('https://lobehub.com', { title: 'LobeHub' });
      linkNode.append($createTextNode('LobeHub'));
      $getRoot().append(iframeNode);

      replaceWithInlineNode(iframeNode, linkNode);
    });

    let rootChildrenTypes: string[] = [];
    let paragraphChildrenTypes: string[] = [];
    await lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      rootChildrenTypes = $getRoot()
        .getChildren()
        .map((node) => node.getType());
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      paragraphChildrenTypes = paragraph.getChildren().map((node) => node.getType());
    });

    expect(rootChildrenTypes).toEqual(['paragraph']);
    expect(paragraphChildrenTypes).toEqual(['link']);
  });
});
