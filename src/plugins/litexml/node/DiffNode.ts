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

export type SerializedDiffNode = Spread<
  {
    apply?: boolean;
  },
  SerializedElementNode
>;

/** DiffNode - contains two block children: original and modified */
export class DiffNode extends CardLikeElementNode {
  static getType(): string {
    return 'diff';
  }

  static clone(node: DiffNode): DiffNode {
    return new DiffNode(node.__key);
  }

  static importJSON(serializedNode: SerializedDiffNode): DiffNode {
    return $createDiffNode().updateFromJSON(serializedNode);
  }

  static importDOM(): null {
    // TODO: Should link node should handle the import over autolink?
    return null;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedDiffNode>): this {
    return super.updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedElementNode {
    return {
      ...super.exportJSON(),
      type: 'diff',
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    return super.exportDOM(editor);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor) {
    console.info('__config', config);
    /**
     * div.ne-diff
     *  div.toolbar
     *  div.content
     */
    const el = document.createElement('div');
    el.dataset.lexicalKey = this.getKey();
    el.classList.add('ne-diff');
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    el.append(toolbar);
    const content = document.createElement('div');
    content.className = 'content';
    content.contentEditable = 'false';
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

export function $createDiffNode() {
  return $applyNodeReplacement(new DiffNode());
}

export function $isDiffNode(node: unknown): node is DiffNode {
  return node instanceof DiffNode;
}
