import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel';

export type SerializedMeta2dNode = Spread<
  {
    diagram: string;
    svg: string;
  },
  SerializedLexicalNode
>;

export class Meta2dNode extends DecoratorNode<unknown> {
  static getType(): string {
    return 'meta2d';
  }

  static clone(node: Meta2dNode): Meta2dNode {
    return new Meta2dNode(node.__diagram, node.__svg, node.__key);
  }

  static importJSON(serializedNode: SerializedMeta2dNode): Meta2dNode {
    return new Meta2dNode(serializedNode.diagram, serializedNode.svg);
  }

  __diagram: string;
  __svg: string;

  constructor(diagram = '', svg = '', key?: string) {
    super(key);
    this.__diagram = diagram;
    this.__svg = svg;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.meta2d ?? 'editor-meta2d');
    return element;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(Meta2dNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') {
      return decorator(this, editor);
    }
    return {
      queryDOM: decorator.queryDOM,
      render: decorator.render(this, editor),
    };
  }

  exportJSON(): SerializedMeta2dNode {
    return {
      ...super.exportJSON(),
      diagram: this.__diagram,
      svg: this.__svg,
    };
  }

  getTextContent(): string {
    return `---meta2d---\n${this.__diagram}\n---/meta2d---\n`;
  }

  isInline(): boolean {
    return false;
  }

  updateDiagram(diagram: string, svg: string) {
    const writer = this.getWritable();
    writer.__diagram = diagram;
    writer.__svg = svg;
  }

  updateDOM(): boolean {
    return false;
  }
}

export function $createMeta2dNode(diagram = '', svg = ''): Meta2dNode {
  return $applyNodeReplacement(new Meta2dNode(diagram, svg));
}

export function $isMeta2dNode(node: LexicalNode): node is Meta2dNode {
  return node instanceof Meta2dNode;
}
