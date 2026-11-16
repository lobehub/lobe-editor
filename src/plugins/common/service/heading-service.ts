import { $isHeadingNode, type HeadingNode } from '@lexical/rich-text';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { claimHeadingSlug } from '@/utils/heading-slug';

import {
  HEADING_FOLDED_ATTRIBUTE,
  HEADING_HIDDEN_ATTRIBUTE,
  type IHeadingService,
} from './i-heading-service';

export interface HeadingServiceBindOptions {
  anchors?: boolean;
}

const getHeadingLevel = (node: HeadingNode) => Number(node.getTag().slice(1));

function $hasHeadingAncestor(node: LexicalNode | null) {
  for (let current = node; current; current = current.getParent()) {
    if ($isHeadingNode(current)) return true;
  }
  return false;
}

function hasHeadingChange(
  editorState: EditorState,
  prevEditorState: EditorState,
  dirtyElements: Map<string, boolean>,
  dirtyLeaves: Set<string>,
) {
  if (dirtyElements.get('root') === true) return true;
  if (dirtyElements.has('root') && dirtyElements.size === 1 && dirtyLeaves.size === 0) return true;

  const dirtyKeys = [...dirtyElements.keys(), ...dirtyLeaves];
  if (dirtyKeys.length === 0) return false;
  const findHeading = () => dirtyKeys.some((key) => $hasHeadingAncestor($getNodeByKey(key)));
  return editorState.read(findHeading) || prevEditorState.read(findHeading);
}

function syncAttribute(previous: Set<HTMLElement>, next: Set<HTMLElement>, attribute: string) {
  for (const element of previous) {
    if (!next.has(element)) element.removeAttribute(attribute);
  }
  for (const element of next) {
    element.setAttribute(attribute, 'true');
  }
}

export class HeadingService implements IHeadingService {
  private anchors = true;
  private editor: LexicalEditor | null = null;
  private folded = new Set<string>();
  private foldedElements = new Set<HTMLElement>();
  private hiddenElements = new Set<HTMLElement>();
  private listeners = new Set<() => void>();
  private slugs = new Map<string, string>();

  bindEditor(editor: LexicalEditor, options: HeadingServiceBindOptions = {}): () => void {
    if (editor._headless) return () => {};

    this.editor = editor;
    this.anchors = options.anchors ?? true;

    const refresh = () => {
      this.refreshSlugs();
      this.applyFolds(false);
    };

    const unregisterUpdate = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
        if (hasHeadingChange(editorState, prevEditorState, dirtyElements, dirtyLeaves)) {
          this.refreshSlugs();
        }
        if (this.folded.size > 0 || this.hiddenElements.size > 0) {
          this.applyFolds(true);
        }
      },
    );
    const unregisterRoot = editor.registerRootListener(refresh);

    return () => {
      unregisterUpdate();
      unregisterRoot();
      syncAttribute(this.hiddenElements, new Set(), HEADING_HIDDEN_ATTRIBUTE);
      syncAttribute(this.foldedElements, new Set(), HEADING_FOLDED_ATTRIBUTE);
      this.hiddenElements.clear();
      this.foldedElements.clear();
      this.folded.clear();
      this.slugs.clear();
      if (this.editor === editor) this.editor = null;
    };
  }

  getSlug(key: string): string | null {
    return this.slugs.get(key) ?? null;
  }

  isFolded(key: string): boolean {
    return this.folded.has(key);
  }

  setFolded(key: string, folded: boolean): void {
    if (this.folded.has(key) === folded) return;
    if (folded) this.folded.add(key);
    else this.folded.delete(key);
    this.applyFolds(false);
    if (folded) this.moveSelectionOutOfFold(key);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  toggleFolded(key: string): void {
    this.setFolded(key, !this.folded.has(key));
  }

  private applyFolds(revealSelection: boolean): void {
    const editor = this.editor;
    if (!editor) return;

    const owners = new Map<string, string[]>();
    const revealed = new Set<string>();
    let pruned = false;

    editor.getEditorState().read(() => {
      for (const key of this.folded) {
        const heading = $getNodeByKey(key);
        if (!$isHeadingNode(heading)) {
          this.folded.delete(key);
          pruned = true;
          continue;
        }
        const level = getHeadingLevel(heading);
        for (let node = heading.getNextSibling(); node; node = node.getNextSibling()) {
          if ($isHeadingNode(node) && getHeadingLevel(node) <= level) break;
          owners.set(node.getKey(), [...(owners.get(node.getKey()) ?? []), key]);
        }
      }

      const selection = revealSelection ? $getSelection() : null;
      if (!$isRangeSelection(selection)) return;
      for (const point of [selection.anchor, selection.focus]) {
        for (let node: LexicalNode | null = point.getNode(); node; node = node.getParent()) {
          owners.get(node.getKey())?.forEach((key) => revealed.add(key));
        }
      }
    });

    if (revealed.size > 0) {
      revealed.forEach((key) => this.folded.delete(key));
      this.applyFolds(false);
      this.notify();
      return;
    }

    const nextHidden = new Set<HTMLElement>();
    for (const key of owners.keys()) {
      const element = editor.getElementByKey(key);
      if (element) nextHidden.add(element);
    }
    const nextFolded = new Set<HTMLElement>();
    for (const key of this.folded) {
      const element = editor.getElementByKey(key);
      if (element) nextFolded.add(element);
    }

    syncAttribute(this.hiddenElements, nextHidden, HEADING_HIDDEN_ATTRIBUTE);
    syncAttribute(this.foldedElements, nextFolded, HEADING_FOLDED_ATTRIBUTE);
    this.hiddenElements = nextHidden;
    this.foldedElements = nextFolded;
    if (pruned) this.notify();
  }

  private moveSelectionOutOfFold(key: string): void {
    const editor = this.editor;
    if (!editor) return;

    editor.update(() => {
      const heading = $getNodeByKey(key);
      const selection = $getSelection();
      if (!$isHeadingNode(heading) || !$isRangeSelection(selection)) return;

      const isHidden = (node: LexicalNode | null) => {
        for (let current = node; current; current = current.getParent()) {
          const element = editor.getElementByKey(current.getKey());
          if (element && this.hiddenElements.has(element)) return true;
        }
        return false;
      };

      if (isHidden(selection.anchor.getNode()) || isHidden(selection.focus.getNode())) {
        heading.selectEnd();
      }
    });
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private refreshSlugs(): void {
    const editor = this.editor;
    if (!editor || !this.anchors) return;

    const next = new Map<string, string>();
    const used = new Map<string, number>();
    editor.getEditorState().read(() => {
      const visit = (node: LexicalNode) => {
        if ($isHeadingNode(node)) {
          const slug = claimHeadingSlug(node.getTextContent(), used);
          if (slug) next.set(node.getKey(), slug);
          return;
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      visit($getRoot());
    });

    for (const [key, slug] of this.slugs) {
      if (next.has(key)) continue;
      const element = editor.getElementByKey(key);
      if (element?.id === slug) element.removeAttribute('id');
    }
    for (const [key, slug] of next) {
      const element = editor.getElementByKey(key);
      if (element && element.id !== slug) element.id = slug;
    }
    this.slugs = next;
  }
}
