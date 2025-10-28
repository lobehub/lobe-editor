/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedCodeMirrorNode = Spread<
  {
    code: string;
    language: string;
  },
  SerializedLexicalNode
>;

export class CodeMirrorNode extends DecoratorNode<any> {
  private __lang: string;
  private __code: string;

  static getType(): string {
    return 'code';
  }

  static clone(node: CodeMirrorNode): CodeMirrorNode {
    return new CodeMirrorNode(node.__lang, node.__code, node.__key);
  }

  static importJSON(serializedNode: SerializedCodeMirrorNode): CodeMirrorNode {
    let code = serializedNode.code;
    if ('children' in serializedNode) {
      // @ts-expect-error not error
      code = serializedNode.children?.map((child) => child.text).join('') || '';
    }
    return $createCodeMirrorNode(serializedNode.language, code).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: $convertCodeMirrorElement,
        priority: 0,
      }),
    };
  }

  constructor(lang: string, code: string, key?: string) {
    super(key);
    this.__lang = lang;
    this.__code = code;
  }

  get lang(): string {
    return this.__lang;
  }

  get code(): string {
    return this.__code;
  }

  exportJSON(): SerializedCodeMirrorNode {
    return {
      ...super.exportJSON(),
      code: this.code,
      language: this.lang,
    };
  }

  setLang(lang: string) {
    const writer = this.getWritable();
    writer.__lang = lang;
    return this;
  }

  setCode(code: string) {
    const writer = this.getWritable();
    writer.__code = code;
    return this;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.hr);
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

  decorate(editor: LexicalEditor): any {
    return getKernelFromEditor(editor)?.getDecorator('codemirror')?.(this, editor) || null;
  }
}

export function $createCodeMirrorNode(lang: string, code = ''): CodeMirrorNode {
  return $applyNodeReplacement(new CodeMirrorNode(lang, code));
}

function $convertCodeMirrorElement(): DOMConversionOutput {
  return { node: $createCodeMirrorNode('', '') };
}

export function $isCodeMirrorNode(node: LexicalNode): node is CodeMirrorNode {
  return node.getType() === CodeMirrorNode.getType();
}
