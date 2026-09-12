import type { BaseSelection, EditorState, LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  createCommand,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
} from 'lexical';

import { $isCursorNode } from '../node/cursor';
import { $isHoleNode } from '../node/hole';
import {
  $reconcileHoleTargets,
  $wrapNodeInHole,
  createHoleNormalizationRegistry,
  type HoleNormalizationGuard,
  type HoleNormalizationNodeConstructor,
  type HoleNormalizationRegistry,
} from '../node/hole-normalization';
import type {
  HoleBoundaryChange,
  HoleBoundaryPosition,
  HoleBoundarySide,
  HoleBoundaryState,
  HoleTargetRegistrationOptions,
  HoleTargetTextSerializer,
  HoleTextContentContext,
  IHoleService,
} from './i-hole-service';

type HoleStateMap = Map<NodeKey, HoleBoundaryState>;

type TargetRegistration = {
  serializeTextContent?: HoleTargetTextSerializer;
  target: HoleNormalizationNodeConstructor;
  unregisterTarget: () => void;
  unregisterTransform: (() => void) | null;
};

type SelectBoundaryPayload = {
  side: HoleBoundarySide;
  targetKey: NodeKey;
};

const SELECT_HOLE_BOUNDARY_COMMAND = createCommand<SelectBoundaryPayload>(
  'SELECT_HOLE_BOUNDARY_COMMAND',
);

/**
 * Editor-scoped read-only boundary state. Hole owns the cursor and selection
 * rules; consumers receive only a target key and a semantic position.
 */
export class HoleService implements IHoleService {
  private editor: LexicalEditor | null = null;

  private readonly listeners = new Set<(change: HoleBoundaryChange) => void>();

  private readonly registry: HoleNormalizationRegistry = createHoleNormalizationRegistry();

  private readonly targetRegistrations = new Set<TargetRegistration>();

  private normalizationGuard: HoleNormalizationGuard | undefined;

  private normalizationGuardToken: object | null = null;

  private unregisterEditor: (() => void) | null = null;

  private bindingToken: object | null = null;

  private states: HoleStateMap = new Map();

  bindEditor(editor: LexicalEditor): () => void {
    // Preserve listeners registered by plugins before CommonPlugin binds its
    // first editor. Rebinding an active editor must clear them because those
    // callbacks may close over the old editor instance.
    this.disposeEditor(this.editor !== null);
    const bindingToken = {};
    this.editor = editor;
    this.bindingToken = bindingToken;
    const unregisterStateListener = editor.registerUpdateListener(({ editorState }) => {
      this.refresh(editorState);
    });
    const unregisterBoundaryCommand = editor.registerCommand(
      SELECT_HOLE_BOUNDARY_COMMAND,
      ({ side, targetKey }) => this.selectBoundaryInUpdate(targetKey, side),
      COMMAND_PRIORITY_CRITICAL,
    );
    const unregisterReconcileListener = editor.registerUpdateListener(({ tags }) => {
      if (!tags.has(COLLABORATION_TAG) && !tags.has(HISTORIC_TAG)) return;
      queueMicrotask(() => {
        if (this.bindingToken !== bindingToken) return;
        this.reconcile();
      });
    });
    this.unregisterEditor = () => {
      unregisterStateListener();
      unregisterBoundaryCommand();
      unregisterReconcileListener();
    };
    this.targetRegistrations.forEach((registration) => this.installTransform(registration));
    this.refresh(editor.getEditorState());

    return () => {
      if (this.editor !== editor || this.bindingToken !== bindingToken) return;
      this.disposeEditor();
    };
  }

  registerTarget(
    target: HoleNormalizationNodeConstructor,
    options: HoleTargetRegistrationOptions = {},
  ): () => void {
    const unregisterTarget = this.registry.register(target);
    const registration: TargetRegistration = {
      serializeTextContent: options.serializeTextContent,
      target,
      unregisterTarget,
      unregisterTransform: null,
    };
    this.targetRegistrations.add(registration);
    this.installTransform(registration);

    return () => {
      if (!this.targetRegistrations.delete(registration)) return;
      registration.unregisterTransform?.();
      registration.unregisterTransform = null;
      registration.unregisterTarget();
    };
  }

  setNormalizationGuard(guard?: HoleNormalizationGuard): () => void {
    const token = {};
    this.normalizationGuard = guard;
    this.normalizationGuardToken = token;

    return () => {
      if (this.normalizationGuardToken !== token) return;
      this.normalizationGuard = undefined;
      this.normalizationGuardToken = null;
    };
  }

  normalizeIncoming(): boolean {
    return $reconcileHoleTargets($getRoot(), { registry: this.registry }).length > 0;
  }

  prepareBoundaryInsertion(selection: BaseSelection): boolean {
    const editor = this.editor;
    if (!editor?.isEditable()) return false;

    if ($isNodeSelection(selection)) {
      const selectedNodes = selection.getNodes();
      if (selectedNodes.length !== 1) return false;
      const target = selectedNodes[0];
      const hole = target?.getParent();
      if (!$isHoleNode(hole) || !hole.getContentChildren().some((node) => node.is(target))) {
        return false;
      }
      // Let Lexical's existing NodeSelection insertion replace the complete
      // Hole. Selecting the wrapper gives its native insertion path a block
      // ancestor while preserving the selected payload's replacement intent.
      selection.clear();
      selection.add(hole.getKey());
      return true;
    }

    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

    const cursor = selection.anchor.getNode();
    if (!$isCursorNode(cursor) || selection.anchor.type !== 'text') return false;
    const hole = cursor.getParent();
    if (!$isHoleNode(hole)) return false;
    const side = hole.getBoundaryCursorSide(cursor);
    if (!side) return false;

    const pendingText = cursor.getTextContent().replaceAll('\uFEFF', '');
    const paragraph = $createParagraphNode();
    if (pendingText) {
      paragraph.append($createTextNode(pendingText));
      cursor.setTextContent('\uFEFF');
    }
    if (side === 'before') hole.insertBefore(paragraph);
    else hole.insertAfter(paragraph);

    const nextSelection =
      pendingText || side === 'before' ? paragraph.selectEnd() : paragraph.selectStart();
    if ($isRangeSelection(nextSelection)) {
      selection.anchor.set(
        nextSelection.anchor.key,
        nextSelection.anchor.offset,
        nextSelection.anchor.type,
      );
      selection.focus.set(
        nextSelection.focus.key,
        nextSelection.focus.offset,
        nextSelection.focus.type,
      );
      selection.dirty = true;
    }
    return true;
  }

  serializeTextContent(nodes: readonly LexicalNode[], context: HoleTextContentContext): string {
    if (nodes.length === 1) {
      const registration = [...this.targetRegistrations].find(
        ({ target }) => nodes[0] instanceof target,
      );
      const serialized = registration?.serializeTextContent?.(nodes[0], context);
      if (serialized !== undefined) return serialized;
    }
    return context.selection.getTextContent();
  }

  reconcile(): void {
    const editor = this.editor;
    if (!editor) return;

    editor.update(
      () => {
        $reconcileHoleTargets($getRoot(), {
          canNormalize: this.normalizationGuard,
          registry: this.registry,
        });
      },
      { discrete: true, tag: HISTORY_MERGE_TAG },
    );
  }

  selectBoundary(targetKey: NodeKey, side: HoleBoundarySide): boolean {
    const editor = this.editor;
    if (!editor) return false;

    return editor.dispatchCommand(SELECT_HOLE_BOUNDARY_COMMAND, { side, targetKey });
  }

  private selectBoundaryInUpdate(targetKey: NodeKey, side: HoleBoundarySide): boolean {
    const target = $getNodeByKey(targetKey);
    if (
      !target ||
      $isHoleNode(target) ||
      $isCursorNode(target) ||
      target.isInline() ||
      !this.isRegisteredTarget(target)
    ) {
      return false;
    }

    const hole = target.getParent();
    if ($isHoleNode(hole)) {
      hole.normalizeBoundaryCursors();
      const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
      if (!cursor) return false;
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
      return true;
    }

    const sibling = side === 'before' ? target.getPreviousSibling() : target.getNextSibling();
    const selection = side === 'before' ? sibling?.selectEnd() : sibling?.selectStart();
    if (selection) {
      $setSelection(selection);
      return true;
    }

    const paragraph = $createParagraphNode();
    if (side === 'before') target.insertBefore(paragraph);
    else target.insertAfter(paragraph);
    $setSelection(side === 'before' ? paragraph.selectEnd() : paragraph.selectStart());
    return true;
  }

  getBoundaryState(targetKey: NodeKey): HoleBoundaryState {
    const state = this.states.get(targetKey);
    return state
      ? createBoundaryState(targetKey, state.position, state.covered, state.directNodeSelection)
      : createBoundaryState(targetKey, 'outside', false, false);
  }

  subscribe(listener: (change: HoleBoundaryChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private disposeEditor(clearListeners = true): void {
    this.unregisterEditor?.();
    this.unregisterEditor = null;
    this.bindingToken = null;
    this.normalizationGuard = undefined;
    this.normalizationGuardToken = null;
    this.targetRegistrations.forEach((registration) => {
      registration.unregisterTransform?.();
      registration.unregisterTransform = null;
    });
    this.editor = null;
    this.states = new Map();
    if (clearListeners) this.listeners.clear();
  }

  private installTransform(registration: TargetRegistration): void {
    if (!this.editor || registration.unregisterTransform) {
      return;
    }

    registration.unregisterTransform = this.editor.registerNodeTransform(
      registration.target,
      (node) => {
        $wrapNodeInHole(node, {
          canNormalize: this.normalizationGuard,
          registry: this.registry,
        });
      },
    );
  }

  private isRegisteredTarget(node: LexicalNode): boolean {
    return this.registry.targets.some((target) =>
      typeof target === 'string' ? node.getType() === target : node instanceof target,
    );
  }

  private refresh(editorState: EditorState): void {
    const nextStates = this.readStates(editorState);
    const previousStates = this.states;
    const keys = new Set([...previousStates.keys(), ...nextStates.keys()]);

    this.states = nextStates;
    for (const targetKey of keys) {
      const previous = previousStates.get(targetKey);
      const next =
        nextStates.get(targetKey) ?? createBoundaryState(targetKey, 'outside', false, false);
      if (!previous && next.position === 'outside') continue;
      if (
        previous &&
        previous.position === next.position &&
        previous.covered === next.covered &&
        previous.directNodeSelection === next.directNodeSelection
      ) {
        continue;
      }
      const previousSnapshot = previous ?? createBoundaryState(targetKey, 'outside', false, false);
      const nextSnapshot = createBoundaryState(
        targetKey,
        next.position,
        next.covered,
        next.directNodeSelection,
      );
      const change = Object.freeze({ next: nextSnapshot, previous: previousSnapshot });
      for (const listener of this.listeners) listener(change);
    }
  }

  private readStates(editorState: EditorState): HoleStateMap {
    const states: HoleStateMap = new Map();
    editorState.read(() => {
      const selection = $getSelection();
      const visit = (node: LexicalNode): void => {
        if ($isHoleNode(node)) {
          node.getContentChildren().forEach((target) => {
            states.set(target.getKey(), $readHoleBoundaryState(target.getKey(), selection));
          });
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      $getRoot().getChildren().forEach(visit);
    });
    return states;
  }
}

/** Read one target's semantic boundary state inside a Lexical read scope. */
export const $readHoleBoundaryState = (
  targetKey: NodeKey,
  selection = $getSelection(),
): HoleBoundaryState => {
  const target = $getNodeByKey(targetKey);
  const hole = target?.getParent();
  const selectedNodes = selection?.getNodes() ?? [];
  const directNodeSelection = Boolean($isNodeSelection(selection) && selection.has(targetKey));
  if (!target) return createBoundaryState(targetKey, 'outside', false, false);
  if (!$isHoleNode(hole)) {
    const covered = selectedNodes.some((selectedNode) => selectedNode.is(target));
    return createBoundaryState(
      targetKey,
      covered ? 'selected' : 'outside',
      covered,
      directNodeSelection,
    );
  }

  let covered = false;

  if ($isNodeSelection(selection)) {
    covered = selectedNodes.some(
      (selectedNode) => selectedNode.is(target) || selectedNode.is(hole),
    );
  } else if ($isRangeSelection(selection) && !selection.isCollapsed()) {
    covered =
      selectedNodes.some((selectedNode) => selectedNode.is(target) || selectedNode.is(hole)) ||
      (Boolean(hole.getBeforeCursor()?.isSelected(selection)) &&
        Boolean(hole.getAfterCursor()?.isSelected(selection)));
  }

  if (covered) return createBoundaryState(targetKey, 'selected', true, directNodeSelection);

  if ($isRangeSelection(selection) && selection.isCollapsed()) {
    const anchorNode = selection.anchor.getNode();
    if ($isCursorNode(anchorNode) && anchorNode.getParent() === hole) {
      const side = hole.getBoundaryCursorSide(anchorNode);
      if (side) return createBoundaryState(targetKey, side, false, false);
    }
  }

  return createBoundaryState(targetKey, 'outside', false, directNodeSelection);
};

const createBoundaryState = (
  targetKey: NodeKey,
  position: HoleBoundaryPosition,
  covered: boolean,
  directNodeSelection: boolean,
): HoleBoundaryState =>
  Object.freeze({
    covered,
    directNodeSelection,
    position,
    targetKey,
  });
