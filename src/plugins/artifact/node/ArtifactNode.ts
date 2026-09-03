import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedArtifactNode = Spread<
  {
    html: string;
    title: string;
  },
  SerializedLexicalNode
>;

const DEFAULT_ARTIFACT_TITLE = 'Artifact';

export class ArtifactNode extends DecoratorNode<unknown> {
  static getType(): string {
    return 'artifact';
  }

  static clone(node: ArtifactNode): ArtifactNode {
    return new ArtifactNode(node.__html, node.__title, node.__key);
  }

  static importJSON(serializedNode: SerializedArtifactNode): ArtifactNode {
    return $createArtifactNode(serializedNode.html, serializedNode.title).updateFromJSON(
      serializedNode,
    );
  }

  static importDOM(): DOMConversionMap | null {
    return {
      figure: (node) => {
        if (!(node instanceof HTMLElement) || node.dataset.artifact !== 'true') return null;
        return { conversion: $convertArtifactElement, priority: 2 };
      },
    };
  }

  private __html: string;
  private __title: string;

  constructor(html = '', title = DEFAULT_ARTIFACT_TITLE, key?: NodeKey) {
    super(key);
    this.__html = html;
    this.__title = title;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    // The React decorator owns the artifact surface and its spacing. Keeping
    // the Lexical decorator host unstyled is important: applying the same
    // artifact class to both layers gives the host its own block margins, so
    // the block controller measures a box above the visible header. The host
    // still receives `data-block-id` from BlockPlugin and remains the stable
    // Lexical anchor; only the nested React view should carry artifact styles.
    return element;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(ArtifactNode.getType());
    if (!decorator) return null;
    return typeof decorator === 'function'
      ? decorator(this, editor)
      : decorator.render(this, editor);
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('figure');
    element.dataset.artifact = 'true';
    element.dataset.title = this.__title;
    const source = document.createElement('pre');
    source.textContent = this.__html;
    element.append(source);
    return { element };
  }

  exportJSON(): SerializedArtifactNode {
    return {
      ...super.exportJSON(),
      html: this.getHtml(),
      title: this.getTitle(),
      type: ArtifactNode.getType(),
      version: 1,
    };
  }

  getHtml(): string {
    // Decorator props are immutable node snapshots and are read during React render,
    // outside a Lexical read/update scope. Read the snapshot directly, matching
    // CodeMirrorNode's React-facing getters.
    return this.__html;
  }

  getTextContent(): string {
    return '\n';
  }

  getTitle(): string {
    return this.__title;
  }

  isInline(): false {
    return false;
  }

  setHtml(html: string): this {
    this.getWritable().__html = html;
    return this;
  }

  setTitle(title: string): this {
    this.getWritable().__title = title;
    return this;
  }

  updateDOM(): false {
    return false;
  }
}

export function $createArtifactNode(html = '', title = DEFAULT_ARTIFACT_TITLE): ArtifactNode {
  return $applyNodeReplacement(new ArtifactNode(html, title));
}

export function $isArtifactNode(node: LexicalNode | null | undefined): node is ArtifactNode {
  return node?.getType() === ArtifactNode.getType();
}

function $convertArtifactElement(element: HTMLElement): DOMConversionOutput {
  return {
    node: $createArtifactNode(
      element.querySelector(':scope > pre')?.textContent || '',
      element.dataset.title || DEFAULT_ARTIFACT_TITLE,
    ),
  };
}
