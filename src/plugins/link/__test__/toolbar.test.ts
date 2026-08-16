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
  replaceNodeByKeyWithCardNode,
  replaceWithBlockCardNode,
  replaceWithBlockIframeNode,
  replaceWithCardNode,
  replaceWithIframeNode,
  replaceWithInlineNode,
} from '../conversion';
import { LinkCardNode } from '../node/LinkCardNode';
import { LinkBlockCardNode } from '../node/LinkBlockCardNode';
import { LinkIframeNode } from '../node/LinkIframeNode';
import { LinkNode } from '../node/LinkNode';
import { SchemaNode } from '../node/SchemaNode';
import {
  readToolbarNode,
  shouldRunToolbarActionFromPointer,
} from '../react/components/LinkToolbar';
import { LinkService } from '../service/i-link-service';

async function readCapabilities(
  callback: (editor: LexicalEditor) => ReturnType<typeof getLinkToolbarCapabilities>,
) {
  const lexicalEditor = createEditor({
    nodes: [LinkNode, LinkCardNode, LinkBlockCardNode, LinkIframeNode, SchemaNode],
  });
  let capabilities: ReturnType<typeof getLinkToolbarCapabilities> | undefined;

  await lexicalEditor.update(() => {
    capabilities = callback(lexicalEditor);
  });

  return capabilities;
}

describe('link toolbar conversions', () => {
  it('uses the pointer path for primary mouse, touch, pen, and synthetic activation', () => {
    expect(shouldRunToolbarActionFromPointer({ button: 0, pointerType: 'mouse' })).toBe(true);
    expect(shouldRunToolbarActionFromPointer({ button: 0, pointerType: '' })).toBe(true);
    expect(shouldRunToolbarActionFromPointer({ button: 0, pointerType: 'touch' })).toBe(true);
    expect(shouldRunToolbarActionFromPointer({ button: -1, pointerType: 'pen' })).toBe(true);
    expect(shouldRunToolbarActionFromPointer({ button: 2, pointerType: 'touch' })).toBe(false);
  });

  it('does not read a stale node after the hovered node is replaced', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkBlockCardNode, LinkIframeNode, SchemaNode],
    });
    let iframeKey = '';

    await lexicalEditor.update(() => {
      const iframeNode = new LinkIframeNode('https://lobehub.com', undefined, 'LobeHub');
      iframeKey = iframeNode.getKey();
      $getRoot().append(iframeNode);
    });

    await lexicalEditor.update(() => {
      $getRoot()
        .getFirstChildOrThrow()
        .replace(new LinkBlockCardNode('https://lobehub.com', 'LobeHub'));
    });

    expect(readToolbarNode(lexicalEditor, iframeKey, (node) => node.getURL())).toBeNull();
  });

  it('shows card and iframe conversion for matching regular links', async () => {
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowBlockCard: true,
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
      canConvertToBlockCard: true,
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
      canConvertToBlockCard: false,
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
      canConvertToBlockCard: true,
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
      canConvertToBlockCard: true,
      canConvertToCard: true,
      canConvertToIframe: false,
      canConvertToLink: true,
      canConvertToSchema: false,
    });
  });

  it('allows a block card to convert to a title card, iframe, or link', async () => {
    const linkService = new LinkService();

    await expect(
      readCapabilities((editor) =>
        getLinkToolbarCapabilities(
          new LinkBlockCardNode('https://lobehub.com', 'LobeHub'),
          editor,
          linkService,
        ),
      ),
    ).resolves.toEqual({
      canConvertToBlockCard: false,
      canConvertToCard: true,
      canConvertToIframe: true,
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
      canConvertToBlockCard: false,
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

  it('converts a regular link node to a block card node', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkBlockCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowBlockCard: true,
        getCardPayload: (url) => ({ description: 'Description', title: 'Card title', url }),
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

      replaceWithBlockCardNode(linkNode, lexicalEditor, linkService);
    });

    lexicalEditor.getEditorState().read(() => {
      const card = $getRoot().getFirstChild();
      expect(card).toBeInstanceOf(LinkBlockCardNode);
      if (!(card instanceof LinkBlockCardNode)) return;
      expect(card.getTitle()).toBe('Card title');
      expect(card.getDescription()).toBe('Description');
      expect(card.isInline()).toBe(false);
    });
  });

  it('resolves asynchronous metadata when converting a link to a card', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        getCardPayload: async (url) => ({
          description: 'Fetched description',
          icon: 'https://lobehub.com/favicon.ico',
          title: 'Fetched title',
          url,
        }),
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    let linkKey = '';
    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'Original title' });
      linkNode.append($createTextNode('Original title'));
      linkKey = linkNode.getKey();
      paragraph.append(linkNode);
      $getRoot().append(paragraph);
    });

    await replaceNodeByKeyWithCardNode(lexicalEditor, linkKey, linkService);

    lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const card = paragraph.getFirstChild();
      expect(card).toBeInstanceOf(LinkCardNode);
      if (!(card instanceof LinkCardNode)) return;
      expect(card.getTitle()).toBe('Fetched title');
      expect(card.getDescription()).toBe('Fetched description');
      expect(card.getIcon()).toBe('https://lobehub.com/favicon.ico');
    });
  });

  it('converts immediately before asynchronous card metadata resolves', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    let resolveMetadata:
      ((payload: { description: string; title: string; url: string }) => void) | undefined;
    const metadata = new Promise<{ description: string; title: string; url: string }>((resolve) => {
      resolveMetadata = resolve;
    });
    linkService.setEmbedRules([
      {
        allowCard: true,
        getCardPayload: () => metadata,
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    let linkKey = '';
    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'Original title' });
      linkNode.append($createTextNode('Original title'));
      linkKey = linkNode.getKey();
      paragraph.append(linkNode);
      $getRoot().append(paragraph);
    });

    const conversion = replaceNodeByKeyWithCardNode(lexicalEditor, linkKey, linkService);

    let cardKey = '';
    lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const card = paragraph.getFirstChild();
      expect(card).toBeInstanceOf(LinkCardNode);
      if (!(card instanceof LinkCardNode)) return;
      cardKey = card.getKey();
      expect(card.getTitle()).toBe('Original title');
    });
    expect(linkService.isCardMetadataLoading(cardKey)).toBe(true);

    resolveMetadata?.({
      description: 'Fetched description',
      title: 'Fetched title',
      url: 'https://lobehub.com',
    });
    await conversion;

    lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) return;
      const card = paragraph.getFirstChild();
      expect(card).toBeInstanceOf(LinkCardNode);
      if (!(card instanceof LinkCardNode)) return;
      expect(card.getTitle()).toBe('Fetched title');
      expect(card.getDescription()).toBe('Fetched description');
    });
    expect(linkService.isCardMetadataLoading(cardKey)).toBe(false);
  });

  it('still converts when the metadata provider throws synchronously', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        getCardPayload: () => {
          throw new Error('metadata provider failed before returning a promise');
        },
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    let linkKey = '';
    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'Original title' });
      linkNode.append($createTextNode('Original title'));
      linkKey = linkNode.getKey();
      paragraph.append(linkNode);
      $getRoot().append(paragraph);
    });

    await replaceNodeByKeyWithCardNode(lexicalEditor, linkKey, linkService);

    lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) return;
      const card = paragraph.getFirstChild();
      expect(card).toBeInstanceOf(LinkCardNode);
      if (!(card instanceof LinkCardNode)) return;
      expect(card.getTitle()).toBe('Original title');
      expect(card.getURL()).toBe('https://lobehub.com');
    });
  });

  it('keeps the fallback card when asynchronous metadata fails', async () => {
    const lexicalEditor = createEditor({
      nodes: [LinkNode, LinkCardNode, LinkIframeNode, SchemaNode],
    });
    const linkService = new LinkService();
    linkService.setEmbedRules([
      {
        allowCard: true,
        getCardPayload: async () => {
          throw new Error('metadata unavailable');
        },
        id: 'web',
        match: (url) => /^https?:\/\//.test(url),
      },
    ]);

    let linkKey = '';
    await lexicalEditor.update(() => {
      const paragraph = $createParagraphNode();
      const linkNode = new LinkNode('https://lobehub.com', { title: 'Original title' });
      linkNode.append($createTextNode('Original title'));
      linkKey = linkNode.getKey();
      paragraph.append(linkNode);
      $getRoot().append(paragraph);
    });

    await replaceNodeByKeyWithCardNode(lexicalEditor, linkKey, linkService);

    lexicalEditor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($isElementNode(paragraph)).toBe(true);
      if (!$isElementNode(paragraph)) return;
      const card = paragraph.getFirstChild();
      expect(card).toBeInstanceOf(LinkCardNode);
      if (!(card instanceof LinkCardNode)) return;
      expect(card.getTitle()).toBe('Original title');
      expect(card.getURL()).toBe('https://lobehub.com');
    });
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
