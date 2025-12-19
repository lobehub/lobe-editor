/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  $applyNodeReplacement,
  DOMExportOutput,
  EditorConfig,
  ElementDOMSlot,
  LexicalEditor,
  LexicalUpdateJSON,
  SerializedElementNode,
  Spread,
} from 'lexical';

import {
  getKernelFromEditor,
  getKernelFromEditorConfig,
  reconcileDecorator,
} from '@/editor-kernel/utils';
import { CardLikeElementNode } from '@/plugins/common/node/cursor';

export type DiffType = 'add' | 'remove' | 'modify' | 'unchanged' | 'listItemModify';

export type SerializedDiffNode = Spread<
  {
    diffType: DiffType;
  },
  SerializedElementNode
>;

/** DiffNode - contains two block children: original and modified */
export class DiffNode extends CardLikeElementNode {
  static getType(): string {
    return 'diff';
  }

  static clone(node: DiffNode): DiffNode {
    return new DiffNode(node.__diffType, node.__key);
  }

  static importJSON(serializedNode: SerializedDiffNode): DiffNode {
    return $createDiffNode().updateFromJSON(serializedNode);
  }

  static importDOM(): null {
    // TODO: Should link node should handle the import over autolink?
    return null;
  }

  private __diffType: DiffType = 'unchanged';

  constructor(type: DiffType, key?: string) {
    super(key);
    this.__diffType = type;
  }

  get diffType(): DiffType {
    return this.__diffType;
  }

  setDiffType(type: DiffType): this {
    this.getWritable().__diffType = type;
    return this;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedDiffNode>): this {
    return super.updateFromJSON(serializedNode).setDiffType(serializedNode.diffType);
  }

  exportJSON(): SerializedDiffNode {
    return {
      ...super.exportJSON(),
      diffType: this.__diffType,
      type: 'diff',
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    return super.exportDOM(editor);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor) {
    const el = document.createElement('div');
    el.contentEditable = 'false';
    el.dataset.lexicalKey = this.getKey();
    el.dataset.diffType = this.__diffType;
    el.classList.add('ne-diff');
    if (config.theme.diffNode) {
      el.classList.add(config.theme.diffNode);
    }
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.dataset.lexicalDecorator = 'true';
    el.append(toolbar);

    const content = document.createElement('div');
    content.className = 'content';
    el.append(content);

    const decorator = getKernelFromEditor(editor)?.getDecorator('diff') || null;
    if (decorator) {
      if (typeof decorator === 'function') {
        reconcileDecorator(editor, this.getKey(), decorator(this, editor));
      } else {
        reconcileDecorator(editor, this.getKey(), {
          queryDOM: decorator.queryDOM,
          render: decorator.render(this, editor),
        });
      }
    }
    return el;
  }

  updateDOM(_prevNode: unknown, _dom: HTMLElement, _config: EditorConfig): boolean {
    if (_dom.dataset.diffType !== this.__diffType) {
      _dom.dataset.diffType = this.__diffType;
    }
    const kernel = getKernelFromEditorConfig(_config);
    const editor = kernel?.getLexicalEditor();
    if (editor) {
      const decorator = kernel?.getDecorator('diff') || null;
      if (decorator) {
        if (typeof decorator === 'function') {
          reconcileDecorator(editor, this.getKey(), decorator(this, editor));
        } else {
          reconcileDecorator(editor, this.getKey(), {
            queryDOM: decorator.queryDOM,
            render: decorator.render(this, editor),
          });
        }
      }
    }
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    return super.getDOMSlot(element).withElement(element.querySelector('.content') as HTMLElement);
  }

  isInline(): boolean {
    return false;
  }

  isCardLike(): boolean {
    return true;
  }
}

export function $createDiffNode(diffType: DiffType = 'unchanged'): DiffNode {
  return $applyNodeReplacement(new DiffNode(diffType));
}

export function $isDiffNode(node: unknown): node is DiffNode {
  return node instanceof DiffNode;
}
