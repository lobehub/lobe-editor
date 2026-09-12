import type { ReactNode } from 'react';

import type { AnnotationStorageMode } from '../service/annotation';
import type { AnnotationRecord, JSONValue } from '../types';

export interface AnnotationComposerContext {
  close: () => void;
  /** The Lexical nodes that will receive the annotation when submitted. */
  nodeKeys?: string[];
  /**
   * Lexical nodes used only to keep the composer aligned with a saved selection.
   * These keys must never be used as the annotation target when a range selection
   * is submitted; the saved `selection` is the source of truth for that operation.
   */
  anchorNodeKeys?: string[];
  quotedText: string;
  rect: DOMRect | null;
  records: AnnotationRecord[];
  submit: (payload: { kind?: string; payload: JSONValue }) => void;
}

export interface AnnotationBubbleContext {
  close: () => void;
  nodeKey: string | null;
  records: AnnotationRecord[];
}

/**
 * Visual annotation target reported when an annotated DOM node is clicked.
 * Hosts can use this to navigate to an annotation panel instead of opening a
 * floating bubble. The rectangle is viewport-relative and is only a hint for
 * the host; ids/records are the stable identity of the clicked target.
 */
export interface AnnotationClickContext {
  ids: string[];
  /**
   * All annotation ids in the semantic block that contains the clicked target.
   * Hosts can use this to select a complete annotation group while preserving
   * `ids` as the exact ids attached to the clicked DOM node.
   */
  groupIds?: string[];
  nodeKey: string | null;
  records: AnnotationRecord[];
  rect: DOMRect;
}

export interface ReactNodePropertiesPluginProps {
  /** Where annotation records are persisted; defaults to the embedded document repository. */
  annotationStorageMode?: AnnotationStorageMode;
  /** Annotation ids whose DOM targets should receive the active visual state. */
  activeAnnotationIds?: readonly string[];
  children?: ReactNode;
  /**
   * Optional DOM host for the rendered composer. When supplied, the composer is
   * rendered into this host instead of the document body and receives normal
   * flow layout from the host.
   */
  composerContainer?: Element | null;
  /**
   * External owner for the composer UI. When supplied, the plugin captures the
   * selection and exposes the same context used by `renderComposer`; the owner
   * is responsible for rendering it and calling `close`/`submit`.
   */
  onComposerChange?: (context: AnnotationComposerContext | null) => void;
  /**
   * Called when an annotated range or block is clicked. When supplied, the
   * plugin delegates the interaction to the host and does not render the
   * floating annotation bubble.
   */
  onAnnotationClick?: (context: AnnotationClickContext) => void;
  readOnly?: boolean;
  renderAnnotationBubble?: (context: AnnotationBubbleContext) => ReactNode;
  renderComposer?: (context: AnnotationComposerContext) => ReactNode;
  /** Alias for hosts that pass a generic storage mode through plugin props. */
  storageMode?: AnnotationStorageMode;
}

export interface AnnotationToolbarActionProps {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  kind?: string;
  payload?: JSONValue;
}
