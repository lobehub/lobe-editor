import { LexicalEditor, createCommand } from 'lexical';

export const HOVER_COMMAND = createCommand<MouseEvent>();

export function registerEvent(editor: LexicalEditor, dom: HTMLElement) {
  const hoverHandler = (event: MouseEvent) => {
    editor.dispatchCommand(HOVER_COMMAND, event);
  };
  dom.addEventListener('mouseenter', hoverHandler);

  return () => {
    dom.removeEventListener('mouseenter', hoverHandler);
  };
}
