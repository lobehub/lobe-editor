import type { LexicalEditor } from 'lexical';

import type { AnnotationRecord } from '../types';

export interface JSONDataSourceMetadataExtension {
  onRead?: (root: Record<string, unknown>) => void;
  onWrite?: (root: Record<string, unknown>) => void;
}

const extensions = new WeakMap<LexicalEditor, Set<JSONDataSourceMetadataExtension>>();

export function registerJSONDataSourceMetadataExtension(
  editor: LexicalEditor,
  extension: JSONDataSourceMetadataExtension,
): () => void {
  let editorExtensions = extensions.get(editor);
  if (!editorExtensions) {
    editorExtensions = new Set();
    extensions.set(editor, editorExtensions);
  }
  editorExtensions.add(extension);
  return () => editorExtensions?.delete(extension);
}

export function notifyJSONDataSourceRead(
  editor: LexicalEditor,
  root: Record<string, unknown>,
): void {
  extensions.get(editor)?.forEach((extension) => extension.onRead?.(root));
}

export function notifyJSONDataSourceWrite(
  editor: LexicalEditor,
  root: Record<string, unknown>,
): void {
  extensions.get(editor)?.forEach((extension) => extension.onWrite?.(root));
}

export function readAnnotationSnapshot(root: Record<string, unknown>): AnnotationRecord[] {
  const nodeState = isRecord(root.$) ? root.$ : isRecord(root.properties) ? root.properties : null;
  const properties = nodeState && isRecord(nodeState.properties) ? nodeState.properties : nodeState;
  const document = properties && isRecord(properties.document) ? properties.document : null;
  const annotations = document?.annotations;
  return Array.isArray(annotations)
    ? annotations.filter((record): record is AnnotationRecord => isRecord(record))
    : [];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
