let CodeMirrorLoading = false;

export const AllLang = [];

export interface Options {
  className?: string;
  foldGutter?: boolean;
  history?: any;
  indentWithTabs?: boolean;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  mode?: string;
  preventCopy?: boolean;
  readOnly?: boolean;
  tabSize?: number;
  theme?: 'default';
  value?: string;
}

export interface ICodeMirrorInstance {
  blur(): void;
  clearHistory(): void;
  destroy(): void;
  focus(): void;
  foldLines(): number[];
  foldLines(lines: number[]): void;
  formatAll(): void;
  getHistory(): any;
  getLine(line: number): string;
  getSelection(): string;
  getValue: () => string;
  historyRedoDepth(): number;
  historyUndoDepth(): number;
  lineCount(): number;
  on(
    event:
      | 'change'
      | 'blur'
      | 'focus'
      | 'keyup'
      | 'fold'
      | 'unfold'
      | 'keydown'
      | 'rightOut'
      | 'leftOut',
    handler: (...args: any[]) => void,
  ): void;
  optionHelper: {
    theme: {
      reconfigure: (theme: any) => void;
    };
  };
  redoSelection(): void;
  replaceSelection(text: string): void;
  setOption(option: keyof Options, value: any): void;
  setSelection(anchor: number, header: number): void;
  setSelectionToEnd(): void;
  setSelectionToStart(): void;
  setValue(value: string): void;
  undoSelection(): void;
  view: {
    constructor: {
      theme: (options: any, settings: any) => any;
    };
    dispatch: (params: { effects: any }) => void;
  };
}

export interface ICodeMirror {
  fromTextArea: (textarea: HTMLTextAreaElement, options?: Options) => ICodeMirrorInstance;
  new (dom: HTMLElement, options?: Options): ICodeMirrorInstance;
}

export async function loadCodeMirror() {
  // @ts-expect-error not error
  if (!window.CodeMirror && !CodeMirrorLoading) {
    CodeMirrorLoading = true;
    try {
      // @ts-expect-error not error
      await import('@lobehub/codemirror');
    } catch (error) {
      CodeMirrorLoading = false;
      throw error;
    }
  }
  // @ts-expect-error not error
  return window.CodeMirror.default as ICodeMirror;
}
