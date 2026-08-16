import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
} from 'lexical';
import { $applyNodeReplacement } from 'lexical';

import type { LinkCardPayload, SerializedLinkCardNode } from './LinkCardNode';
import { LinkCardNode } from './LinkCardNode';

export class LinkBlockCardNode extends LinkCardNode {
  static getType(): string {
    return 'link-block-card';
  }

  static clone(node: LinkBlockCardNode): LinkBlockCardNode {
    return new LinkBlockCardNode(
      node.__url,
      node.__title,
      node.__icon,
      node.__description,
      node.__openTarget,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedLinkCardNode): LinkBlockCardNode {
    return $createLinkBlockCardNode({
      description: serializedNode.description,
      icon: serializedNode.icon,
      openTarget: serializedNode.openTarget,
      title: serializedNode.title,
      url: serializedNode.url,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (node) => {
        if (
          node instanceof HTMLAnchorElement &&
          node.dataset.linkCard === 'true' &&
          node.dataset.linkCardLayout === 'block'
        ) {
          return {
            conversion: $convertLinkBlockCardElement,
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  constructor(
    url: string,
    title?: string,
    icon?: string,
    description?: string,
    openTarget?: null | string,
    key?: NodeKey,
  ) {
    super(url, title, icon, description, openTarget, key);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = super.createDOM(config, editor);
    element.dataset.linkCardLayout = 'block';
    return element;
  }

  exportDOM(): DOMExportOutput {
    const output = super.exportDOM();
    if (output.element instanceof HTMLElement) {
      output.element.dataset.linkCardLayout = 'block';
    }
    return output;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedLinkCardNode>): this {
    return super.updateFromJSON(serializedNode);
  }

  isInline(): false {
    return false;
  }
}

export function $createLinkBlockCardNode(payload: LinkCardPayload): LinkBlockCardNode {
  return $applyNodeReplacement(
    new LinkBlockCardNode(
      payload.url,
      payload.title,
      payload.icon,
      payload.description,
      payload.openTarget,
    ),
  );
}

function $convertLinkBlockCardElement(domNode: Node): DOMConversionOutput {
  const element = domNode as HTMLAnchorElement;
  return {
    node: $createLinkBlockCardNode({
      description: element.dataset.description,
      icon: element.dataset.icon,
      openTarget: element.getAttribute('target'),
      title: element.textContent || element.href,
      url: element.getAttribute('href') || '',
    }),
  };
}

export function $isLinkBlockCardNode(
  node: LexicalNode | null | undefined,
): node is LinkBlockCardNode {
  return node instanceof LinkBlockCardNode || node?.getType?.() === LinkBlockCardNode.getType();
}
