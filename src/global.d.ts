import type { EditorState, LexicalNode, SerializedEditorState } from 'lexical';

declare module 'lexical' {
  interface LexicalEditor {
    parseEditorState(
      maybeStringifiedEditorState: string | SerializedEditorState,
      updateFn?: (state: EditorState & { _nodeMap: Map<string, LexicalNode> }) => void,
    ): EditorState;
  }

  export function resetRandomKey(targetId?: number): void;
}

export {};
