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

import { getKernelFromEditor } from '@/editor-kernel';

export type SerializedMathInlineNode = Spread<
  {
    code: string;
  },
  SerializedLexicalNode
>;

export class MathInlineNode extends DecoratorNode<unknown> {
  static getType(): string {
    return 'math';
  }

  static clone(node: MathInlineNode): MathInlineNode {
    return new MathInlineNode(node.__code, node.__key);
  }

  static importJSON(serializedNode: SerializedMathInlineNode): MathInlineNode {
    return $createMathInlineNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node) => {
        if (node.classList.contains('math-inline')) {
          return {
            conversion: $convertMathInlineElement,
            priority: 0,
          };
        }
        return null;
      },
    };
  }

  __code: string;

  constructor(code = '', key?: string) {
    super(key);
    this.__code = code;
  }

  get code() {
    return this.__code;
  }

  updateCode(newCode: string) {
    const writer = this.getWritable();
    writer.__code = newCode;
  }

  exportDOM(): DOMExportOutput {
    const span = document.createElement('span');
    span.className = 'math-inline';
    return { element: span };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    addClassNamesToElement(element, config.theme.mathInline);
    return element;
  }

  exportJSON(): SerializedMathInlineNode {
    return {
      ...super.exportJSON(),
      code: this.__code,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMathInlineNode>): this {
    const node = super.updateFromJSON(serializedNode);
    this.__code = serializedNode.code || '';
    return node;
  }

  getTextContent(): string {
    return `$${this.code}$`;
  }

  isInline(): boolean {
    return true;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(MathInlineNode.getType());
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

export class MathBlockNode extends DecoratorNode<unknown> {
  static getType(): string {
    return 'mathBlock';
  }

  static clone(node: MathBlockNode): MathBlockNode {
    return new MathBlockNode(node.__code, node.__key);
  }

  static importJSON(serializedNode: SerializedMathInlineNode): MathBlockNode {
    return $createMathBlockNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (node) => {
        if (node.classList.contains('math-block')) {
          return {
            conversion: $convertMathBlockElement,
            priority: 0,
          };
        }
        return null;
      },
    };
  }

  __code: string;

  constructor(code = '', key?: string) {
    super(key);
    this.__code = code;
  }

  get code() {
    return this.__code;
  }

  updateCode(newCode: string) {
    const writer = this.getWritable();
    writer.__code = newCode;
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement('div');
    div.className = 'math-block';
    return { element: div };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.mathBlock);
    return element;
  }

  exportJSON(): SerializedMathInlineNode {
    return {
      ...super.exportJSON(),
      code: this.__code,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMathInlineNode>): this {
    const node = super.updateFromJSON(serializedNode);
    this.__code = serializedNode.code || '';
    return node;
  }

  getTextContent(): string {
    return `$$\n${this.code}\n$$\n`;
  }

  isInline(): boolean {
    return false;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(MathBlockNode.getType());
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

export function $createMathInlineNode(code = '') {
  return $applyNodeReplacement(new MathInlineNode(code));
}

export function $createMathBlockNode(code = '') {
  return $applyNodeReplacement(new MathBlockNode(code));
}

export function $convertMathInlineElement(): DOMConversionOutput {
  return { node: $createMathInlineNode() };
}

export function $convertMathBlockElement(): DOMConversionOutput {
  return { node: $createMathBlockNode() };
}

export function $isMathNode(node: LexicalNode): node is MathInlineNode | MathBlockNode {
  return node instanceof MathInlineNode || node instanceof MathBlockNode;
}
