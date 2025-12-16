/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedMentionNode = Spread<
  {
    label?: string;
    metadata?: Record<string, unknown>;
  },
  SerializedLexicalNode
>;

export class MentionNode extends DecoratorNode<any> {
  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__label, node.__metadata, node.__key);
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node) => {
        if (node.classList.contains('mention')) {
          return {
            conversion: $convertMentionElement,
            priority: 0,
          };
        }
        return null;
      },
    };
  }

  __label: string;
  __metadata: Record<string, unknown>;

  constructor(label: string = '', metadata: Record<string, unknown> = {}, key?: string) {
    super(key);
    this.__label = label;
    this.__metadata = metadata;
  }

  get label() {
    return this.__label;
  }

  get metadata() {
    return this.__metadata;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('span') };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    addClassNamesToElement(element, config.theme.mention);
    return element;
  }

  getTextContent(): string {
    return this.label;
  }

  isInline(): true {
    return true;
  }

  updateDOM(): boolean {
    return false;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      label: this.label,
      metadata: this.metadata,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMentionNode>): this {
    const node = super.updateFromJSON(serializedNode);
    this.__label = serializedNode.label || '';
    this.__metadata = serializedNode.metadata || {};
    return node;
  }

  decorate(editor: LexicalEditor): any {
    const decorator = getKernelFromEditor(editor)?.getDecorator(MentionNode.getType());
    if (!decorator) {
      return null;
    }
    if (typeof decorator === 'function') {
      return decorator(this, editor);
    }
    return {
      queryDOM: decorator.queryDOM,
      render: decorator.render(this, editor),
    };
  }
}

export function $createMentionNode(
  label?: string,
  metadata?: Record<string, unknown>,
): MentionNode {
  return $applyNodeReplacement(new MentionNode(label, metadata));
}

function $convertMentionElement(): DOMConversionOutput {
  return { node: $createMentionNode() };
}

export function $isMentionNode(node: LexicalNode): node is MentionNode {
  return node.getType() === MentionNode.getType();
}
