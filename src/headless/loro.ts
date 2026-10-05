import type { LexicalEditor } from 'lexical';
import type { LoroDoc } from 'loro-crdt';

import { LoroLexicalBinding, type LoroLexicalBindingOptions } from '@/plugins/loro';

import type { HeadlessEditor } from './headless-editor';

export type {
  LoroHeadlessFactory,
  LoroHeadlessFactoryOptions,
  LoroHeadlessFactoryResult,
} from './collaboration/loro-factory';
export { createLoroHeadlessFactory } from '@/plugins/loro/headless-factory';

export interface LoroHeadlessBindingOptions extends Omit<
  LoroLexicalBindingOptions,
  'editor' | 'doc'
> {
  doc?: LoroDoc | LoroLexicalBindingOptions['doc'];
  editor: HeadlessEditor | LexicalEditor;
}

const resolveLexicalEditor = (editor: HeadlessEditor | LexicalEditor): LexicalEditor => {
  if ('getEditorState' in editor && typeof editor.getEditorState === 'function') {
    return editor as LexicalEditor;
  }
  const lexicalEditor = (editor as HeadlessEditor).kernel.getLexicalEditor();
  if (!lexicalEditor) throw new Error('The headless editor has not initialized a Lexical editor.');
  return lexicalEditor;
};

/** Bind the DOM-free Lexical editor to the same core used by the browser path. */
export const createLoroHeadlessBinding = (
  options: LoroHeadlessBindingOptions,
): LoroLexicalBinding =>
  new LoroLexicalBinding({
    ...options,
    doc: options.doc,
    editor: resolveLexicalEditor(options.editor),
  });
