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
  SerializedLexicalNode,
  Spread,
  isHTMLElement,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export interface CodeMirrorOptions {
  indentWithTabs: boolean;
  lineNumbers: boolean;
  tabSize: number;
}

export type SerializedCodeMirrorNode = Spread<
  {
    code: string;
    codeTheme: string;
    language: string;
    options: {
      indentWithTabs: boolean;
      lineNumbers: boolean;
      tabSize: number;
    };
  },
  SerializedLexicalNode
>;

const LANGUAGE_DATA_ATTRIBUTE = 'data-language';
const THEME_DATA_ATTRIBUTE = 'data-theme';

const DEFAULT_OPTIONS: CodeMirrorOptions = {
  indentWithTabs: false,
  lineNumbers: false,
  tabSize: 2,
};

function hasChildDOMNodeTag(node: Node, tagName: string) {
  for (const child of node.childNodes) {
    if (isHTMLElement(child) && child.tagName === tagName) {
      return true;
    }
    hasChildDOMNodeTag(child, tagName);
  }
  return false;
}

function isGitHubCodeTable(table: HTMLTableElement): table is HTMLTableElement {
  return table.classList.contains('js-file-line-container');
}

function isGitHubCodeCell(cell: HTMLTableCellElement): cell is HTMLTableCellElement {
  return cell.classList.contains('js-file-line');
}

export class CodeMirrorNode extends DecoratorNode<any> {
  private __lang: string;
  private __code: string;
  private __codeTheme: string;
  private __options: CodeMirrorOptions;

  static getType(): string {
    return 'code';
  }

  static clone(node: CodeMirrorNode): CodeMirrorNode {
    return new CodeMirrorNode(
      node.__lang,
      node.__code,
      node.__codeTheme,
      node.__options,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedCodeMirrorNode): CodeMirrorNode {
    let code = serializedNode.code;
    if ('children' in serializedNode) {
      // @ts-expect-error not error
      code = serializedNode.children?.map((child) => child.text).join('') || '';
    }
    return $createCodeMirrorNode(
      serializedNode.language,
      code,
      serializedNode.codeTheme,
      serializedNode.options,
    ).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      // Typically <pre> is used for code blocks, and <code> for inline code styles
      // but if it's a multi line <code> we'll create a block. Pass through to
      // inline format handled by TextNode otherwise.
      code: (node: Node) => {
        const isMultiLine =
          node.textContent !== null &&
          (/\r?\n/.test(node.textContent) || hasChildDOMNodeTag(node, 'BR'));

        return isMultiLine
          ? {
              conversion: $convertPreElement,
              priority: 1,
            }
          : null;
      },
      div: () => ({
        conversion: $convertDivElement,
        priority: 1,
      }),
      pre: () => ({
        conversion: $convertPreElement,
        priority: 0,
      }),
      table: (node: Node) => {
        const table = node;
        // domNode is a <table> since we matched it by nodeName
        if (isGitHubCodeTable(table as HTMLTableElement)) {
          return {
            conversion: $convertTableElement,
            priority: 3,
          };
        }
        return null;
      },
      td: (node: Node) => {
        // element is a <td> since we matched it by nodeName
        const td = node as HTMLTableCellElement;
        const table: HTMLTableElement | null = td.closest('table');

        if (isGitHubCodeCell(td) || (table && isGitHubCodeTable(table))) {
          // Return a no-op if it's a table cell in a code table, but not a code line.
          // Otherwise it'll fall back to the T
          return {
            conversion: convertCodeNoop,
            priority: 3,
          };
        }

        return null;
      },
      tr: (node: Node) => {
        // element is a <tr> since we matched it by nodeName
        const tr = node as HTMLTableCellElement;
        const table: HTMLTableElement | null = tr.closest('table');
        if (table && isGitHubCodeTable(table)) {
          return {
            conversion: convertCodeNoop,
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  constructor(
    lang: string,
    code: string,
    codeTheme: string,
    options: CodeMirrorOptions,
    key?: string,
  ) {
    super(key);
    this.__lang = lang;
    this.__code = code;
    this.__codeTheme = codeTheme;
    this.__options = options;
  }

  get lang(): string {
    return this.__lang;
  }

  get code(): string {
    return this.__code;
  }

  get codeTheme(): string {
    return this.__codeTheme;
  }

  get options(): CodeMirrorOptions {
    return this.__options;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('pre');
    addClassNamesToElement(element, editor._config.theme.code);
    element.setAttribute('spellcheck', 'false');
    const language = this.__lang;
    if (language) {
      element.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
    }

    const theme = this.__codeTheme;
    if (theme) {
      element.setAttribute(THEME_DATA_ATTRIBUTE, theme);
    }

    element.textContent = this.__code;
    return { element };
  }

  exportJSON(): SerializedCodeMirrorNode {
    return {
      ...super.exportJSON(),
      code: this.code,
      codeTheme: this.codeTheme,
      language: this.lang,
      options: this.options,
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

  setCodeTheme(codeTheme: string) {
    const writer = this.getWritable();
    writer.__codeTheme = codeTheme;
    return this;
  }

  setTabSize(tabSize: number) {
    const writer = this.getWritable();
    writer.__options.tabSize = tabSize;
    return this;
  }

  setIndentWithTabs(indentWithTabs: boolean) {
    const writer = this.getWritable();
    writer.__options.indentWithTabs = indentWithTabs;
    return this;
  }

  setLineNumbers(lineNumbers: boolean) {
    const writer = this.getWritable();
    writer.__options.lineNumbers = lineNumbers;
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
    const decorator = getKernelFromEditor(editor)?.getDecorator('codemirror');
    if (!decorator) return null;

    // Handle both function and object decorator types
    if (typeof decorator === 'function') {
      return decorator(this, editor);
    } else {
      return decorator.render(this, editor);
    }
  }
}

export function $createCodeMirrorNode(
  lang: string,
  code = '',
  codeTheme = 'One Dark Pro',
  options: CodeMirrorOptions = DEFAULT_OPTIONS,
): CodeMirrorNode {
  return $applyNodeReplacement(new CodeMirrorNode(lang, code, codeTheme, options));
}

function isCodeElement(div: HTMLElement): boolean {
  return div.style.fontFamily.match('monospace') !== null;
}

function isCodeChildElement(node: HTMLElement): boolean {
  let parent = node.parentElement;
  while (parent !== null) {
    if (isCodeElement(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function $convertDivElement(domNode: Node): DOMConversionOutput {
  // domNode is a <div> since we matched it by nodeName
  const div = domNode as HTMLDivElement;
  const isCode = isCodeElement(div);
  if (!isCode && !isCodeChildElement(div)) {
    return {
      node: null,
    };
  }
  return {
    node: isCode ? $createCodeMirrorNode('plain', domNode.textContent || '', '') : null,
  };
}

function $convertTableElement(): DOMConversionOutput {
  return { node: $createCodeMirrorNode('plain', '', '') };
}

function $convertPreElement(domNode: HTMLElement): DOMConversionOutput {
  const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
  const codeTheme = domNode.getAttribute(THEME_DATA_ATTRIBUTE) || '';
  return { node: $createCodeMirrorNode(language || 'plain', domNode.textContent || '', codeTheme) };
}

export function $isCodeMirrorNode(node: LexicalNode): node is CodeMirrorNode {
  return node.getType() === CodeMirrorNode.getType();
}

function convertCodeNoop(): DOMConversionOutput {
  return { node: null };
}
