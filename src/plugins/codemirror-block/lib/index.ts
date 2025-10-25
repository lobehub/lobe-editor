let CodeMirrorLoading = false;

export const AllLang = [];

export interface Options {
    theme?: 'default' | 'One Dark Pro';
    readOnly?: boolean;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    tabSize?: number;
    indentWithTabs?: boolean;
    history?: any;
    preventCopy?: boolean;
    foldGutter?: boolean;
    className?: string;
    mode?: string;
    value?: string;
};

export interface ICodeMirrorInstance {
    getValue: () => string;
    setValue(value: string): void;
    destroy(): void;
    lineCount(): number;
    formatAll(): void;
    foldLines(): number[];
    foldLines(lines: number[]): void;
    focus(): void;
    blur(): void;
    setSelectionToStart(): void;
    setSelectionToEnd(): void;
    setSelection(anchor: number, header: number): void;
    replaceSelection(text: string): void;
    getLine(line: number): string;
    getSelection(): string;
    undoSelection(): void;
    redoSelection(): void;
    historyUndoDepth(): number;
    historyRedoDepth(): number;
    getHistory(): any;
    clearHistory(): void;
    setOption(option: keyof Options, value: any): void;
    on(event: 'change' | 'blur' | 'focus' | 'keyup' | 'fold' | 'unfold' | 'keydown' | 'rightOut' | 'leftOut', handler: (...args: any[]) => void): void;
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
            await import('./codemirror.js');
        } catch (e) {
            CodeMirrorLoading = false;
            throw e;
        }
    }
    // @ts-expect-error not error
    return window.CodeMirror.default as ICodeMirror;
}
