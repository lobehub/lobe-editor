import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { chartStateFromSource, getChartSource, resolveChartNodeState } from '../utils/serialize';
import type { ChartSpec } from '../utils/spec';

export type SerializedChartNode = Spread<
  {
    raw?: string;
    spec: ChartSpec | null;
  },
  SerializedLexicalNode
>;

const CHART_DATA_ATTRIBUTE = 'data-lexical-chart';

export class ChartNode extends DecoratorNode<unknown> {
  __spec: ChartSpec | null;
  __raw: string;

  static getType(): string {
    return 'chart';
  }

  static clone(node: ChartNode): ChartNode {
    return new ChartNode(node.__spec, node.__raw, node.__key);
  }

  static importJSON(serializedNode: SerializedChartNode): ChartNode {
    return $createChartNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute(CHART_DATA_ATTRIBUTE)) return null;
        return { conversion: $convertChartElement, priority: 2 };
      },
    };
  }

  constructor(spec: ChartSpec | null = null, raw: string = '', key?: NodeKey) {
    super(key);
    this.__spec = spec;
    this.__raw = spec ? '' : raw;
  }

  get spec(): ChartSpec | null {
    return this.getLatest().__spec;
  }

  get raw(): string {
    return this.getLatest().__raw;
  }

  getSource(): string {
    const latest = this.getLatest();
    return getChartSource({ raw: latest.__raw, spec: latest.__spec });
  }

  setSource(source: string): this {
    const { raw, spec } = chartStateFromSource(source);
    const writable = this.getWritable();
    writable.__spec = spec;
    writable.__raw = raw;
    return writable;
  }

  setSpec(spec: ChartSpec): this {
    const writable = this.getWritable();
    writable.__spec = spec;
    writable.__raw = '';
    return writable;
  }

  exportJSON(): SerializedChartNode {
    const json: SerializedChartNode = { ...super.exportJSON(), spec: this.__spec };
    if (!this.__spec) json.raw = this.__raw;
    return json;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedChartNode>): this {
    const node = super.updateFromJSON(serializedNode);
    const { raw, spec } = resolveChartNodeState(serializedNode);
    node.__spec = spec;
    node.__raw = raw;
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute(CHART_DATA_ATTRIBUTE, this.getSource());
    element.textContent = this.__spec?.title ?? '';
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.chart);
    return element;
  }

  getTextContent(): string {
    return '\n';
  }

  isInline(): false {
    return false;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(ChartNode.getType());
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

function $convertChartElement(domNode: HTMLElement): DOMConversionOutput {
  return { node: $createChartNodeFromSource(domNode.getAttribute(CHART_DATA_ATTRIBUTE) ?? '') };
}

export function $createChartNode(spec: ChartSpec | null = null, raw: string = ''): ChartNode {
  return $applyNodeReplacement(new ChartNode(spec, raw));
}

export function $createChartNodeFromSource(source: string): ChartNode {
  const { raw, spec } = chartStateFromSource(source);
  return $createChartNode(spec, raw);
}

export function $isChartNode(node: LexicalNode | null | undefined): node is ChartNode {
  return node instanceof ChartNode;
}
