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
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from './LinkNode';

export interface SchemaNodePayload {
  payload?: unknown;
  schemaType?: string;
  title?: string;
  url: string;
}

export type SerializedSchemaNode = Spread<
  {
    payload?: unknown;
    schemaType: string;
    title: string;
    url: string;
  },
  SerializedLexicalNode
>;

export class SchemaNode extends DecoratorNode<unknown> {
  __url: string;
  __schemaType: string;
  __payload: unknown;
  __title: string;

  static getType(): string {
    return 'schema-link';
  }

  static clone(node: SchemaNode): SchemaNode {
    return new SchemaNode(node.__url, node.__schemaType, node.__payload, node.__title, node.__key);
  }

  static importJSON(serializedNode: SerializedSchemaNode): SchemaNode {
    return $createSchemaNode({
      payload: serializedNode.payload,
      schemaType: serializedNode.schemaType,
      title: serializedNode.title,
      url: serializedNode.url,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (node) => {
        if (node instanceof HTMLAnchorElement && node.dataset.schemaLink === 'true') {
          return {
            conversion: $convertSchemaElement,
            priority: 2,
          };
        }
        return null;
      },
    };
  }

  constructor(url: string, schemaType?: string, payload?: unknown, title?: string, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__schemaType = schemaType || '';
    this.__payload = payload;
    this.__title = title || url;
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('div');
    element.dataset.schemaLink = 'true';
    addClassNamesToElement(element, config.theme.schemaLink);
    element.addEventListener('mouseenter', (event) => {
      if (event.target instanceof HTMLElement) {
        event.target.classList.add('hover');
        editor.dispatchCommand(HOVER_LINK_COMMAND, {
          event: event as MouseEvent,
          node: this,
        });
      }
    });
    element.addEventListener('mouseleave', (event) => {
      if (event.target instanceof HTMLElement) {
        event.target.classList.remove('hover');
        editor.dispatchCommand(HOVER_OUT_LINK_COMMAND, {
          event: event as MouseEvent,
        });
      }
    });
    return element;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('a');
    element.dataset.schemaLink = 'true';
    element.dataset.schemaType = this.getSchemaType();
    element.dataset.payload = JSON.stringify(this.getPayload() ?? null);
    element.href = this.getURL();
    element.textContent = this.getTitle();
    return { element };
  }

  exportJSON(): SerializedSchemaNode {
    return {
      ...super.exportJSON(),
      payload: this.getPayload(),
      schemaType: this.getSchemaType(),
      title: this.getTitle(),
      url: this.getURL(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedSchemaNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setURL(serializedNode.url)
      .setSchemaType(serializedNode.schemaType)
      .setPayload(serializedNode.payload)
      .setTitle(serializedNode.title);
  }

  getTextContent(): string {
    return this.getTitle();
  }

  getURL(): string {
    return this.getLatest().__url;
  }

  setURL(url: string): this {
    const writable = this.getWritable();
    writable.__url = url;
    return writable;
  }

  getSchemaType(): string {
    return this.getLatest().__schemaType;
  }

  setSchemaType(schemaType?: string): this {
    const writable = this.getWritable();
    writable.__schemaType = schemaType || '';
    return writable;
  }

  getPayload(): unknown {
    return this.getLatest().__payload;
  }

  setPayload(payload: unknown): this {
    const writable = this.getWritable();
    writable.__payload = payload;
    return writable;
  }

  getTitle(): string {
    return this.getLatest().__title || this.getURL();
  }

  setTitle(title?: string): this {
    const writable = this.getWritable();
    writable.__title = title || this.getURL();
    return writable;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(SchemaNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return decorator.render(this, editor);
  }
}

export function $createSchemaNode(payload: SchemaNodePayload): SchemaNode {
  return $applyNodeReplacement(
    new SchemaNode(payload.url, payload.schemaType, payload.payload, payload.title),
  );
}

function $convertSchemaElement(domNode: Node): DOMConversionOutput {
  const element = domNode as HTMLAnchorElement;
  return {
    node: $createSchemaNode({
      payload: parsePayload(element.dataset.payload),
      schemaType: element.dataset.schemaType,
      title: element.textContent || element.href,
      url: element.getAttribute('href') || '',
    }),
  };
}

function parsePayload(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function $isSchemaNode(node: LexicalNode | null | undefined): node is SchemaNode {
  return node instanceof SchemaNode || node?.getType?.() === SchemaNode.getType();
}
