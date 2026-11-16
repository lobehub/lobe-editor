import type { LexicalEditor } from 'lexical';

export interface IEditorAsyncScope {
  readonly editor: LexicalEditor;
  isActive(): boolean;
  dispose(): void;
  update(callback: () => void): void;
}

class EditorAsyncScope implements IEditorAsyncScope {
  private active = true;

  constructor(public readonly editor: LexicalEditor) {}

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    this.active = false;
  }

  update(callback: () => void): void {
    if (!this.active) return;
    this.editor.update(() => {
      if (!this.active) return;
      callback();
    });
  }
}

export const createEditorAsyncScope = (editor: LexicalEditor): IEditorAsyncScope =>
  new EditorAsyncScope(editor);
