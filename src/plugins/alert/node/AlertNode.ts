import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementDOMSlot,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedElementNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, ElementNode, setDOMUnmanaged } from 'lexical';

export const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const DEFAULT_ALERT_TYPE: AlertType = 'note';

export type SerializedAlertNode = Spread<
  {
    alertType: AlertType;
  },
  SerializedElementNode
>;

export const ALERT_HEADER_SELECTOR = '[data-alert-header="true"]';
const CONTENT_SELECTOR = '[data-alert-content="true"]';

export function isAlertType(value: unknown): value is AlertType {
  return typeof value === 'string' && (ALERT_TYPES as readonly string[]).includes(value);
}

export function normalizeAlertType(value: unknown): AlertType {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : value;
  return isAlertType(lower) ? lower : DEFAULT_ALERT_TYPE;
}

export class AlertNode extends ElementNode {
  __alertType: AlertType;

  static getType(): string {
    return 'alert';
  }

  static clone(node: AlertNode): AlertNode {
    return new AlertNode(node.__alertType, node.__key);
  }

  static importJSON(serializedNode: SerializedAlertNode): AlertNode {
    return $createAlertNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (element) =>
        element.dataset.alertType
          ? {
              conversion: $convertAlertElement,
              priority: 1,
            }
          : null,
    };
  }

  constructor(alertType: AlertType = DEFAULT_ALERT_TYPE, key?: NodeKey) {
    super(key);
    this.__alertType = alertType;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.alert);
    element.dataset.alertType = this.__alertType;

    const header = document.createElement('div');
    header.contentEditable = 'false';
    header.dataset.alertHeader = 'true';
    setDOMUnmanaged(header);

    const content = document.createElement('div');
    content.dataset.alertContent = 'true';

    element.append(header, content);
    return element;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (prevNode.__alertType !== this.__alertType) {
      dom.dataset.alertType = this.__alertType;
    }
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const content = element.querySelector(CONTENT_SELECTOR);
    if (content instanceof HTMLElement) {
      return super.getDOMSlot(element).withElement(content);
    }
    return super.getDOMSlot(element);
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.dataset.alertType = this.getAlertType();
    return { element };
  }

  exportJSON(): SerializedAlertNode {
    return {
      ...super.exportJSON(),
      alertType: this.getAlertType(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedAlertNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setAlertType(normalizeAlertType(serializedNode.alertType));
  }

  getAlertType(): AlertType {
    return this.getLatest().__alertType;
  }

  setAlertType(alertType: AlertType): this {
    const writable = this.getWritable();
    writable.__alertType = alertType;
    return writable;
  }

  isShadowRoot(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canIndent(): boolean {
    return false;
  }
}

export function $createAlertNode(alertType: AlertType = DEFAULT_ALERT_TYPE): AlertNode {
  return $applyNodeReplacement(new AlertNode(alertType));
}

export function $isAlertNode(node: LexicalNode | null | undefined): node is AlertNode {
  return node instanceof AlertNode;
}

function $convertAlertElement(domNode: HTMLElement): DOMConversionOutput {
  return { node: $createAlertNode(normalizeAlertType(domNode.dataset.alertType)) };
}
