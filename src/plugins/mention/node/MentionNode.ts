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
    extra?: Record<string, unknown>;
    label?: string;
  },
  SerializedLexicalNode
>;

export class MentionNode extends DecoratorNode<any> {
  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__label, node.__extra, node.__key);
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
  __extra: Record<string, unknown>;

  constructor(label: string = '', extra: Record<string, unknown> = {}, key?: string) {
    super(key);
    this.__label = label;
    this.__extra = extra;
  }

  get label() {
    return this.__label;
  }

  get extra() {
    return this.__extra;
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
      extra: this.extra,
      label: this.label,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMentionNode>): this {
    const node = super.updateFromJSON(serializedNode);
    this.__label = serializedNode.label || '';
    this.__extra = serializedNode.extra || {};
    return node;
  }

  decorate(editor: LexicalEditor): any {
    return getKernelFromEditor(editor)?.getDecorator('mention')?.(this, editor) || null;
  }
}

export function $createMentionNode(label?: string, extra?: Record<string, unknown>): MentionNode {
  return $applyNodeReplacement(new MentionNode(label, extra));
}

function $convertMentionElement(): DOMConversionOutput {
  return { node: $createMentionNode() };
}

export function $isMentionNode(node: LexicalNode): node is MentionNode {
  return node.getType() === MentionNode.getType();
}
