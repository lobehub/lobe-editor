/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable no-redeclare */
/* eslint-disable unicorn/prefer-negative-index */
/* eslint-disable unicorn/better-regex */
/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable unicorn/prefer-string-slice */
/* eslint-disable unicorn/prefer-default-parameters */
/* eslint-disable unicorn/prefer-modern-dom-apis */
/* eslint-disable unicorn/prefer-dom-node-dataset */
/* eslint-disable unicorn/prefer-switch */
/* eslint-disable unicorn/prefer-optional-catch-binding */
/* eslint-disable unicorn/escape-case */
/* eslint-disable guard-for-in */
/* eslint-disable unicorn/prefer-dom-node-append */
/* eslint-disable unicorn/prefer-dom-node-remove */
/* eslint-disable unicorn/prefer-dom-node-text-content */
/* eslint-disable unicorn/prefer-at */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/no-lonely-if */
/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable unicorn/no-this-assignment */
/* eslint-disable eqeqeq */
/* eslint-disable no-undef */
/* eslint-disable typescript-sort-keys/interface */
/* eslint-disable unicorn/no-for-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unused-imports/no-unused-vars */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  BLUR_COMMAND,
  CLICK_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DRAGEND_COMMAND,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  FOCUS_COMMAND,
  FORMAT_TEXT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_MODIFIER_COMMAND,
  KEY_SPACE_COMMAND,
  KEY_TAB_COMMAND,
  MOVE_TO_END,
  MOVE_TO_START,
  PASTE_COMMAND,
  REDO_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECT_ALL_COMMAND,
  UNDO_COMMAND,
} from './LexicalCommands';
import {
  COMPOSITION_START_CHAR,
  COMPOSITION_SUFFIX,
  DETAIL_TYPE_TO_DETAIL,
  DOM_DOCUMENT_FRAGMENT_TYPE,
  DOM_DOCUMENT_TYPE,
  DOM_ELEMENT_TYPE,
  DOM_TEXT_TYPE,
  DOUBLE_LINE_BREAK,
  ELEMENT_FORMAT_TO_TYPE,
  ELEMENT_TYPE_TO_FORMAT,
  FULL_RECONCILE,
  HAS_DIRTY_NODES,
  IS_ALIGN_CENTER,
  IS_ALIGN_END,
  IS_ALIGN_JUSTIFY,
  IS_ALIGN_LEFT,
  IS_ALIGN_RIGHT,
  IS_ALIGN_START,
  IS_ALL_FORMATTING,
  IS_BOLD,
  IS_CODE,
  IS_DIRECTIONLESS,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_SEGMENTED,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_TOKEN,
  IS_UNDERLINE,
  IS_UNMERGEABLE,
  LTR_REGEX,
  NODE_STATE_KEY,
  NO_DIRTY_NODES,
  PROTOTYPE_CONFIG_METHOD,
  RTL_REGEX,
  TEXT_MODE_TO_TYPE,
  TEXT_TYPE_TO_FORMAT,
  TEXT_TYPE_TO_MODE,
} from './LexicalConstants';
import {
  COLLABORATION_TAG,
  FOCUS_TAG,
  HISTORY_MERGE_TAG,
  SKIP_DOM_SELECTION_TAG,
  SKIP_SCROLL_INTO_VIEW_TAG,
  UpdateTag,
} from './LexicalUpdateTags';
import devInvariant from './shared/devInvariant';
import {
  CAN_USE_BEFORE_INPUT,
  CAN_USE_DOM,
  IS_ANDROID_CHROME,
  IS_APPLE,
  IS_APPLE_WEBKIT,
  IS_FIREFOX,
  IS_IOS,
  IS_SAFARI,
} from './shared/environment';
import invariant from './shared/invariant';
import normalizeClassNames from './shared/normalizeClassNames';
import warnOnlyOnce from './shared/warnOnlyOnce';

export * from './LexicalCommands';
export * from './LexicalConstants';
export * from './LexicalUpdateTags';

export interface SerializedEditorState<T extends SerializedLexicalNode = SerializedLexicalNode> {
  root: SerializedRootNode<T>;
}

export function editorStateHasDirtySelection(
  editorState: EditorState,
  editor: LexicalEditor,
): boolean {
  const currentSelection = editor.getEditorState()._selection;

  const pendingSelection = editorState._selection;

  // Check if we need to update because of changes in selection
  if (pendingSelection !== null) {
    if (pendingSelection.dirty || !pendingSelection.is(currentSelection)) {
      return true;
    }
  } else if (currentSelection !== null) {
    return true;
  }

  return false;
}

export function cloneEditorState(current: EditorState): EditorState {
  return new EditorState(new Map(current._nodeMap));
}

export function createEmptyEditorState(): EditorState {
  return new EditorState(new Map([['root', $createRootNode()]]));
}

function exportNodeToJSON<SerializedNode extends SerializedLexicalNode>(
  node: LexicalNode,
): SerializedNode {
  const serializedNode = node.exportJSON();
  const nodeClass = node.constructor as KlassConstructor<typeof LexicalNode>;

  if (serializedNode.type !== nodeClass.getType()) {
    invariant(
      false,
      'LexicalNode: Node %s does not match the serialized type. Check if .exportJSON() is implemented and it is returning the correct type.',
      nodeClass.name,
    );
  }

  if ($isElementNode(node)) {
    const serializedChildren = (serializedNode as SerializedElementNode).children;
    if (!Array.isArray(serializedChildren)) {
      invariant(
        false,
        'LexicalNode: Node %s is an element but .exportJSON() does not have a children array.',
        nodeClass.name,
      );
    }

    const children = node.getChildren();

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const serializedChildNode = exportNodeToJSON(child);
      serializedChildren.push(serializedChildNode);
    }
  }

  // @ts-expect-error
  return serializedNode;
}

export interface EditorStateReadOptions {
  editor?: LexicalEditor | null;
}

export class EditorState {
  _nodeMap: NodeMap;
  _selection: null | BaseSelection;
  _flushSync: boolean;
  _readOnly: boolean;

  constructor(nodeMap: NodeMap, selection?: null | BaseSelection) {
    this._nodeMap = nodeMap;
    this._selection = selection || null;
    this._flushSync = false;
    this._readOnly = false;
  }

  isEmpty(): boolean {
    return this._nodeMap.size === 1 && this._selection === null;
  }

  read<V>(callbackFn: () => V, options?: EditorStateReadOptions): V {
    return readEditorState((options && options.editor) || null, this, callbackFn);
  }

  clone(selection?: null | BaseSelection): EditorState {
    const editorState = new EditorState(
      this._nodeMap,
      selection === undefined ? this._selection : selection,
    );
    editorState._readOnly = true;

    return editorState;
  }
  toJSON(): SerializedEditorState {
    return readEditorState(null, this, () => ({
      root: exportNodeToJSON($getRoot()),
    }));
  }
}

export type NodeMap = Map<NodeKey, LexicalNode>;

/**
 * The base type for all serialized nodes
 */
export type SerializedLexicalNode = {
  /** The type string used by the Node class */
  type: string;
  /** A numeric version for this schema, defaulting to 1, but not generally recommended for use */
  version: number;
  /**
   * Any state persisted with the NodeState API that is not
   * configured for flat storage
   */
  [NODE_STATE_KEY]?: Record<string, unknown>;
};

/**
 * EXPERIMENTAL
 * The configuration of a node returned by LexicalNode.$config()
 *
 * @example
 * ```ts
 * class CustomText extends TextNode {
 *   $config() {
 *     return this.config('custom-text', {extends: TextNode}};
 *   }
 * }
 * ```
 */
export interface StaticNodeConfigValue<T extends LexicalNode, Type extends string> {
  /**
   * The exact type of T.getType(), e.g. 'text' - the method itself must
   * have a more generic 'string' type to be compatible wtih subclassing.
   */
  readonly type?: Type;
  /**
   * An alternative to the internal static transform() method
   * that provides better type inference.
   */
  readonly $transform?: (node: T) => void;
  /**
   * An alternative to the static importJSON() method
   * that provides better type inference.
   */
  readonly $importJSON?: (serializedNode: SerializedLexicalNode) => T;
  /**
   * An alternative to the static importDOM() method
   */
  readonly importDOM?: DOMConversionMap;
  /**
   * EXPERIMENTAL
   *
   * An array of RequiredNodeStateConfig to initialize your node with
   * its state requirements. This may be used to configure serialization of
   * that state.
   *
   * This function will be called (at most) once per editor initialization,
   * directly on your node's prototype. It must not depend on any state
   * initialized in the constructor.
   *
   * @example
   * ```ts
   * const flatState = createState("flat", {parse: parseNumber});
   * const nestedState = createState("nested", {parse: parseNumber});
   * class MyNode extends TextNode {
   *   $config() {
   *     return this.config(
   *       'my-node',
   *       {
   *         extends: TextNode,
   *         stateConfigs: [
   *           { stateConfig: flatState, flat: true},
   *           nestedState,
   *         ]
   *       },
   *     );
   *   }
   * }
   * ```
   */
  readonly stateConfigs?: readonly RequiredNodeStateConfig[];
  /**
   * If specified, this must be the exact superclass of the node. It is not
   * checked at compile time and it is provided automatically at runtime.
   *
   * You would want to specify this when you are extending a node that
   * has non-trivial configuration in its $config such
   * as required state. If you do not specify this, the inferred
   * types for your node class might be missing some of that.
   */
  readonly extends?: Klass<LexicalNode>;
}

/**
 * This is the type of LexicalNode.$config() that can be
 * overridden by subclasses.
 */
export type BaseStaticNodeConfig = {
  readonly [K in string]?: StaticNodeConfigValue<LexicalNode, string>;
};

/**
 * Used to extract the node and type from a StaticNodeConfigRecord
 */
export type StaticNodeConfig<T extends LexicalNode, Type extends string> = BaseStaticNodeConfig & {
  readonly [K in Type]?: StaticNodeConfigValue<T, Type>;
};

/**
 * Any StaticNodeConfigValue (for generics and collections)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStaticNodeConfigValue = StaticNodeConfigValue<any, any>;

/**
 * @internal
 *
 * This is the more specific type than BaseStaticNodeConfig that a subclass
 * should return from $config()
 */
export type StaticNodeConfigRecord<
  Type extends string,
  Config extends AnyStaticNodeConfigValue,
> = BaseStaticNodeConfig & {
  readonly [K in Type]?: Config;
};

/**
 * Extract the type from a node based on its $config
 *
 * @example
 * ```ts
 * type TextNodeType = GetStaticNodeType<TextNode>;
 *      // ? 'text'
 * ```
 */
export type GetStaticNodeType<T extends LexicalNode> =
  ReturnType<T[typeof PROTOTYPE_CONFIG_METHOD]> extends StaticNodeConfig<T, infer Type>
    ? Type
    : string;

/**
 * The most precise type we can infer for the JSON that will
 * be produced by T.exportJSON().
 *
 * Do not use this for the return type of T.exportJSON()! It must be
 * a more generic type to be compatible with subclassing.
 */
export type LexicalExportJSON<T extends LexicalNode> = Prettify<
  Omit<ReturnType<T['exportJSON']>, 'type'> & {
    type: GetStaticNodeType<T>;
  } & NodeStateJSON<T>
>;

/**
 * Omit the children, type, and version properties from the given SerializedLexicalNode definition.
 */
export type LexicalUpdateJSON<T extends SerializedLexicalNode> = Omit<
  T,
  'children' | 'type' | 'version'
>;

/** @internal */
export interface LexicalPrivateDOM {
  __lexicalTextContent?: string | undefined | null;
  __lexicalLineBreak?: HTMLBRElement | HTMLImageElement | undefined | null;
  __lexicalDirTextContent?: string | undefined | null;
  __lexicalDir?: 'ltr' | 'rtl' | null | undefined;
  __lexicalUnmanaged?: boolean | undefined;
}

export function $removeNode(
  nodeToRemove: LexicalNode,
  restoreSelection: boolean,
  preserveEmptyParent?: boolean,
): void {
  errorOnReadOnly();
  const key = nodeToRemove.__key;
  const parent = nodeToRemove.getParent();
  if (parent === null) {
    return;
  }
  const selection = $maybeMoveChildrenSelectionToParent(nodeToRemove);
  let selectionMoved = false;
  if ($isRangeSelection(selection) && restoreSelection) {
    const anchor = selection.anchor;
    const focus = selection.focus;
    if (anchor.key === key) {
      moveSelectionPointToSibling(
        anchor,
        nodeToRemove,
        parent,
        nodeToRemove.getPreviousSibling(),
        nodeToRemove.getNextSibling(),
      );
      selectionMoved = true;
    }
    if (focus.key === key) {
      moveSelectionPointToSibling(
        focus,
        nodeToRemove,
        parent,
        nodeToRemove.getPreviousSibling(),
        nodeToRemove.getNextSibling(),
      );
      selectionMoved = true;
    }
  } else if ($isNodeSelection(selection) && restoreSelection && nodeToRemove.isSelected()) {
    nodeToRemove.selectPrevious();
  }

  if ($isRangeSelection(selection) && restoreSelection && !selectionMoved) {
    // Doing this is O(n) so lets avoid it unless we need to do it
    const index = nodeToRemove.getIndexWithinParent();
    removeFromParent(nodeToRemove);
    $updateElementSelectionOnCreateDeleteNode(selection, parent, index, -1);
  } else {
    removeFromParent(nodeToRemove);
  }

  if (
    !preserveEmptyParent &&
    !$isRootOrShadowRoot(parent) &&
    !parent.canBeEmpty() &&
    parent.isEmpty()
  ) {
    $removeNode(parent, restoreSelection);
  }
  if (restoreSelection && selection && $isRootNode(parent) && parent.isEmpty()) {
    parent.selectEnd();
  }
}

export type DOMConversionProp<T extends HTMLElement> = (node: T) => DOMConversion<T> | null;

export type DOMConversionPropByTagName<K extends string> = DOMConversionProp<
  K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement
>;

export type DOMConversionTagNameMap<K extends string> = {
  [NodeName in K]?: DOMConversionPropByTagName<NodeName>;
};

/**
 * An identity function that will infer the type of DOM nodes
 * based on tag names to make it easier to construct a
 * DOMConversionMap.
 */
export function buildImportMap<K extends string>(importMap: {
  [NodeName in K]: DOMConversionPropByTagName<NodeName>;
}): DOMConversionMap {
  return importMap as unknown as DOMConversionMap;
}

export type DOMConversion<T extends HTMLElement = HTMLElement> = {
  conversion: DOMConversionFn<T>;
  priority?: 0 | 1 | 2 | 3 | 4;
};

export type DOMConversionFn<T extends HTMLElement = HTMLElement> = (
  element: T,
) => DOMConversionOutput | null;

export type DOMChildConversion = (
  lexicalNode: LexicalNode,
  parentLexicalNode: LexicalNode | null | undefined,
) => LexicalNode | null | undefined;

export type DOMConversionMap<T extends HTMLElement = HTMLElement> = Record<
  NodeName,
  DOMConversionProp<T>
>;
type NodeName = string;

export type DOMConversionOutput = {
  after?: (childLexicalNodes: Array<LexicalNode>) => Array<LexicalNode>;
  forChild?: DOMChildConversion;
  node: null | LexicalNode | Array<LexicalNode>;
};

export type DOMExportOutputMap = Map<
  Klass<LexicalNode>,
  (editor: LexicalEditor, target: LexicalNode) => DOMExportOutput
>;

export type DOMExportOutput = {
  after?: (
    generatedElement: HTMLElement | DocumentFragment | Text | null | undefined,
  ) => HTMLElement | DocumentFragment | Text | null | undefined;
  element: HTMLElement | DocumentFragment | Text | null;
};

export type NodeKey = string;

export class LexicalNode {
  // Allow us to look up the type including static props
  // ['constructor']!: KlassConstructor<typeof LexicalNode>;
  /** @internal */
  __type: string;
  /** @internal */
  //@ts-ignore We set the key in the constructor.
  __key: string;
  /** @internal */
  __parent: null | NodeKey;
  /** @internal */
  __prev: null | NodeKey;
  /** @internal */
  __next: null | NodeKey;
  /** @internal */
  __state?: NodeState<this>;

  // Flow doesn't support abstract classes unfortunately, so we can't _force_
  // subclasses of Node to implement statics. All subclasses of Node should have
  // a static getType and clone method though. We define getType and clone here so we can call it
  // on any  Node, and we throw this error by default since the subclass should provide
  // their own implementation.
  /**
   * Returns the string type of this node. Every node must
   * implement this and it MUST BE UNIQUE amongst nodes registered
   * on the editor.
   *
   */
  static getType(): string {
    const { ownNodeType } = getStaticNodeConfig(this);
    invariant(
      ownNodeType !== undefined,
      'LexicalNode: Node %s does not implement .getType().',
      this.name,
    );
    return ownNodeType;
  }

  /**
   * Clones this node, creating a new node with a different key
   * and adding it to the EditorState (but not attaching it anywhere!). All nodes must
   * implement this method.
   *
   */
  static clone(_data: unknown): LexicalNode {
    invariant(false, 'LexicalNode: Node %s does not implement .clone().', this.name);
  }

  /**
   * Override this to implement the new static node configuration protocol,
   * this method is called directly on the prototype and must not depend
   * on anything initialized in the constructor. Generally it should be
   * a trivial implementation.
   *
   * @example
   * ```ts
   * class MyNode extends TextNode {
   *   $config() {
   *     return this.config('my-node', {extends: TextNode});
   *   }
   * }
   * ```
   */
  $config(): BaseStaticNodeConfig {
    return {};
  }

  /**
   * This is a convenience method for $config that
   * aids in type inference. See {@link LexicalNode.$config}
   * for example usage.
   */
  config<Type extends string, Config extends StaticNodeConfigValue<this, Type>>(
    type: Type,
    config: Config,
  ): StaticNodeConfigRecord<Type, Config> {
    const parentKlass = config.extends || Object.getPrototypeOf(this.constructor);
    Object.assign(config, { extends: parentKlass, type });
    return { [type]: config } as StaticNodeConfigRecord<Type, Config>;
  }

  /**
   * Perform any state updates on the clone of prevNode that are not already
   * handled by the constructor call in the static clone method. If you have
   * state to update in your clone that is not handled directly by the
   * constructor, it is advisable to override this method but it is required
   * to include a call to `super.afterCloneFrom(prevNode)` in your
   * implementation. This is only intended to be called by
   * {@link $cloneWithProperties} function or via a super call.
   *
   * @example
   * ```ts
   * class ClassesTextNode extends TextNode {
   *   // Not shown: static getType, static importJSON, exportJSON, createDOM, updateDOM
   *   __classes = new Set<string>();
   *   static clone(node: ClassesTextNode): ClassesTextNode {
   *     // The inherited TextNode constructor is used here, so
   *     // classes is not set by this method.
   *     return new ClassesTextNode(node.__text, node.__key);
   *   }
   *   afterCloneFrom(node: this): void {
   *     // This calls TextNode.afterCloneFrom and LexicalNode.afterCloneFrom
   *     // for necessary state updates
   *     super.afterCloneFrom(node);
   *     this.__addClasses(node.__classes);
   *   }
   *   // This method is a private implementation detail, it is not
   *   // suitable for the public API because it does not call getWritable
   *   __addClasses(classNames: Iterable<string>): this {
   *     for (const className of classNames) {
   *       this.__classes.add(className);
   *     }
   *     return this;
   *   }
   *   addClass(...classNames: string[]): this {
   *     return this.getWritable().__addClasses(classNames);
   *   }
   *   removeClass(...classNames: string[]): this {
   *     const node = this.getWritable();
   *     for (const className of classNames) {
   *       this.__classes.delete(className);
   *     }
   *     return this;
   *   }
   *   getClasses(): Set<string> {
   *     return this.getLatest().__classes;
   *   }
   * }
   * ```
   *
   */
  afterCloneFrom(prevNode: this): void {
    if (this.__key === prevNode.__key) {
      this.__parent = prevNode.__parent;
      this.__next = prevNode.__next;
      this.__prev = prevNode.__prev;
      this.__state = prevNode.__state;
    } else if (prevNode.__state) {
      this.__state = prevNode.__state.getWritable(this);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static importDOM?: () => DOMConversionMap<any> | null;

  constructor(key?: NodeKey) {
    this.__type = (this.constructor as KlassConstructor<typeof LexicalNode>).getType();
    this.__parent = null;
    this.__prev = null;
    this.__next = null;
    Object.defineProperty(this, '__state', {
      configurable: true,
      enumerable: false,
      value: undefined,
      writable: true,
    });
    $setNodeKey(this, key);

    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      if (this.__type !== 'root') {
        errorOnReadOnly();
        errorOnTypeKlassMismatch(this.__type, this.constructor);
      }
    }
  }
  // Getters and Traversers

  /**
   * Returns the string type of this node.
   */
  getType(): string {
    return this.__type;
  }

  isInline(): boolean {
    invariant(false, 'LexicalNode: Node %s does not implement .isInline().', this.constructor.name);
  }

  /**
   * Returns true if there is a path between this node and the RootNode, false otherwise.
   * This is a way of determining if the node is "attached" EditorState. Unattached nodes
   * won't be reconciled and will ultimately be cleaned up by the Lexical GC.
   */
  isAttached(): boolean {
    let nodeKey: string | null = this.__key;
    while (nodeKey !== null) {
      if (nodeKey === 'root') {
        return true;
      }

      const node: LexicalNode | null = $getNodeByKey(nodeKey);

      if (node === null) {
        break;
      }
      nodeKey = node.__parent;
    }
    return false;
  }

  /**
   * Returns true if this node is contained within the provided Selection., false otherwise.
   * Relies on the algorithms implemented in {@link BaseSelection.getNodes} to determine
   * what's included.
   *
   * @param selection - The selection that we want to determine if the node is in.
   */
  isSelected(selection?: null | BaseSelection): boolean {
    const targetSelection = selection || $getSelection();
    if (targetSelection == null) {
      return false;
    }

    const isSelected = targetSelection.getNodes().some((n) => n.__key === this.__key);

    if ($isTextNode(this)) {
      return isSelected;
    }
    // For inline images inside of element nodes.
    // Without this change the image will be selected if the cursor is before or after it.
    const isElementRangeSelection =
      $isRangeSelection(targetSelection) &&
      targetSelection.anchor.type === 'element' &&
      targetSelection.focus.type === 'element';

    if (isElementRangeSelection) {
      if (targetSelection.isCollapsed()) {
        return false;
      }

      const parentNode = this.getParent();
      if ($isDecoratorNode(this) && this.isInline() && parentNode) {
        const firstPoint = targetSelection.isBackward()
          ? targetSelection.focus
          : targetSelection.anchor;
        if (
          parentNode.is(firstPoint.getNode()) &&
          firstPoint.offset === parentNode.getChildrenSize() &&
          this.is(parentNode.getLastChild())
        ) {
          return false;
        }
      }
    }
    return isSelected;
  }

  /**
   * Returns this nodes key.
   */
  getKey(): NodeKey {
    // Key is stable between copies
    return this.__key;
  }

  /**
   * Returns the zero-based index of this node within the parent.
   */
  getIndexWithinParent(): number {
    const parent = this.getParent();
    if (parent === null) {
      return -1;
    }
    let node = parent.getFirstChild();
    let index = 0;
    while (node !== null) {
      if (this.is(node)) {
        return index;
      }
      index++;
      node = node.getNextSibling();
    }
    return -1;
  }

  /**
   * Returns the parent of this node, or null if none is found.
   */
  getParent<T extends ElementNode>(): T | null {
    const parent = this.getLatest().__parent;
    if (parent === null) {
      return null;
    }
    return $getNodeByKey<T>(parent);
  }

  /**
   * Returns the parent of this node, or throws if none is found.
   */
  getParentOrThrow<T extends ElementNode>(): T {
    const parent = this.getParent<T>();
    if (parent === null) {
      invariant(false, 'Expected node %s to have a parent.', this.__key);
    }
    return parent;
  }

  /**
   * Returns the highest (in the EditorState tree)
   * non-root ancestor of this node, or null if none is found. See {@link lexical!$isRootOrShadowRoot}
   * for more information on which Elements comprise "roots".
   */
  getTopLevelElement(): ElementNode | DecoratorNode<unknown> | null {
    let node: ElementNode | this | null = this;
    while (node !== null) {
      const parent: ElementNode | null = node.getParent();
      if ($isRootOrShadowRoot(parent)) {
        invariant(
          $isElementNode(node) || (node === this && $isDecoratorNode(node)),
          'Children of root nodes must be elements or decorators',
        );
        return node;
      }
      node = parent;
    }
    return null;
  }

  /**
   * Returns the highest (in the EditorState tree)
   * non-root ancestor of this node, or throws if none is found. See {@link lexical!$isRootOrShadowRoot}
   * for more information on which Elements comprise "roots".
   */
  getTopLevelElementOrThrow(): ElementNode | DecoratorNode<unknown> {
    const parent = this.getTopLevelElement();
    if (parent === null) {
      invariant(false, 'Expected node %s to have a top parent element.', this.__key);
    }
    return parent;
  }

  /**
   * Returns a list of the every ancestor of this node,
   * all the way up to the RootNode.
   *
   */
  getParents(): Array<ElementNode> {
    const parents: Array<ElementNode> = [];
    let node = this.getParent();
    while (node !== null) {
      parents.push(node);
      node = node.getParent();
    }
    return parents;
  }

  /**
   * Returns a list of the keys of every ancestor of this node,
   * all the way up to the RootNode.
   *
   */
  getParentKeys(): Array<NodeKey> {
    const parents = [];
    let node = this.getParent();
    while (node !== null) {
      parents.push(node.__key);
      node = node.getParent();
    }
    return parents;
  }

  /**
   * Returns the "previous" siblings - that is, the node that comes
   * before this one in the same parent.
   *
   */
  getPreviousSibling<T extends LexicalNode>(): T | null {
    const self = this.getLatest();
    const prevKey = self.__prev;
    return prevKey === null ? null : $getNodeByKey<T>(prevKey);
  }

  /**
   * Returns the "previous" siblings - that is, the nodes that come between
   * this one and the first child of it's parent, inclusive.
   *
   */
  getPreviousSiblings<T extends LexicalNode>(): Array<T> {
    const siblings: Array<T> = [];
    const parent = this.getParent();
    if (parent === null) {
      return siblings;
    }
    let node: null | T = parent.getFirstChild();
    while (node !== null) {
      if (node.is(this)) {
        break;
      }
      siblings.push(node);
      node = node.getNextSibling();
    }
    return siblings;
  }

  /**
   * Returns the "next" siblings - that is, the node that comes
   * after this one in the same parent
   *
   */
  getNextSibling<T extends LexicalNode>(): T | null {
    const self = this.getLatest();
    const nextKey = self.__next;
    return nextKey === null ? null : $getNodeByKey<T>(nextKey);
  }

  /**
   * Returns all "next" siblings - that is, the nodes that come between this
   * one and the last child of it's parent, inclusive.
   *
   */
  getNextSiblings<T extends LexicalNode>(): Array<T> {
    const siblings: Array<T> = [];
    let node: null | T = this.getNextSibling();
    while (node !== null) {
      siblings.push(node);
      node = node.getNextSibling();
    }
    return siblings;
  }

  /**
   * @deprecated use {@link $getCommonAncestor}
   *
   * Returns the closest common ancestor of this node and the provided one or null
   * if one cannot be found.
   *
   * @param node - the other node to find the common ancestor of.
   */
  getCommonAncestor<T extends ElementNode = ElementNode>(node: LexicalNode): T | null {
    const a = $isElementNode(this) ? this : this.getParent();
    const b = $isElementNode(node) ? node : node.getParent();
    const result = a && b ? $getCommonAncestor(a, b) : null;
    return result
      ? (result.commonAncestor as T) /* TODO this type cast is a lie, but fixing it would break backwards compatibility */
      : null;
  }

  /**
   * Returns true if the provided node is the exact same one as this node, from Lexical's perspective.
   * Always use this instead of referential equality.
   *
   * @param object - the node to perform the equality comparison on.
   */
  is(object: LexicalNode | null | undefined): boolean {
    if (object == null) {
      return false;
    }
    return this.__key === object.__key;
  }

  /**
   * Returns true if this node logically precedes the target node in the
   * editor state, false otherwise (including if there is no common ancestor).
   *
   * Note that this notion of isBefore is based on post-order; a descendant
   * node is always before its ancestors. See also
   * {@link $getCommonAncestor} and {@link $comparePointCaretNext} for
   * more flexible ways to determine the relative positions of nodes.
   *
   * @param targetNode - the node we're testing to see if it's after this one.
   */
  isBefore(targetNode: LexicalNode): boolean {
    const compare = $getCommonAncestor(this, targetNode);
    if (compare === null) {
      return false;
    }
    if (compare.type === 'descendant') {
      return true;
    }
    if (compare.type === 'branch') {
      return $getCommonAncestorResultBranchOrder(compare) === -1;
    }
    invariant(
      compare.type === 'same' || compare.type === 'ancestor',
      'LexicalNode.isBefore: exhaustiveness check',
    );
    return false;
  }

  /**
   * Returns true if this node is an ancestor of and distinct from the target node, false otherwise.
   *
   * @param targetNode - the would-be child node.
   */
  isParentOf(targetNode: LexicalNode): boolean {
    const result = $getCommonAncestor(this, targetNode);
    return result !== null && result.type === 'ancestor';
  }

  // TO-DO: this function can be simplified a lot
  /**
   * Returns a list of nodes that are between this node and
   * the target node in the EditorState.
   *
   * @param targetNode - the node that marks the other end of the range of nodes to be returned.
   */
  getNodesBetween(targetNode: LexicalNode): Array<LexicalNode> {
    const isBefore = this.isBefore(targetNode);
    const nodes = [];
    const visited = new Set();
    let node: LexicalNode | this | null = this;
    while (true) {
      if (node === null) {
        break;
      }
      const key = node.__key;
      if (!visited.has(key)) {
        visited.add(key);
        nodes.push(node);
      }
      if (node === targetNode) {
        break;
      }
      const child: LexicalNode | null = $isElementNode(node)
        ? isBefore
          ? node.getFirstChild()
          : node.getLastChild()
        : null;
      if (child !== null) {
        node = child;
        continue;
      }
      const nextSibling: LexicalNode | null = isBefore
        ? node.getNextSibling()
        : node.getPreviousSibling();
      if (nextSibling !== null) {
        node = nextSibling;
        continue;
      }
      const parent: LexicalNode | null = node.getParentOrThrow();
      if (!visited.has(parent.__key)) {
        nodes.push(parent);
      }
      if (parent === targetNode) {
        break;
      }
      let parentSibling = null;
      let ancestor: LexicalNode | null = parent;
      do {
        if (ancestor === null) {
          invariant(false, 'getNodesBetween: ancestor is null');
        }
        parentSibling = isBefore ? ancestor.getNextSibling() : ancestor.getPreviousSibling();
        ancestor = ancestor.getParent();
        if (ancestor !== null) {
          if (parentSibling === null && !visited.has(ancestor.__key)) {
            nodes.push(ancestor);
          }
        } else {
          break;
        }
      } while (parentSibling === null);
      node = parentSibling;
    }
    if (!isBefore) {
      nodes.reverse();
    }
    return nodes;
  }

  /**
   * Returns true if this node has been marked dirty during this update cycle.
   *
   */
  isDirty(): boolean {
    const editor = getActiveEditor();
    const dirtyLeaves = editor._dirtyLeaves;
    return dirtyLeaves !== null && dirtyLeaves.has(this.__key);
  }

  /**
   * Returns the latest version of the node from the active EditorState.
   * This is used to avoid getting values from stale node references.
   *
   */
  getLatest(): this {
    const latest = $getNodeByKey<this>(this.__key);
    if (latest === null) {
      invariant(
        false,
        'Lexical node does not exist in active editor state. Avoid using the same node references between nested closures from editorState.read/editor.update.',
      );
    }
    return latest;
  }

  /**
   * Returns a mutable version of the node using {@link $cloneWithProperties}
   * if necessary. Will throw an error if called outside of a Lexical Editor
   * {@link LexicalEditor.update} callback.
   *
   */
  getWritable(): this {
    errorOnReadOnly();
    const editorState = getActiveEditorState();
    const editor = getActiveEditor();
    const nodeMap = editorState._nodeMap;
    const key = this.__key;
    // Ensure we get the latest node from pending state
    const latestNode = this.getLatest();
    const cloneNotNeeded = editor._cloneNotNeeded;
    const selection = $getSelection();
    if (selection !== null) {
      selection.setCachedNodes(null);
    }
    if (cloneNotNeeded.has(key)) {
      // Transforms clear the dirty node set on each iteration to keep track on newly dirty nodes
      internalMarkNodeAsDirty(latestNode);
      return latestNode;
    }
    const mutableNode = $cloneWithProperties(latestNode);
    cloneNotNeeded.add(key);
    internalMarkNodeAsDirty(mutableNode);
    // Update reference in node map
    nodeMap.set(key, mutableNode);

    return mutableNode;
  }

  /**
   * Returns the text content of the node. Override this for
   * custom nodes that should have a representation in plain text
   * format (for copy + paste, for example)
   *
   */
  getTextContent(): string {
    return '';
  }

  /**
   * Returns the length of the string produced by calling getTextContent on this node.
   *
   */
  getTextContentSize(): number {
    return this.getTextContent().length;
  }

  // View

  /**
   * Called during the reconciliation process to determine which nodes
   * to insert into the DOM for this Lexical Node.
   *
   * This method must return exactly one HTMLElement. Nested elements are not supported.
   *
   * Do not attempt to update the Lexical EditorState during this phase of the update lifecycle.
   *
   * @param _config - allows access to things like the EditorTheme (to apply classes) during reconciliation.
   * @param _editor - allows access to the editor for context during reconciliation.
   *
   * */
  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    invariant(false, 'createDOM: base method not extended');
  }

  /**
   * Called when a node changes and should update the DOM
   * in whatever way is necessary to make it align with any changes that might
   * have happened during the update.
   *
   * Returning "true" here will cause lexical to unmount and recreate the DOM node
   * (by calling createDOM). You would need to do this if the element tag changes,
   * for instance.
   *
   * */
  updateDOM(_prevNode: unknown, _dom: HTMLElement, _config: EditorConfig): boolean {
    invariant(false, 'updateDOM: base method not extended');
  }

  /**
   * Controls how the this node is serialized to HTML. This is important for
   * copy and paste between Lexical and non-Lexical editors, or Lexical editors with different namespaces,
   * in which case the primary transfer format is HTML. It's also important if you're serializing
   * to HTML for any other reason via {@link @lexical/html!$generateHtmlFromNodes}. You could
   * also use this method to build your own HTML renderer.
   *
   * */
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = this.createDOM(editor._config, editor);
    return { element };
  }

  /**
   * Controls how the this node is serialized to JSON. This is important for
   * copy and paste between Lexical editors sharing the same namespace. It's also important
   * if you're serializing to JSON for persistent storage somewhere.
   * See [Serialization & Deserialization](https://lexical.dev/docs/concepts/serialization#lexical---html).
   *
   * */
  exportJSON(): SerializedLexicalNode {
    // eslint-disable-next-line dot-notation
    const state = this.__state ? this.__state.toJSON() : undefined;
    return {
      type: this.__type,
      version: 1,
      ...state,
    };
  }

  /**
   * Controls how the this node is deserialized from JSON. This is usually boilerplate,
   * but provides an abstraction between the node implementation and serialized interface that can
   * be important if you ever make breaking changes to a node schema (by adding or removing properties).
   * See [Serialization & Deserialization](https://lexical.dev/docs/concepts/serialization#lexical---html).
   *
   * */
  static importJSON(_serializedNode: SerializedLexicalNode): LexicalNode {
    invariant(false, 'LexicalNode: Node %s does not implement .importJSON().', this.name);
  }

  /**
   * Update this LexicalNode instance from serialized JSON. It's recommended
   * to implement as much logic as possible in this method instead of the
   * static importJSON method, so that the functionality can be inherited in subclasses.
   *
   * The LexicalUpdateJSON utility type should be used to ignore any type, version,
   * or children properties in the JSON so that the extended JSON from subclasses
   * are acceptable parameters for the super call.
   *
   * If overridden, this method must call super.
   *
   * @example
   * ```ts
   * class MyTextNode extends TextNode {
   *   // ...
   *   static importJSON(serializedNode: SerializedMyTextNode): MyTextNode {
   *     return $createMyTextNode()
   *       .updateFromJSON(serializedNode);
   *   }
   *   updateFromJSON(
   *     serializedNode: LexicalUpdateJSON<SerializedMyTextNode>,
   *   ): this {
   *     return super.updateFromJSON(serializedNode)
   *       .setMyProperty(serializedNode.myProperty);
   *   }
   * }
   * ```
   **/
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedLexicalNode>): this {
    return $updateStateFromJSON(this, serializedNode);
  }

  /**
   * @experimental
   *
   * Registers the returned function as a transform on the node during
   * Editor initialization. Most such use cases should be addressed via
   * the {@link LexicalEditor.registerNodeTransform} API.
   *
   * Experimental - use at your own risk.
   */
  static transform(): ((node: LexicalNode) => void) | null {
    return null;
  }

  // Setters and mutators

  /**
   * Removes this LexicalNode from the EditorState. If the node isn't re-inserted
   * somewhere, the Lexical garbage collector will eventually clean it up.
   *
   * @param preserveEmptyParent - If falsy, the node's parent will be removed if
   * it's empty after the removal operation. This is the default behavior, subject to
   * other node heuristics such as {@link ElementNode#canBeEmpty}
   * */
  remove(preserveEmptyParent?: boolean): void {
    $removeNode(this, true, preserveEmptyParent);
  }

  /**
   * Replaces this LexicalNode with the provided node, optionally transferring the children
   * of the replaced node to the replacing node.
   *
   * @param replaceWith - The node to replace this one with.
   * @param includeChildren - Whether or not to transfer the children of this node to the replacing node.
   * */
  replace<N extends LexicalNode>(replaceWith: N, includeChildren?: boolean): N {
    errorOnReadOnly();
    let selection = $getSelection();
    if (selection !== null) {
      selection = selection.clone();
    }
    errorOnInsertTextNodeOnRoot(this, replaceWith);
    const self = this.getLatest();
    const toReplaceKey = this.__key;
    const key = replaceWith.__key;
    const writableReplaceWith = replaceWith.getWritable();
    const writableParent = this.getParentOrThrow().getWritable();
    const size = writableParent.__size;
    removeFromParent(writableReplaceWith);
    const prevSibling = self.getPreviousSibling();
    const nextSibling = self.getNextSibling();
    const prevKey = self.__prev;
    const nextKey = self.__next;
    const parentKey = self.__parent;
    $removeNode(self, false, true);

    if (prevSibling === null) {
      writableParent.__first = key;
    } else {
      const writablePrevSibling = prevSibling.getWritable();
      writablePrevSibling.__next = key;
    }
    writableReplaceWith.__prev = prevKey;
    if (nextSibling === null) {
      writableParent.__last = key;
    } else {
      const writableNextSibling = nextSibling.getWritable();
      writableNextSibling.__prev = key;
    }
    writableReplaceWith.__next = nextKey;
    writableReplaceWith.__parent = parentKey;
    writableParent.__size = size;
    if (includeChildren) {
      invariant(
        $isElementNode(this) && $isElementNode(writableReplaceWith),
        'includeChildren should only be true for ElementNodes',
      );
      this.getChildren().forEach((child: LexicalNode) => {
        writableReplaceWith.append(child);
      });
    }
    if ($isRangeSelection(selection)) {
      $setSelection(selection);
      const anchor = selection.anchor;
      const focus = selection.focus;
      if (anchor.key === toReplaceKey) {
        $moveSelectionPointToEnd(anchor, writableReplaceWith);
      }
      if (focus.key === toReplaceKey) {
        $moveSelectionPointToEnd(focus, writableReplaceWith);
      }
    }
    if ($getCompositionKey() === toReplaceKey) {
      $setCompositionKey(key);
    }
    return writableReplaceWith;
  }

  /**
   * Inserts a node after this LexicalNode (as the next sibling).
   *
   * @param nodeToInsert - The node to insert after this one.
   * @param restoreSelection - Whether or not to attempt to resolve the
   * selection to the appropriate place after the operation is complete.
   * */
  insertAfter(nodeToInsert: LexicalNode, restoreSelection = true): LexicalNode {
    errorOnReadOnly();
    errorOnInsertTextNodeOnRoot(this, nodeToInsert);
    const writableSelf = this.getWritable();
    const writableNodeToInsert = nodeToInsert.getWritable();
    const oldParent = writableNodeToInsert.getParent();
    const selection = $getSelection();
    let elementAnchorSelectionOnNode = false;
    let elementFocusSelectionOnNode = false;
    if (oldParent !== null) {
      // TODO: this is O(n), can we improve?
      const oldIndex = nodeToInsert.getIndexWithinParent();
      removeFromParent(writableNodeToInsert);
      if ($isRangeSelection(selection)) {
        const oldParentKey = oldParent.__key;
        const anchor = selection.anchor;
        const focus = selection.focus;
        elementAnchorSelectionOnNode =
          anchor.type === 'element' &&
          anchor.key === oldParentKey &&
          anchor.offset === oldIndex + 1;
        elementFocusSelectionOnNode =
          focus.type === 'element' && focus.key === oldParentKey && focus.offset === oldIndex + 1;
      }
    }
    const nextSibling = this.getNextSibling();
    const writableParent = this.getParentOrThrow().getWritable();
    const insertKey = writableNodeToInsert.__key;
    const nextKey = writableSelf.__next;
    if (nextSibling === null) {
      writableParent.__last = insertKey;
    } else {
      const writableNextSibling = nextSibling.getWritable();
      writableNextSibling.__prev = insertKey;
    }
    writableParent.__size++;
    writableSelf.__next = insertKey;
    writableNodeToInsert.__next = nextKey;
    writableNodeToInsert.__prev = writableSelf.__key;
    writableNodeToInsert.__parent = writableSelf.__parent;
    if (restoreSelection && $isRangeSelection(selection)) {
      const index = this.getIndexWithinParent();
      $updateElementSelectionOnCreateDeleteNode(selection, writableParent, index + 1);
      const writableParentKey = writableParent.__key;
      if (elementAnchorSelectionOnNode) {
        selection.anchor.set(writableParentKey, index + 2, 'element');
      }
      if (elementFocusSelectionOnNode) {
        selection.focus.set(writableParentKey, index + 2, 'element');
      }
    }
    return nodeToInsert;
  }

  /**
   * Inserts a node before this LexicalNode (as the previous sibling).
   *
   * @param nodeToInsert - The node to insert before this one.
   * @param restoreSelection - Whether or not to attempt to resolve the
   * selection to the appropriate place after the operation is complete.
   * */
  insertBefore(nodeToInsert: LexicalNode, restoreSelection = true): LexicalNode {
    errorOnReadOnly();
    errorOnInsertTextNodeOnRoot(this, nodeToInsert);
    const writableSelf = this.getWritable();
    const writableNodeToInsert = nodeToInsert.getWritable();
    const insertKey = writableNodeToInsert.__key;
    removeFromParent(writableNodeToInsert);
    const prevSibling = this.getPreviousSibling();
    const writableParent = this.getParentOrThrow().getWritable();
    const prevKey = writableSelf.__prev;
    // TODO: this is O(n), can we improve?
    const index = this.getIndexWithinParent();
    if (prevSibling === null) {
      writableParent.__first = insertKey;
    } else {
      const writablePrevSibling = prevSibling.getWritable();
      writablePrevSibling.__next = insertKey;
    }
    writableParent.__size++;
    writableSelf.__prev = insertKey;
    writableNodeToInsert.__prev = prevKey;
    writableNodeToInsert.__next = writableSelf.__key;
    writableNodeToInsert.__parent = writableSelf.__parent;
    const selection = $getSelection();
    if (restoreSelection && $isRangeSelection(selection)) {
      const parent = this.getParentOrThrow();
      $updateElementSelectionOnCreateDeleteNode(selection, parent, index);
    }
    return nodeToInsert;
  }

  /**
   * Whether or not this node has a required parent. Used during copy + paste operations
   * to normalize nodes that would otherwise be orphaned. For example, ListItemNodes without
   * a ListNode parent or TextNodes with a ParagraphNode parent.
   *
   * */
  isParentRequired(): boolean {
    return false;
  }

  /**
   * The creation logic for any required parent. Should be implemented if {@link isParentRequired} returns true.
   *
   * */
  createParentElementNode(): ElementNode {
    return $createParagraphNode();
  }

  selectStart(): RangeSelection {
    return this.selectPrevious();
  }

  selectEnd(): RangeSelection {
    return this.selectNext(0, 0);
  }

  /**
   * Moves selection to the previous sibling of this node, at the specified offsets.
   *
   * @param anchorOffset - The anchor offset for selection.
   * @param focusOffset -  The focus offset for selection
   * */
  selectPrevious(anchorOffset?: number, focusOffset?: number): RangeSelection {
    errorOnReadOnly();
    const prevSibling = this.getPreviousSibling();
    const parent = this.getParentOrThrow();
    if (prevSibling === null) {
      return parent.select(0, 0);
    }
    if ($isElementNode(prevSibling)) {
      return prevSibling.select();
    } else if (!$isTextNode(prevSibling)) {
      const index = prevSibling.getIndexWithinParent() + 1;
      return parent.select(index, index);
    }
    return prevSibling.select(anchorOffset, focusOffset);
  }

  /**
   * Moves selection to the next sibling of this node, at the specified offsets.
   *
   * @param anchorOffset - The anchor offset for selection.
   * @param focusOffset -  The focus offset for selection
   * */
  selectNext(anchorOffset?: number, focusOffset?: number): RangeSelection {
    errorOnReadOnly();
    const nextSibling = this.getNextSibling();
    const parent = this.getParentOrThrow();
    if (nextSibling === null) {
      return parent.select();
    }
    if ($isElementNode(nextSibling)) {
      return nextSibling.select(0, 0);
    } else if (!$isTextNode(nextSibling)) {
      const index = nextSibling.getIndexWithinParent();
      return parent.select(index, index);
    }
    return nextSibling.select(anchorOffset, focusOffset);
  }

  /**
   * Marks a node dirty, triggering transforms and
   * forcing it to be reconciled during the update cycle.
   *
   * */
  markDirty(): void {
    this.getWritable();
  }

  /**
   * @internal
   *
   * When the reconciler detects that a node was mutated, this method
   * may be called to restore the node to a known good state.
   */
  reconcileObservedMutation(dom: HTMLElement, editor: LexicalEditor): void {
    this.markDirty();
  }
}

function errorOnTypeKlassMismatch(type: string, klass: Klass<LexicalNode>): void {
  const registeredNode = getRegisteredNode(getActiveEditor(), type);
  // Common error - split in its own invariant
  if (registeredNode === undefined) {
    invariant(
      false,
      'Create node: Attempted to create node %s that was not configured to be used on the editor.',
      klass.name,
    );
  }
  const editorKlass = registeredNode.klass;
  if (editorKlass !== klass) {
    invariant(
      false,
      'Create node: Type %s in node %s does not match registered node %s with the same type',
      type,
      klass.name,
      editorKlass.name,
    );
  }
}

/**
 * Insert a series of nodes after this LexicalNode (as next siblings)
 *
 * @param firstToInsert - The first node to insert after this one.
 * @param lastToInsert - The last node to insert after this one. Must be a
 * later sibling of FirstNode. If not provided, it will be its last sibling.
 */
export function insertRangeAfter(
  node: LexicalNode,
  firstToInsert: LexicalNode,
  lastToInsert?: LexicalNode,
) {
  const lastToInsert2 = lastToInsert || firstToInsert.getParentOrThrow().getLastChild()!;
  let current = firstToInsert;
  const nodesToInsert = [firstToInsert];
  while (current !== lastToInsert2) {
    if (!current.getNextSibling()) {
      invariant(false, 'insertRangeAfter: lastToInsert must be a later sibling of firstToInsert');
    }
    current = current.getNextSibling()!;
    nodesToInsert.push(current);
  }

  let currentNode: LexicalNode = node;
  for (const nodeToInsert of nodesToInsert) {
    currentNode = currentNode.insertAfter(nodeToInsert);
  }
}

export type Spread<T1, T2> = Omit<T2, keyof T1> & T1;

// https://github.com/microsoft/TypeScript/issues/3841
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KlassConstructor<Cls extends GenericConstructor<any>> = GenericConstructor<
  InstanceType<Cls>
> & { [k in keyof Cls]: Cls[k] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericConstructor<T> = new (...args: any[]) => T;

export type Klass<T extends LexicalNode> =
  InstanceType<
    // @ts-expect-error not error
    T['constructor']
  > extends T
    ? // @ts-expect-error not error
      T['constructor']
    : // @ts-expect-error not error
      GenericConstructor<T> & T['constructor'];

export type EditorThemeClassName = string;

export type TextNodeThemeClasses = {
  base?: EditorThemeClassName;
  bold?: EditorThemeClassName;
  code?: EditorThemeClassName;
  highlight?: EditorThemeClassName;
  italic?: EditorThemeClassName;
  lowercase?: EditorThemeClassName;
  uppercase?: EditorThemeClassName;
  capitalize?: EditorThemeClassName;
  strikethrough?: EditorThemeClassName;
  subscript?: EditorThemeClassName;
  superscript?: EditorThemeClassName;
  underline?: EditorThemeClassName;
  underlineStrikethrough?: EditorThemeClassName;
  [key: string]: EditorThemeClassName | undefined;
};

export type EditorUpdateOptions = {
  /**
   * A function to run once the update is complete. See also {@link $onUpdate}.
   */
  onUpdate?: () => void;
  /**
   * Setting this to true will suppress all node
   * transforms for this update cycle.
   * Useful for synchronizing updates in some cases.
   */
  skipTransforms?: true;
  /**
   * A tag to identify this update, in an update listener, for instance.
   * See also {@link $addUpdateTag}.
   */
  tag?: UpdateTag | UpdateTag[];
  /**
   * If true, prevents this update from being batched, forcing it to
   * run synchronously.
   */
  discrete?: true;
  /** @internal */
  event?: undefined | UIEvent | Event | null;
};

export type EditorSetOptions = {
  tag?: string;
};

export interface EditorFocusOptions {
  /**
   * Where to move selection when the editor is
   * focused. Can be rootStart, rootEnd, or undefined. Defaults to rootEnd.
   */
  defaultSelection?: 'rootStart' | 'rootEnd';
}

export type EditorThemeClasses = {
  blockCursor?: EditorThemeClassName;
  characterLimit?: EditorThemeClassName;
  code?: EditorThemeClassName;
  codeHighlight?: Record<string, EditorThemeClassName>;
  hashtag?: EditorThemeClassName;
  specialText?: EditorThemeClassName;
  heading?: {
    h1?: EditorThemeClassName;
    h2?: EditorThemeClassName;
    h3?: EditorThemeClassName;
    h4?: EditorThemeClassName;
    h5?: EditorThemeClassName;
    h6?: EditorThemeClassName;
  };
  hr?: EditorThemeClassName;
  hrSelected?: EditorThemeClassName;
  image?: EditorThemeClassName;
  link?: EditorThemeClassName;
  list?: {
    ul?: EditorThemeClassName;
    ulDepth?: Array<EditorThemeClassName>;
    ol?: EditorThemeClassName;
    olDepth?: Array<EditorThemeClassName>;
    checklist?: EditorThemeClassName;
    listitem?: EditorThemeClassName;
    listitemChecked?: EditorThemeClassName;
    listitemUnchecked?: EditorThemeClassName;
    nested?: {
      list?: EditorThemeClassName;
      listitem?: EditorThemeClassName;
    };
  };
  ltr?: EditorThemeClassName;
  mark?: EditorThemeClassName;
  markOverlap?: EditorThemeClassName;
  paragraph?: EditorThemeClassName;
  quote?: EditorThemeClassName;
  root?: EditorThemeClassName;
  rtl?: EditorThemeClassName;
  tab?: EditorThemeClassName;
  table?: EditorThemeClassName;
  tableAddColumns?: EditorThemeClassName;
  tableAddRows?: EditorThemeClassName;
  tableCellActionButton?: EditorThemeClassName;
  tableCellActionButtonContainer?: EditorThemeClassName;
  tableCellSelected?: EditorThemeClassName;
  tableCell?: EditorThemeClassName;
  tableCellHeader?: EditorThemeClassName;
  tableCellResizer?: EditorThemeClassName;
  tableRow?: EditorThemeClassName;
  tableScrollableWrapper?: EditorThemeClassName;
  tableSelected?: EditorThemeClassName;
  tableSelection?: EditorThemeClassName;
  text?: TextNodeThemeClasses;
  embedBlock?: {
    base?: EditorThemeClassName;
    focus?: EditorThemeClassName;
  };
  indent?: EditorThemeClassName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type EditorConfig = {
  disableEvents?: boolean;
  namespace: string;
  theme: EditorThemeClasses;
};

export type LexicalNodeReplacement = {
  replace: Klass<LexicalNode>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  with: <T extends { new (...args: any): any }>(node: InstanceType<T>) => LexicalNode;
  withKlass?: Klass<LexicalNode>;
};

export type HTMLConfig = {
  export?: DOMExportOutputMap;
  import?: DOMConversionMap;
};

/**
 * A LexicalNode class or LexicalNodeReplacement configuration
 */
export type LexicalNodeConfig = Klass<LexicalNode> | LexicalNodeReplacement;

export type CreateEditorArgs = {
  disableEvents?: boolean;
  editorState?: EditorState;
  namespace?: string;
  nodes?: ReadonlyArray<LexicalNodeConfig>;
  onError?: ErrorHandler;
  parentEditor?: LexicalEditor;
  editable?: boolean;
  theme?: EditorThemeClasses;
  html?: HTMLConfig;
};

export type RegisteredNodes = Map<string, RegisteredNode>;

export type RegisteredNode = {
  klass: Klass<LexicalNode>;
  transforms: Set<Transform<LexicalNode>>;
  replace: null | ((node: LexicalNode) => LexicalNode);
  replaceWithKlass: null | Klass<LexicalNode>;
  exportDOM?: (editor: LexicalEditor, targetNode: LexicalNode) => DOMExportOutput;
  sharedNodeState: SharedNodeState;
};

export type Transform<T extends LexicalNode> = (node: T) => void;

export type ErrorHandler = (error: Error) => void;

export type MutationListeners = Map<MutationListener, Set<Klass<LexicalNode>>>;

export type MutatedNodes = Map<Klass<LexicalNode>, Map<NodeKey, NodeMutation>>;

export type NodeMutation = 'created' | 'updated' | 'destroyed';

export interface MutationListenerOptions {
  /**
   * Skip the initial call of the listener with pre-existing DOM nodes.
   *
   * The default was previously true for backwards compatibility with <= 0.16.1
   * but this default has been changed to false as of 0.21.0.
   */
  skipInitialization?: boolean;
}

const DEFAULT_SKIP_INITIALIZATION = false;

/**
 * The payload passed to an UpdateListener
 */
export interface UpdateListenerPayload {
  /**
   * A Map of NodeKeys of ElementNodes to a boolean that is true
   * if the node was intentionally mutated ('unintentional' mutations
   * are triggered when an indirect descendant is marked dirty)
   */
  dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>;
  /**
   * A Set of NodeKeys of all nodes that were marked dirty that
   * do not inherit from ElementNode.
   */
  dirtyLeaves: Set<NodeKey>;
  /**
   * The new EditorState after all updates have been processed,
   * equivalent to `editor.getEditorState()`
   */
  editorState: EditorState;
  /**
   * The Map of LexicalNode constructors to a `Map<NodeKey, NodeMutation>`,
   * this is useful when you have a mutation listener type use cases that
   * should apply to all or most nodes. Will be null if no DOM was mutated,
   * such as when only the selection changed. Note that this will be empty
   * unless at least one MutationListener is explicitly registered
   * (any MutationListener is sufficient to compute the mutatedNodes Map
   * for all nodes).
   *
   * Added in v0.28.0
   */
  mutatedNodes: null | MutatedNodes;
  /**
   * For advanced use cases only.
   *
   * Tracks the keys of TextNode descendants that have been merged
   * with their siblings by normalization. Note that these keys may
   * not exist in either editorState or prevEditorState and generally
   * this is only used for conflict resolution edge cases in collab.
   */
  normalizedNodes: Set<NodeKey>;
  /**
   * The previous EditorState that is being discarded
   */
  prevEditorState: EditorState;
  /**
   * The set of tags added with update options or {@link $addUpdateTag},
   * node that this includes all tags that were processed in this
   * reconciliation which may have been added by separate updates.
   */
  tags: Set<string>;
}

/**
 * A listener that gets called after the editor is updated
 */
export type UpdateListener = (payload: UpdateListenerPayload) => void;

export type DecoratorListener<T = never> = (decorator: Record<NodeKey, T>) => void;

export type RootListener = (
  rootElement: null | HTMLElement,
  prevRootElement: null | HTMLElement,
) => void;

export type TextContentListener = (text: string) => void;

export type MutationListener = (
  nodes: Map<NodeKey, NodeMutation>,
  payload: {
    updateTags: Set<string>;
    dirtyLeaves: Set<string>;
    prevEditorState: EditorState;
  },
) => void;

export type CommandListener<P> = (payload: P, editor: LexicalEditor) => boolean;

export type EditableListener = (editable: boolean) => void;

export type CommandListenerPriority = 0 | 1 | 2 | 3 | 4;

export const COMMAND_PRIORITY_EDITOR = 0;
export const COMMAND_PRIORITY_LOW = 1;
export const COMMAND_PRIORITY_NORMAL = 2;
export const COMMAND_PRIORITY_HIGH = 3;
export const COMMAND_PRIORITY_CRITICAL = 4;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type LexicalCommand<TPayload> = {
  type?: string;
};

/**
 * Type helper for extracting the payload type from a command.
 *
 * @example
 * ```ts
 * const MY_COMMAND = createCommand<SomeType>();
 *
 * // ...
 *
 * editor.registerCommand(MY_COMMAND, payload => {
 *   // Type of `payload` is inferred here. But lets say we want to extract a function to delegate to
 *   $handleMyCommand(editor, payload);
 *   return true;
 * });
 *
 * function $handleMyCommand(editor: LexicalEditor, payload: CommandPayloadType<typeof MY_COMMAND>) {
 *   // `payload` is of type `SomeType`, extracted from the command.
 * }
 * ```
 */
export type CommandPayloadType<TCommand extends LexicalCommand<unknown>> =
  TCommand extends LexicalCommand<infer TPayload> ? TPayload : never;

type Commands = Map<LexicalCommand<unknown>, Array<Set<CommandListener<unknown>>>>;

export interface Listeners {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decorator: Set<DecoratorListener<any>>;
  mutation: MutationListeners;
  editable: Set<EditableListener>;
  root: Set<RootListener>;
  textcontent: Set<TextContentListener>;
  update: Set<UpdateListener>;
}

export type SetListeners = {
  [K in keyof Listeners as Listeners[K] extends Set<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]) => void
  >
    ? K
    : never]: Listeners[K] extends Set<(...args: infer Args) => void> ? Args : never;
};

export type TransformerType = 'text' | 'decorator' | 'element' | 'root';

type DOMConversionCache = Map<string, Array<(node: Node) => DOMConversion | null>>;

export type SerializedEditor = {
  editorState: SerializedEditorState;
};

export function resetEditor(
  editor: LexicalEditor,
  prevRootElement: null | HTMLElement,
  nextRootElement: null | HTMLElement,
  pendingEditorState: EditorState,
): void {
  const keyNodeMap = editor._keyToDOMMap;
  keyNodeMap.clear();
  editor._editorState = createEmptyEditorState();
  editor._pendingEditorState = pendingEditorState;
  editor._compositionKey = null;
  editor._dirtyType = NO_DIRTY_NODES;
  editor._cloneNotNeeded.clear();
  editor._dirtyLeaves = new Set();
  editor._dirtyElements.clear();
  editor._normalizedNodes = new Set();
  editor._updateTags = new Set();
  editor._updates = [];
  editor._blockCursorElement = null;

  const observer = editor._observer;

  if (observer !== null) {
    observer.disconnect();
    editor._observer = null;
  }

  // Remove all the DOM nodes from the root element
  if (prevRootElement !== null) {
    prevRootElement.textContent = '';
  }

  if (nextRootElement !== null) {
    nextRootElement.textContent = '';
    keyNodeMap.set('root', nextRootElement);
  }
}

function initializeConversionCache(
  nodes: RegisteredNodes,
  additionalConversions?: DOMConversionMap,
): DOMConversionCache {
  const conversionCache = new Map();
  const handledConversions = new Set();
  const addConversionsToCache = (map: DOMConversionMap) => {
    Object.keys(map).forEach((key) => {
      let currentCache = conversionCache.get(key);

      if (currentCache === undefined) {
        currentCache = [];
        conversionCache.set(key, currentCache);
      }

      currentCache.push(map[key]);
    });
  };
  nodes.forEach((node) => {
    // @ts-expect-error not error
    const importDOM = node.klass.importDOM;

    if (importDOM == null || handledConversions.has(importDOM)) {
      return;
    }

    handledConversions.add(importDOM);
    const map = importDOM.call(node.klass);

    if (map !== null) {
      addConversionsToCache(map);
    }
  });
  if (additionalConversions) {
    addConversionsToCache(additionalConversions);
  }
  return conversionCache;
}

/**
 * Creates a new LexicalEditor attached to a single contentEditable (provided in the config). This is
 * the lowest-level initialization API for a LexicalEditor. If you're using React or another framework,
 * consider using the appropriate abstractions, such as LexicalComposer
 * @param editorConfig - the editor configuration.
 * @returns a LexicalEditor instance
 */
export function createEditor(editorConfig?: CreateEditorArgs): LexicalEditor {
  const config = editorConfig || {};
  const activeEditor = internalGetActiveEditor();
  const theme = config.theme || {};
  const parentEditor = editorConfig === undefined ? activeEditor : config.parentEditor || null;
  const disableEvents = config.disableEvents || false;
  const editorState = createEmptyEditorState();
  const namespace =
    config.namespace || (parentEditor !== null ? parentEditor._config.namespace : createUID());
  const initialEditorState = config.editorState;
  const nodes = [
    RootNode,
    TextNode,
    LineBreakNode,
    TabNode,
    ParagraphNode,
    ArtificialNode__DO_NOT_USE,
    ...(config.nodes || []),
  ];
  const { onError, html } = config;
  const isEditable = config.editable !== undefined ? config.editable : true;
  let registeredNodes: RegisteredNodes;

  if (editorConfig === undefined && activeEditor !== null) {
    registeredNodes = activeEditor._nodes;
  } else {
    registeredNodes = new Map();
    for (let i = 0; i < nodes.length; i++) {
      let klass = nodes[i];
      let replace: RegisteredNode['replace'] = null;
      let replaceWithKlass: RegisteredNode['replaceWithKlass'] = null;

      if (typeof klass !== 'function') {
        const options = klass;
        klass = options.replace;
        replace = options.with;
        replaceWithKlass = options.withKlass || null;
      }
      const { ownNodeConfig } = getStaticNodeConfig(klass);
      // Ensure custom nodes implement required methods and replaceWithKlass is instance of base klass.
      // @ts-expect-error not error
      if (globalThis.__DEV__) {
        // ArtificialNode__DO_NOT_USE can get renamed, so we use the type
        const name = klass.name;
        const nodeType =
          // @ts-expect-error not error
          hasOwnStaticMethod(klass, 'getType') && klass.getType();

        if (replaceWithKlass) {
          invariant(
            replaceWithKlass.prototype instanceof klass,
            "%s doesn't extend the %s",
            replaceWithKlass.name,
            name,
          );
        } else if (replace) {
          console.warn(
            `Override for ${name} specifies 'replace' without 'withKlass'. 'withKlass' will be required in a future version.`,
          );
        }
        if (
          name !== 'RootNode' &&
          nodeType !== 'root' &&
          nodeType !== 'artificial' &&
          // This is mostly for the unit test suite which
          // uses LexicalNode in an otherwise incorrect way
          // by mocking its static getType
          klass !== LexicalNode
        ) {
          const proto = klass.prototype;
          (['getType', 'clone'] as const).forEach((method) => {
            // @ts-expect-error not error
            if (!hasOwnStaticMethod(klass, method)) {
              console.warn(`${name} must implement static "${method}" method`);
            }
          });
          if (
            // @ts-expect-error not error
            !hasOwnStaticMethod(klass, 'importDOM') &&
            hasOwnExportDOM(klass)
          ) {
            console.warn(
              `${name} should implement "importDOM" if using a custom "exportDOM" method to ensure HTML serialization (important for copy & paste) works as expected`,
            );
          }
          if ($isDecoratorNode(proto)) {
            if (proto.decorate === DecoratorNode.prototype.decorate) {
              console.warn(`${proto.constructor.name} must implement "decorate" method`);
            }
          }
          // @ts-expect-error not error
          if (!hasOwnStaticMethod(klass, 'importJSON')) {
            console.warn(
              `${name} should implement "importJSON" method to ensure JSON and default HTML serialization works as expected`,
            );
          }
        }
      }
      // @ts-expect-error not error
      const type = klass.getType();
      // @ts-expect-error not error
      const transform = klass.transform();
      const transforms = new Set<Transform<LexicalNode>>();
      if (ownNodeConfig && ownNodeConfig.$transform) {
        transforms.add(ownNodeConfig.$transform);
      }
      if (transform !== null) {
        transforms.add(transform);
      }
      registeredNodes.set(type, {
        exportDOM: html && html.export ? html.export.get(klass) : undefined,
        klass,
        replace,
        replaceWithKlass,
        sharedNodeState: createSharedNodeState(nodes[i]),
        transforms,
      });
    }
  }
  const editor = new LexicalEditor(
    editorState,
    parentEditor,
    registeredNodes,
    {
      disableEvents,
      namespace,
      theme,
    },
    onError ? onError : console.error,
    initializeConversionCache(registeredNodes, html ? html.import : undefined),
    isEditable,
    editorConfig,
  );

  if (initialEditorState !== undefined) {
    editor._pendingEditorState = initialEditorState;
    editor._dirtyType = FULL_RECONCILE;
  }

  return editor;
}

export class LexicalEditor {
  // ['constructor']!: KlassConstructor<typeof LexicalEditor>;

  /** The version with build identifiers for this editor (since 0.17.1) */
  static version: string | undefined;

  /** @internal */
  _headless: boolean;
  /** @internal */
  _parentEditor: null | LexicalEditor;
  /** @internal */
  _rootElement: null | HTMLElement;
  /** @internal */
  _editorState: EditorState;
  /** @internal */
  _pendingEditorState: null | EditorState;
  /** @internal */
  _compositionKey: null | NodeKey;
  /** @internal */
  _deferred: Array<() => void>;
  /** @internal */
  _keyToDOMMap: Map<NodeKey, HTMLElement>;
  /** @internal */
  _updates: Array<[() => void, EditorUpdateOptions | undefined]>;
  /** @internal */
  _updating: boolean;
  /** @internal */
  _listeners: Listeners;
  /** @internal */
  _commands: Commands;
  /** @internal */
  _nodes: RegisteredNodes;
  /** @internal */
  _decorators: Record<NodeKey, unknown>;
  /** @internal */
  _pendingDecorators: null | Record<NodeKey, unknown>;
  /** @internal */
  _config: EditorConfig;
  /** @internal */
  _dirtyType: 0 | 1 | 2;
  /** @internal */
  _cloneNotNeeded: Set<NodeKey>;
  /** @internal */
  _dirtyLeaves: Set<NodeKey>;
  /** @internal */
  _dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>;
  /** @internal */
  _normalizedNodes: Set<NodeKey>;
  /** @internal */
  _updateTags: Set<UpdateTag>;
  /** @internal */
  _observer: null | MutationObserver;
  /** @internal */
  _key: string;
  /** @internal */
  _onError: ErrorHandler;
  /** @internal */
  _htmlConversions: DOMConversionCache;
  /** @internal */
  _window: null | Window;
  /** @internal */
  _editable: boolean;
  /** @internal */
  _blockCursorElement: null | HTMLDivElement;
  /** @internal */
  _createEditorArgs?: undefined | CreateEditorArgs;

  /** @internal */
  constructor(
    editorState: EditorState,
    parentEditor: null | LexicalEditor,
    nodes: RegisteredNodes,
    config: EditorConfig,
    onError: ErrorHandler,
    htmlConversions: DOMConversionCache,
    editable: boolean,
    createEditorArgs?: CreateEditorArgs,
  ) {
    this._createEditorArgs = createEditorArgs;
    this._parentEditor = parentEditor;
    // The root element associated with this editor
    this._rootElement = null;
    // The current editor state
    this._editorState = editorState;
    // Handling of drafts and updates
    this._pendingEditorState = null;
    // Used to help co-ordinate selection and events
    this._compositionKey = null;
    this._deferred = [];
    // Used during reconciliation
    this._keyToDOMMap = new Map();
    this._updates = [];
    this._updating = false;
    // Listeners
    this._listeners = {
      decorator: new Set(),
      editable: new Set(),
      mutation: new Map(),
      root: new Set(),
      textcontent: new Set(),
      update: new Set(),
    };
    // Commands
    this._commands = new Map();
    // Editor configuration for theme/context.
    this._config = config;
    // Mapping of types to their nodes
    this._nodes = nodes;
    // React node decorators for portals
    this._decorators = {};
    this._pendingDecorators = null;
    // Used to optimize reconciliation
    this._dirtyType = NO_DIRTY_NODES;
    this._cloneNotNeeded = new Set();
    this._dirtyLeaves = new Set();
    this._dirtyElements = new Map();
    this._normalizedNodes = new Set();
    this._updateTags = new Set();
    // Handling of DOM mutations
    this._observer = null;
    // Used for identifying owning editors
    this._key = createUID();

    this._onError = onError;
    this._htmlConversions = htmlConversions;
    this._editable = editable;
    this._headless = parentEditor !== null && parentEditor._headless;
    this._window = null;
    this._blockCursorElement = null;
  }

  /**
   *
   * @returns true if the editor is currently in "composition" mode due to receiving input
   * through an IME, or 3P extension, for example. Returns false otherwise.
   */
  isComposing(): boolean {
    return this._compositionKey != null;
  }
  /**
   * Registers a listener for Editor update event. Will trigger the provided callback
   * each time the editor goes through an update (via {@link LexicalEditor.update}) until the
   * teardown function is called.
   *
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerUpdateListener(listener: UpdateListener): () => void {
    const listenerSetOrMap = this._listeners.update;
    listenerSetOrMap.add(listener);
    return () => {
      listenerSetOrMap.delete(listener);
    };
  }
  /**
   * Registers a listener for for when the editor changes between editable and non-editable states.
   * Will trigger the provided callback each time the editor transitions between these states until the
   * teardown function is called.
   *
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerEditableListener(listener: EditableListener): () => void {
    const listenerSetOrMap = this._listeners.editable;
    listenerSetOrMap.add(listener);
    return () => {
      listenerSetOrMap.delete(listener);
    };
  }
  /**
   * Registers a listener for when the editor's decorator object changes. The decorator object contains
   * all DecoratorNode keys -> their decorated value. This is primarily used with external UI frameworks.
   *
   * Will trigger the provided callback each time the editor transitions between these states until the
   * teardown function is called.
   *
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerDecoratorListener<T>(listener: DecoratorListener<T>): () => void {
    const listenerSetOrMap = this._listeners.decorator;
    listenerSetOrMap.add(listener);
    return () => {
      listenerSetOrMap.delete(listener);
    };
  }
  /**
   * Registers a listener for when Lexical commits an update to the DOM and the text content of
   * the editor changes from the previous state of the editor. If the text content is the
   * same between updates, no notifications to the listeners will happen.
   *
   * Will trigger the provided callback each time the editor transitions between these states until the
   * teardown function is called.
   *
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerTextContentListener(listener: TextContentListener): () => void {
    const listenerSetOrMap = this._listeners.textcontent;
    listenerSetOrMap.add(listener);
    return () => {
      listenerSetOrMap.delete(listener);
    };
  }
  /**
   * Registers a listener for when the editor's root DOM element (the content editable
   * Lexical attaches to) changes. This is primarily used to attach event listeners to the root
   *  element. The root listener function is executed directly upon registration and then on
   * any subsequent update.
   *
   * Will trigger the provided callback each time the editor transitions between these states until the
   * teardown function is called.
   *
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerRootListener(listener: RootListener): () => void {
    const listenerSetOrMap = this._listeners.root;
    listener(this._rootElement, null);
    listenerSetOrMap.add(listener);
    return () => {
      listener(null, this._rootElement);
      listenerSetOrMap.delete(listener);
    };
  }
  /**
   * Registers a listener that will trigger anytime the provided command
   * is dispatched with {@link LexicalEditor.dispatch}, subject to priority.
   * Listeners that run at a higher priority can "intercept" commands and
   * prevent them from propagating to other handlers by returning true.
   *
   * Listeners are always invoked in an {@link LexicalEditor.update} and can
   * call dollar functions.
   *
   * Listeners registered at the same priority level will run
   * deterministically in the order of registration.
   *
   * @param command - the command that will trigger the callback.
   * @param listener - the function that will execute when the command is dispatched.
   * @param priority - the relative priority of the listener. 0 | 1 | 2 | 3 | 4
   *   (or {@link COMMAND_PRIORITY_EDITOR} |
   *     {@link COMMAND_PRIORITY_LOW} |
   *     {@link COMMAND_PRIORITY_NORMAL} |
   *     {@link COMMAND_PRIORITY_HIGH} |
   *     {@link COMMAND_PRIORITY_CRITICAL})
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerCommand<P>(
    command: LexicalCommand<P>,
    listener: CommandListener<P>,
    priority: CommandListenerPriority,
  ): () => void {
    if (priority === undefined) {
      invariant(false, 'Listener for type "command" requires a "priority".');
    }

    const commandsMap = this._commands;

    if (!commandsMap.has(command)) {
      commandsMap.set(command, [new Set(), new Set(), new Set(), new Set(), new Set()]);
    }

    const listenersInPriorityOrder = commandsMap.get(command);

    if (listenersInPriorityOrder === undefined) {
      invariant(false, 'registerCommand: Command %s not found in command map', String(command));
    }

    const listeners = listenersInPriorityOrder[priority];
    listeners.add(listener as CommandListener<unknown>);
    return () => {
      listeners.delete(listener as CommandListener<unknown>);

      if (listenersInPriorityOrder.every((listenersSet) => listenersSet.size === 0)) {
        commandsMap.delete(command);
      }
    };
  }

  /**
   * Registers a listener that will run when a Lexical node of the provided class is
   * mutated. The listener will receive a list of nodes along with the type of mutation
   * that was performed on each: created, destroyed, or updated.
   *
   * One common use case for this is to attach DOM event listeners to the underlying DOM nodes as Lexical nodes are created.
   * {@link LexicalEditor.getElementByKey} can be used for this.
   *
   * If any existing nodes are in the DOM, and skipInitialization is not true, the listener
   * will be called immediately with an updateTag of 'registerMutationListener' where all
   * nodes have the 'created' NodeMutation. This can be controlled with the skipInitialization option
   * (whose default was previously true for backwards compatibility with &lt;=0.16.1 but has been changed to false as of 0.21.0).
   *
   * @param klass - The class of the node that you want to listen to mutations on.
   * @param listener - The logic you want to run when the node is mutated.
   * @param options - see {@link MutationListenerOptions}
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerMutationListener(
    klass: Klass<LexicalNode>,
    listener: MutationListener,
    options?: MutationListenerOptions,
  ): () => void {
    const klassToMutate = this.resolveRegisteredNodeAfterReplacements(
      this.getRegisteredNode(klass),
    ).klass;
    const mutations = this._listeners.mutation;
    let klassSet = mutations.get(listener);
    if (klassSet === undefined) {
      klassSet = new Set();
      mutations.set(listener, klassSet);
    }
    klassSet.add(klassToMutate);
    const skipInitialization = options && options.skipInitialization;
    if (!(skipInitialization === undefined ? DEFAULT_SKIP_INITIALIZATION : skipInitialization)) {
      this.initializeMutationListener(listener, klassToMutate);
    }

    return () => {
      klassSet.delete(klassToMutate);
      if (klassSet.size === 0) {
        mutations.delete(listener);
      }
    };
  }

  /** @internal */
  getRegisteredNode(klass: Klass<LexicalNode>): RegisteredNode {
    // @ts-expect-error not error
    const registeredNode = this._nodes.get(klass.getType());

    if (registeredNode === undefined) {
      invariant(
        false,
        'Node %s has not been registered. Ensure node has been passed to createEditor.',
        klass.name,
      );
    }

    return registeredNode;
  }

  /** @internal */
  resolveRegisteredNodeAfterReplacements(registeredNode: RegisteredNode): RegisteredNode {
    while (registeredNode.replaceWithKlass) {
      registeredNode = this.getRegisteredNode(registeredNode.replaceWithKlass);
    }
    return registeredNode;
  }

  /** @internal */
  private initializeMutationListener(listener: MutationListener, klass: Klass<LexicalNode>): void {
    const prevEditorState = this._editorState;
    const nodeMap = getCachedTypeToNodeMap(prevEditorState).get(
      // @ts-expect-error not error
      klass.getType(),
    );
    if (!nodeMap) {
      return;
    }
    const nodeMutationMap = new Map<string, NodeMutation>();
    for (const k of nodeMap.keys()) {
      nodeMutationMap.set(k, 'created');
    }
    if (nodeMutationMap.size > 0) {
      listener(nodeMutationMap, {
        dirtyLeaves: new Set(),
        prevEditorState,
        updateTags: new Set(['registerMutationListener']),
      });
    }
  }

  /** @internal */
  private registerNodeTransformToKlass<T extends LexicalNode>(
    klass: Klass<T>,
    listener: Transform<T>,
  ): RegisteredNode {
    const registeredNode = this.getRegisteredNode(klass);
    registeredNode.transforms.add(listener as Transform<LexicalNode>);

    return registeredNode;
  }

  /**
   * Registers a listener that will run when a Lexical node of the provided class is
   * marked dirty during an update. The listener will continue to run as long as the node
   * is marked dirty. There are no guarantees around the order of transform execution!
   *
   * Watch out for infinite loops. See [Node Transforms](https://lexical.dev/docs/concepts/transforms)
   * @param klass - The class of the node that you want to run transforms on.
   * @param listener - The logic you want to run when the node is updated.
   * @returns a teardown function that can be used to cleanup the listener.
   */
  registerNodeTransform<T extends LexicalNode>(
    klass: Klass<T>,
    listener: Transform<T>,
  ): () => void {
    const registeredNode = this.registerNodeTransformToKlass(klass, listener);
    const registeredNodes = [registeredNode];

    const replaceWithKlass = registeredNode.replaceWithKlass;
    if (replaceWithKlass != null) {
      const registeredReplaceWithNode = this.registerNodeTransformToKlass(
        replaceWithKlass,
        listener as Transform<LexicalNode>,
      );
      registeredNodes.push(registeredReplaceWithNode);
    }

    markNodesWithTypesAsDirty(
      this,
      // @ts-expect-error not error
      registeredNodes.map((node) => node.klass.getType()),
    );
    return () => {
      registeredNodes.forEach((node) => node.transforms.delete(listener as Transform<LexicalNode>));
    };
  }

  /**
   * Used to assert that a certain node is registered, usually by plugins to ensure nodes that they
   * depend on have been registered.
   * @returns True if the editor has registered the provided node type, false otherwise.
   */
  hasNode<T extends Klass<LexicalNode>>(node: T): boolean {
    // @ts-expect-error not error
    return this._nodes.has(node.getType());
  }

  /**
   * Used to assert that certain nodes are registered, usually by plugins to ensure nodes that they
   * depend on have been registered.
   * @returns True if the editor has registered all of the provided node types, false otherwise.
   */
  hasNodes<T extends Klass<LexicalNode>>(nodes: Array<T>): boolean {
    return nodes.every(this.hasNode.bind(this));
  }

  /**
   * Dispatches a command of the specified type with the specified payload.
   * This triggers all command listeners (set by {@link LexicalEditor.registerCommand})
   * for this type, passing them the provided payload. The command listeners
   * will be triggered in an implicit {@link LexicalEditor.update}, unless
   * this was invoked from inside an update in which case that update context
   * will be re-used (as if this was a dollar function itself).
   * @param type - the type of command listeners to trigger.
   * @param payload - the data to pass as an argument to the command listeners.
   */
  dispatchCommand<TCommand extends LexicalCommand<unknown>>(
    type: TCommand,
    payload: CommandPayloadType<TCommand>,
  ): boolean {
    return dispatchCommand(this, type, payload);
  }

  /**
   * Gets a map of all decorators in the editor.
   * @returns A mapping of call decorator keys to their decorated content
   */
  getDecorators<T>(): Record<NodeKey, T> {
    return this._decorators as Record<NodeKey, T>;
  }

  /**
   *
   * @returns the current root element of the editor. If you want to register
   * an event listener, do it via {@link LexicalEditor.registerRootListener}, since
   * this reference may not be stable.
   */
  getRootElement(): null | HTMLElement {
    return this._rootElement;
  }

  /**
   * Gets the key of the editor
   * @returns The editor key
   */
  getKey(): string {
    return this._key;
  }

  /**
   * Imperatively set the root contenteditable element that Lexical listens
   * for events on.
   */
  setRootElement(nextRootElement: null | HTMLElement): void {
    const prevRootElement = this._rootElement;

    if (nextRootElement !== prevRootElement) {
      const classNames = getCachedClassNameArray(this._config.theme, 'root');
      const pendingEditorState = this._pendingEditorState || this._editorState;
      this._rootElement = nextRootElement;
      resetEditor(this, prevRootElement, nextRootElement, pendingEditorState);

      if (prevRootElement !== null) {
        // TODO: remove this flag once we no longer use UEv2 internally
        if (!this._config.disableEvents) {
          removeRootElementEvents(prevRootElement);
        }
        if (classNames != null) {
          prevRootElement.classList.remove(...classNames);
        }
      }

      if (nextRootElement !== null) {
        const windowObj = getDefaultView(nextRootElement);
        const style = nextRootElement.style;
        style.userSelect = 'text';
        style.whiteSpace = 'pre-wrap';
        style.wordBreak = 'break-word';
        // eslint-disable-next-line unicorn/prefer-dom-node-dataset
        nextRootElement.setAttribute('data-lexical-editor', 'true');
        this._window = windowObj;
        this._dirtyType = FULL_RECONCILE;
        initMutationObserver(this);

        this._updateTags.add(HISTORY_MERGE_TAG);

        $commitPendingUpdates(this);

        // TODO: remove this flag once we no longer use UEv2 internally
        if (!this._config.disableEvents) {
          addRootElementEvents(nextRootElement, this);
        }
        if (classNames != null) {
          nextRootElement.classList.add(...classNames);
        }
        // @ts-expect-error not error
        if (globalThis.__DEV__) {
          const nextRootElementParent = nextRootElement.parentElement;
          if (
            nextRootElementParent != null &&
            ['flex', 'inline-flex'].includes(getComputedStyle(nextRootElementParent).display)
          ) {
            console.warn(
              `When using "display: flex" or "display: inline-flex" on an element containing content editable, Chrome may have unwanted focusing behavior when clicking outside of it. Consider wrapping the content editable within a non-flex element.`,
            );
          }
        }
      } else {
        // When the content editable is unmounted we will still trigger a
        // reconciliation so that any pending updates are flushed,
        // to match the previous state change when
        // `_editorState = pendingEditorState` was used, but by
        // using a commit we preserve the readOnly invariant
        // for editor.getEditorState().
        this._window = null;
        this._updateTags.add(HISTORY_MERGE_TAG);
        $commitPendingUpdates(this);
      }

      triggerListeners('root', this, false, nextRootElement, prevRootElement);
    }
  }

  /**
   * Gets the underlying HTMLElement associated with the LexicalNode for the given key.
   * @returns the HTMLElement rendered by the LexicalNode associated with the key.
   * @param key - the key of the LexicalNode.
   */
  getElementByKey(key: NodeKey): HTMLElement | null {
    return this._keyToDOMMap.get(key) || null;
  }

  /**
   * Gets the active editor state.
   * @returns The editor state
   */
  getEditorState(): EditorState {
    return this._editorState;
  }

  /**
   * Imperatively set the EditorState. Triggers reconciliation like an update.
   * @param editorState - the state to set the editor
   * @param options - options for the update.
   */
  setEditorState(editorState: EditorState, options?: EditorSetOptions): void {
    if (editorState.isEmpty()) {
      invariant(
        false,
        "setEditorState: the editor state is empty. Ensure the editor state's root node never becomes empty.",
      );
    }

    // Ensure that we have a writable EditorState so that transforms can run
    // during a historic operation
    let writableEditorState = editorState;
    if (writableEditorState._readOnly) {
      writableEditorState = cloneEditorState(editorState);
      writableEditorState._selection = editorState._selection
        ? editorState._selection.clone()
        : null;
    }

    flushRootMutations(this);
    const pendingEditorState = this._pendingEditorState;
    const tags = this._updateTags;
    const tag = options !== undefined ? options.tag : null;

    if (pendingEditorState !== null && !pendingEditorState.isEmpty()) {
      if (tag != null) {
        tags.add(tag);
      }
      $commitPendingUpdates(this);
    }

    this._pendingEditorState = writableEditorState;
    this._dirtyType = FULL_RECONCILE;
    this._dirtyElements.set('root', false);
    this._compositionKey = null;

    if (tag != null) {
      tags.add(tag);
    }

    // Only commit pending updates if not already in an editor.update
    // (e.g. dispatchCommand) otherwise this will cause a second commit
    // with an already read-only state and selection
    if (!this._updating) {
      $commitPendingUpdates(this);
    }
  }

  /**
   * Parses a SerializedEditorState (usually produced by {@link EditorState.toJSON}) and returns
   * and EditorState object that can be, for example, passed to {@link LexicalEditor.setEditorState}. Typically,
   * deserialization from JSON stored in a database uses this method.
   * @param maybeStringifiedEditorState
   * @param updateFn
   * @returns
   */
  parseEditorState(
    maybeStringifiedEditorState: string | SerializedEditorState,
    updateFn?: () => void,
  ): EditorState {
    const serializedEditorState =
      typeof maybeStringifiedEditorState === 'string'
        ? JSON.parse(maybeStringifiedEditorState)
        : maybeStringifiedEditorState;
    return parseEditorState(serializedEditorState, this, updateFn);
  }

  /**
   * Executes a read of the editor's state, with the
   * editor context available (useful for exporting and read-only DOM
   * operations). Much like update, but prevents any mutation of the
   * editor's state. Any pending updates will be flushed immediately before
   * the read.
   * @param callbackFn - A function that has access to read-only editor state.
   */
  read<T>(callbackFn: () => T): T {
    $commitPendingUpdates(this);
    return this.getEditorState().read(callbackFn, { editor: this });
  }

  /**
   * Executes an update to the editor state. The updateFn callback is the ONLY place
   * where Lexical editor state can be safely mutated.
   * @param updateFn - A function that has access to writable editor state.
   * @param options - A bag of options to control the behavior of the update.
   */
  update(updateFn: () => void, options?: EditorUpdateOptions): void {
    updateEditor(this, updateFn, options);
  }

  /**
   * Focuses the editor by marking the existing selection as dirty, or by
   * creating a new selection at `defaultSelection` if one does not already
   * exist. If you want to force a specific selection, you should call
   * `root.selectStart()` or `root.selectEnd()` in an update.
   *
   * @param callbackFn - A function to run after the editor is focused.
   * @param options - A bag of options
   */
  focus(callbackFn?: () => void, options: EditorFocusOptions = {}): void {
    const rootElement = this._rootElement;

    if (rootElement !== null) {
      // This ensures that iOS does not trigger caps lock upon focus
      rootElement.setAttribute('autocapitalize', 'off');
      updateEditorSync(this, () => {
        const selection = $getSelection();
        const root = $getRoot();

        if (selection !== null) {
          // Marking the selection dirty will force the selection back to it
          if (!selection.dirty) {
            $setSelection(selection.clone());
          }
        } else if (root.getChildrenSize() !== 0) {
          if (options.defaultSelection === 'rootStart') {
            root.selectStart();
          } else {
            root.selectEnd();
          }
        }
        $addUpdateTag(FOCUS_TAG);
        $onUpdate(() => {
          rootElement.removeAttribute('autocapitalize');
          if (callbackFn) {
            callbackFn();
          }
        });
      });
      // In the case where onUpdate doesn't fire (due to the focus update not
      // occurring).
      if (this._pendingEditorState === null) {
        rootElement.removeAttribute('autocapitalize');
      }
    }
  }

  /**
   * Removes focus from the editor.
   */
  blur(): void {
    const rootElement = this._rootElement;

    if (rootElement !== null) {
      rootElement.blur();
    }

    const domSelection = getDOMSelection(this._window);

    if (domSelection !== null) {
      domSelection.removeAllRanges();
    }
  }
  /**
   * Returns true if the editor is editable, false otherwise.
   * @returns True if the editor is editable, false otherwise.
   */
  isEditable(): boolean {
    return this._editable;
  }
  /**
   * Sets the editable property of the editor. When false, the
   * editor will not listen for user events on the underling contenteditable.
   * @param editable - the value to set the editable mode to.
   */
  setEditable(editable: boolean): void {
    if (this._editable !== editable) {
      this._editable = editable;
      triggerListeners('editable', this, true, editable);
    }
  }
  /**
   * Returns a JSON-serializable javascript object NOT a JSON string.
   * You still must call JSON.stringify (or something else) to turn the
   * state into a string you can transfer over the wire and store in a database.
   *
   * See {@link LexicalNode.exportJSON}
   *
   * @returns A JSON-serializable javascript object
   */
  toJSON(): SerializedEditor {
    return {
      editorState: this._editorState.toJSON(),
    };
  }
}

LexicalEditor.version = process.env.LEXICAL_VERSION;

type RootElementRemoveHandles = Array<() => void>;
type RootElementEvents = Array<
  [string, Record<string, unknown> | ((event: Event, editor: LexicalEditor) => void)]
>;
const PASS_THROUGH_COMMAND = Object.freeze({});
const ANDROID_COMPOSITION_LATENCY = 30;
const rootElementEvents: RootElementEvents = [
  ['keydown', onKeyDown],
  ['pointerdown', onPointerDown],
  ['compositionstart', onCompositionStart],
  ['compositionend', onCompositionEnd],
  ['input', onInput],
  ['click', onClick],
  ['cut', PASS_THROUGH_COMMAND],
  ['copy', PASS_THROUGH_COMMAND],
  ['dragstart', PASS_THROUGH_COMMAND],
  ['dragover', PASS_THROUGH_COMMAND],
  ['dragend', PASS_THROUGH_COMMAND],
  ['paste', PASS_THROUGH_COMMAND],
  ['focus', PASS_THROUGH_COMMAND],
  ['blur', PASS_THROUGH_COMMAND],
  ['drop', PASS_THROUGH_COMMAND],
];

if (CAN_USE_BEFORE_INPUT) {
  rootElementEvents.push([
    'beforeinput',
    (event, editor) => onBeforeInput(event as InputEvent, editor),
  ]);
}

let lastKeyDownTimeStamp = 0;
let lastKeyCode: null | string = null;
let lastBeforeInputInsertTextTimeStamp = 0;
let unprocessedBeforeInputData: null | string = null;
const rootElementsRegistered = new WeakMap<Document, number>();
let isSelectionChangeFromDOMUpdate = false;
let isSelectionChangeFromMouseDown = false;
let isInsertLineBreak = false;
let isFirefoxEndingComposition = false;
let isSafariEndingComposition = false;
let safariEndCompositionEventData = '';
let postDeleteSelectionToRestore: RangeSelection | null = null;
let collapsedSelectionFormat: [number, string, number, NodeKey, number] = [0, '', 0, 'root', 0];

// This function is used to determine if Lexical should attempt to override
// the default browser behavior for insertion of text and use its own internal
// heuristics. This is an extremely important function, and makes much of Lexical
// work as intended between different browsers and across word, line and character
// boundary/formats. It also is important for text replacement, node schemas and
// composition mechanics.
function $shouldPreventDefaultAndInsertText(
  selection: RangeSelection,
  domTargetRange: null | StaticRange,
  text: string,
  timeStamp: number,
  isBeforeInput: boolean,
): boolean {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = anchor.getNode();
  const editor = getActiveEditor();
  const domSelection = getDOMSelection(getWindow(editor));
  const domAnchorNode = domSelection !== null ? domSelection.anchorNode : null;
  const anchorKey = anchor.key;
  const backingAnchorElement = editor.getElementByKey(anchorKey);
  const textLength = text.length;

  return (
    anchorKey !== focus.key ||
    // If we're working with a non-text node.
    !$isTextNode(anchorNode) ||
    // If we are replacing a range with a single character or grapheme, and not composing.
    (((!isBeforeInput &&
      (!CAN_USE_BEFORE_INPUT ||
        // We check to see if there has been
        // a recent beforeinput event for "textInput". If there has been one in the last
        // 50ms then we proceed as normal. However, if there is not, then this is likely
        // a dangling `input` event caused by execCommand('insertText').
        lastBeforeInputInsertTextTimeStamp < timeStamp + 50)) ||
      (anchorNode.isDirty() && textLength < 2) ||
      // TODO consider if there are other scenarios when multiple code units
      //      should be addressed here
      doesContainSurrogatePair(text)) &&
      anchor.offset !== focus.offset &&
      !anchorNode.isComposing()) ||
    // Any non standard text node.
    $isTokenOrSegmented(anchorNode) ||
    // If the text length is more than a single character and we're either
    // dealing with this in "beforeinput" or where the node has already recently
    // been changed (thus is dirty).
    (anchorNode.isDirty() && textLength > 1) ||
    // If the DOM selection element is not the same as the backing node during beforeinput.
    ((isBeforeInput || !CAN_USE_BEFORE_INPUT) &&
      backingAnchorElement !== null &&
      !anchorNode.isComposing() &&
      domAnchorNode !== getDOMTextNode(backingAnchorElement)) ||
    // If TargetRange is not the same as the DOM selection; browser trying to edit random parts
    // of the editor.
    (domSelection !== null &&
      domTargetRange !== null &&
      (!domTargetRange.collapsed ||
        domTargetRange.startContainer !== domSelection.anchorNode ||
        domTargetRange.startOffset !== domSelection.anchorOffset)) ||
    // Check if we're changing from bold to italics, or some other format.
    anchorNode.getFormat() !== selection.format ||
    anchorNode.getStyle() !== selection.style ||
    // One last set of heuristics to check against.
    $shouldInsertTextAfterOrBeforeTextNode(selection, anchorNode)
  );
}

function shouldSkipSelectionChange(domNode: null | Node, offset: number): boolean {
  return (
    isDOMTextNode(domNode) &&
    domNode.nodeValue !== null &&
    offset !== 0 &&
    offset !== domNode.nodeValue.length
  );
}

function onSelectionChange(
  domSelection: Selection,
  editor: LexicalEditor,
  isActive: boolean,
): void {
  const { anchorNode: anchorDOM, anchorOffset, focusNode: focusDOM, focusOffset } = domSelection;
  if (isSelectionChangeFromDOMUpdate) {
    isSelectionChangeFromDOMUpdate = false;

    // If native DOM selection is on a DOM element, then
    // we should continue as usual, as Lexical's selection
    // may have normalized to a better child. If the DOM
    // element is a text node, we can safely apply this
    // optimization and skip the selection change entirely.
    // We also need to check if the offset is at the boundary,
    // because in this case, we might need to normalize to a
    // sibling instead.
    if (
      shouldSkipSelectionChange(anchorDOM, anchorOffset) &&
      shouldSkipSelectionChange(focusDOM, focusOffset) &&
      !postDeleteSelectionToRestore
    ) {
      return;
    }
  }
  updateEditorSync(editor, () => {
    // Non-active editor don't need any extra logic for selection, it only needs update
    // to reconcile selection (set it to null) to ensure that only one editor has non-null selection.
    if (!isActive) {
      $setSelection(null);
      return;
    }

    if (!isSelectionWithinEditor(editor, anchorDOM, focusDOM)) {
      return;
    }

    let selection = $getSelection();

    // Restore selection in the event of incorrect rightward shift after deletion
    if (postDeleteSelectionToRestore && $isRangeSelection(selection) && selection.isCollapsed()) {
      const curAnchor = selection.anchor;
      const prevAnchor = postDeleteSelectionToRestore.anchor;
      if (
        // Rightward shift in same node
        (curAnchor.key === prevAnchor.key && curAnchor.offset === prevAnchor.offset + 1) ||
        // Or rightward shift into sibling node
        (curAnchor.offset === 1 &&
          prevAnchor.getNode().is(curAnchor.getNode().getPreviousSibling()))
      ) {
        // Restore selection
        selection = postDeleteSelectionToRestore.clone();
        $setSelection(selection);
      }
    }
    postDeleteSelectionToRestore = null;

    // Update the selection format
    if ($isRangeSelection(selection)) {
      const anchor = selection.anchor;
      const anchorNode = anchor.getNode();

      if (selection.isCollapsed()) {
        // Badly interpreted range selection when collapsed - #1482
        if (domSelection.type === 'Range' && domSelection.anchorNode === domSelection.focusNode) {
          selection.dirty = true;
        }

        // If we have marked a collapsed selection format, and we're
        // within the given time range – then attempt to use that format
        // instead of getting the format from the anchor node.
        const windowEvent = getWindow(editor).event;
        const currentTimeStamp = windowEvent ? windowEvent.timeStamp : performance.now();
        const [lastFormat, lastStyle, lastOffset, lastKey, timeStamp] = collapsedSelectionFormat;

        const root = $getRoot();
        const isRootTextContentEmpty =
          editor.isComposing() === false && root.getTextContent() === '';

        if (
          currentTimeStamp < timeStamp + 200 &&
          anchor.offset === lastOffset &&
          anchor.key === lastKey
        ) {
          $updateSelectionFormatStyle(selection, lastFormat, lastStyle);
        } else {
          if (anchor.type === 'text') {
            invariant(
              $isTextNode(anchorNode),
              'Point.getNode() must return TextNode when type is text',
            );
            $updateSelectionFormatStyleFromTextNode(selection, anchorNode);
          } else if (anchor.type === 'element' && !isRootTextContentEmpty) {
            invariant(
              $isElementNode(anchorNode),
              'Point.getNode() must return ElementNode when type is element',
            );
            const lastNode = anchor.getNode();
            if (
              // This previously applied to all ParagraphNode
              lastNode.isEmpty()
            ) {
              $updateSelectionFormatStyleFromElementNode(selection, lastNode);
            } else {
              $updateSelectionFormatStyle(selection, 0, '');
            }
          }
        }
      } else {
        const anchorKey = anchor.key;
        const focus = selection.focus;
        const focusKey = focus.key;
        const nodes = selection.getNodes();
        const nodesLength = nodes.length;
        const isBackward = selection.isBackward();
        const startOffset = isBackward ? focusOffset : anchorOffset;
        const endOffset = isBackward ? anchorOffset : focusOffset;
        const startKey = isBackward ? focusKey : anchorKey;
        const endKey = isBackward ? anchorKey : focusKey;
        let combinedFormat = IS_ALL_FORMATTING;
        let hasTextNodes = false;
        for (let i = 0; i < nodesLength; i++) {
          const node = nodes[i];
          const textContentSize = node.getTextContentSize();
          if (
            $isTextNode(node) &&
            textContentSize !== 0 &&
            // Exclude empty text nodes at boundaries resulting from user's selection
            !(
              (i === 0 && node.__key === startKey && startOffset === textContentSize) ||
              (i === nodesLength - 1 && node.__key === endKey && endOffset === 0)
            )
          ) {
            // TODO: what about style?
            hasTextNodes = true;
            combinedFormat &= node.getFormat();
            if (combinedFormat === 0) {
              break;
            }
          }
        }

        selection.format = hasTextNodes ? combinedFormat : 0;
      }
    }

    dispatchCommand(editor, SELECTION_CHANGE_COMMAND, undefined);
  });
}

function $updateSelectionFormatStyle(selection: RangeSelection, format: number, style: string) {
  if (selection.format !== format || selection.style !== style) {
    selection.format = format;
    selection.style = style;
    selection.dirty = true;
  }
}

function $updateSelectionFormatStyleFromTextNode(selection: RangeSelection, node: TextNode) {
  const format = node.getFormat();
  const style = node.getStyle();
  $updateSelectionFormatStyle(selection, format, style);
}

function $updateSelectionFormatStyleFromElementNode(selection: RangeSelection, node: ElementNode) {
  const format = node.getTextFormat();
  const style = node.getTextStyle();
  $updateSelectionFormatStyle(selection, format, style);
}

// This is a work-around is mainly Chrome specific bug where if you select
// the contents of an empty block, you cannot easily unselect anything.
// This results in a tiny selection box that looks buggy/broken. This can
// also help other browsers when selection might "appear" lost, when it
// really isn't.
function onClick(event: PointerEvent, editor: LexicalEditor): void {
  updateEditorSync(editor, () => {
    const selection = $getSelection();
    const domSelection = getDOMSelection(getWindow(editor));
    const lastSelection = $getPreviousSelection();

    if (domSelection) {
      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();

        if (
          anchor.type === 'element' &&
          anchor.offset === 0 &&
          selection.isCollapsed() &&
          !$isRootNode(anchorNode) &&
          $getRoot().getChildrenSize() === 1 &&
          anchorNode.getTopLevelElementOrThrow().isEmpty() &&
          lastSelection !== null &&
          selection.is(lastSelection)
        ) {
          domSelection.removeAllRanges();
          selection.dirty = true;
        } else if (event.detail === 3 && !selection.isCollapsed()) {
          // Triple click causing selection to overflow into the nearest element. In that
          // case visually it looks like a single element content is selected, focus node
          // is actually at the beginning of the next element (if present) and any manipulations
          // with selection (formatting) are affecting second element as well
          const focus = selection.focus;
          const focusNode = focus.getNode();
          if (anchorNode !== focusNode) {
            const parentNode = $findMatchingParent(
              anchorNode,
              (node) => $isElementNode(node) && !node.isInline(),
            );
            if ($isElementNode(parentNode)) {
              parentNode.select(0);
            }
          }
        }
      } else if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        // This is used to update the selection on touch devices (including Apple Pencil) when the user clicks on text after a
        // node selection. See isSelectionChangeFromMouseDown for the inverse
        const domAnchorNode = domSelection.anchorNode;
        // If the user is attempting to click selection back onto text, then
        // we should attempt create a range selection.
        // When we click on an empty paragraph node or the end of a paragraph that ends
        // with an image/poll, the nodeType will be ELEMENT_NODE
        if (isHTMLElement(domAnchorNode) || isDOMTextNode(domAnchorNode)) {
          const newSelection = $internalCreateRangeSelection(
            lastSelection,
            domSelection,
            editor,
            event,
          );
          $setSelection(newSelection);
        }
      }
    }

    dispatchCommand(editor, CLICK_COMMAND, event);
  });
}

function onPointerDown(event: PointerEvent, editor: LexicalEditor) {
  // TODO implement text drag & drop
  const target = event.target;
  const pointerType = event.pointerType;
  if (isDOMNode(target) && pointerType !== 'touch' && pointerType !== 'pen' && event.button === 0) {
    updateEditorSync(editor, () => {
      // Drag & drop should not recompute selection until mouse up; otherwise the initially
      // selected content is lost.
      if (!$isSelectionCapturedInDecorator(target)) {
        isSelectionChangeFromMouseDown = true;
      }
    });
  }
}

function getTargetRange(event: InputEvent): null | StaticRange {
  if (!event.getTargetRanges) {
    return null;
  }
  const targetRanges = event.getTargetRanges();
  if (targetRanges.length === 0) {
    return null;
  }
  return targetRanges[0];
}

function $canRemoveText(
  anchorNode: TextNode | ElementNode,
  focusNode: TextNode | ElementNode,
): boolean {
  return (
    anchorNode !== focusNode ||
    $isElementNode(anchorNode) ||
    $isElementNode(focusNode) ||
    !$isTokenOrTab(anchorNode) ||
    !$isTokenOrTab(focusNode)
  );
}

function isPossiblyAndroidKeyPress(timeStamp: number): boolean {
  return (
    lastKeyCode === 'MediaLast' && timeStamp < lastKeyDownTimeStamp + ANDROID_COMPOSITION_LATENCY
  );
}

function onBeforeInput(event: InputEvent, editor: LexicalEditor): void {
  const inputType = event.inputType;
  const targetRange = getTargetRange(event);

  // We let the browser do its own thing for composition.
  if (
    inputType === 'deleteCompositionText' ||
    // If we're pasting in FF, we shouldn't get this event
    // as the `paste` event should have triggered, unless the
    // user has dom.event.clipboardevents.enabled disabled in
    // about:config. In that case, we need to process the
    // pasted content in the DOM mutation phase.
    (IS_FIREFOX && isFirefoxClipboardEvents(editor))
  ) {
    return;
  } else if (inputType === 'insertCompositionText') {
    return;
  }

  updateEditorSync(editor, () => {
    const selection = $getSelection();

    if (inputType === 'deleteContentBackward') {
      if (selection === null) {
        // Use previous selection
        const prevSelection = $getPreviousSelection();

        if (!$isRangeSelection(prevSelection)) {
          return;
        }

        $setSelection(prevSelection.clone());
      }

      if ($isRangeSelection(selection)) {
        const isSelectionAnchorSameAsFocus = selection.anchor.key === selection.focus.key;

        if (
          isPossiblyAndroidKeyPress(event.timeStamp) &&
          editor.isComposing() &&
          isSelectionAnchorSameAsFocus
        ) {
          $setCompositionKey(null);
          lastKeyDownTimeStamp = 0;
          // Fixes an Android bug where selection flickers when backspacing
          setTimeout(() => {
            updateEditorSync(editor, () => {
              $setCompositionKey(null);
            });
          }, ANDROID_COMPOSITION_LATENCY);
          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            anchorNode.markDirty();
            invariant($isTextNode(anchorNode), 'Anchor node must be a TextNode');
            $updateSelectionFormatStyleFromTextNode(selection, anchorNode);
          }
        } else {
          $setCompositionKey(null);
          event.preventDefault();
          // Chromium Android at the moment seems to ignore the preventDefault
          // on 'deleteContentBackward' and still deletes the content. Which leads
          // to multiple deletions. So we let the browser handle the deletion in this case.
          const selectedNode = selection.anchor.getNode();
          const selectedNodeText = selectedNode.getTextContent();
          // When the target node has `canInsertTextAfter` set to false, the first deletion
          // doesn't have an effect, so we need to handle it with Lexical.
          const selectedNodeCanInsertTextAfter = selectedNode.canInsertTextAfter();
          const hasSelectedAllTextInNode =
            selection.anchor.offset === 0 && selection.focus.offset === selectedNodeText.length;
          let shouldLetBrowserHandleDelete =
            IS_ANDROID_CHROME &&
            isSelectionAnchorSameAsFocus &&
            !hasSelectedAllTextInNode &&
            selectedNodeCanInsertTextAfter;
          // Check if selection is collapsed and if the previous node is a decorator node
          // If so, the browser will not be able to handle the deletion
          if (shouldLetBrowserHandleDelete && selection.isCollapsed()) {
            shouldLetBrowserHandleDelete = !$isDecoratorNode(
              $getAdjacentNode(selection.anchor, true),
            );
          }
          if (!shouldLetBrowserHandleDelete) {
            dispatchCommand(editor, DELETE_CHARACTER_COMMAND, true);
            // When deleting across paragraphs, Chrome on Android incorrectly shifts the selection rightwards
            // We save the correct selection to restore later during handling of selectionchange event
            const selectionAfterDelete = $getSelection();
            if (
              IS_ANDROID_CHROME &&
              $isRangeSelection(selectionAfterDelete) &&
              selectionAfterDelete.isCollapsed()
            ) {
              postDeleteSelectionToRestore = selectionAfterDelete;
              // Cleanup in case selectionchange does not fire
              setTimeout(() => (postDeleteSelectionToRestore = null));
            }
          }
        }
        return;
      }
    }

    if (!$isRangeSelection(selection)) {
      return;
    }

    const data = event.data;

    // This represents the case when two beforeinput events are triggered at the same time (without a
    // full event loop ending at input). This happens with MacOS with the default keyboard settings,
    // a combination of autocorrection + autocapitalization.
    // Having Lexical run everything in controlled mode would fix the issue without additional code
    // but this would kill the massive performance win from the most common typing event.
    // Alternatively, when this happens we can prematurely update our EditorState based on the DOM
    // content, a job that would usually be the input event's responsibility.
    if (unprocessedBeforeInputData !== null) {
      $updateSelectedTextFromDOM(false, editor, unprocessedBeforeInputData);
    }

    if (
      (!selection.dirty || unprocessedBeforeInputData !== null) &&
      selection.isCollapsed() &&
      !$isRootNode(selection.anchor.getNode()) &&
      targetRange !== null
    ) {
      selection.applyDOMRange(targetRange);
    }

    unprocessedBeforeInputData = null;

    const anchor = selection.anchor;
    const focus = selection.focus;
    const anchorNode = anchor.getNode();
    const focusNode = focus.getNode();

    if (inputType === 'insertText' || inputType === 'insertTranspose') {
      if (data === '\n') {
        event.preventDefault();
        dispatchCommand(editor, INSERT_LINE_BREAK_COMMAND, false);
      } else if (data === DOUBLE_LINE_BREAK) {
        event.preventDefault();
        dispatchCommand(editor, INSERT_PARAGRAPH_COMMAND, undefined);
      } else if (data == null && event.dataTransfer) {
        // Gets around a Safari text replacement bug.
        const text = event.dataTransfer.getData('text/plain');
        event.preventDefault();
        selection.insertRawText(text);
      } else if (
        data != null &&
        $shouldPreventDefaultAndInsertText(selection, targetRange, data, event.timeStamp, true)
      ) {
        event.preventDefault();
        dispatchCommand(editor, CONTROLLED_TEXT_INSERTION_COMMAND, data);
      } else {
        unprocessedBeforeInputData = data;
      }
      lastBeforeInputInsertTextTimeStamp = event.timeStamp;
      return;
    }

    // Prevent the browser from carrying out
    // the input event, so we can control the
    // output.
    event.preventDefault();

    switch (inputType) {
      case 'insertFromYank':
      case 'insertFromDrop':
      case 'insertReplacementText': {
        dispatchCommand(editor, CONTROLLED_TEXT_INSERTION_COMMAND, event);
        break;
      }

      case 'insertFromComposition': {
        // This is the end of composition
        $setCompositionKey(null);
        dispatchCommand(editor, CONTROLLED_TEXT_INSERTION_COMMAND, event);
        break;
      }

      case 'insertLineBreak': {
        // Used for Android
        $setCompositionKey(null);
        dispatchCommand(editor, INSERT_LINE_BREAK_COMMAND, false);
        break;
      }

      case 'insertParagraph': {
        // Used for Android
        $setCompositionKey(null);

        // Safari does not provide the type "insertLineBreak".
        // So instead, we need to infer it from the keyboard event.
        // We do not apply this logic to iOS to allow newline auto-capitalization
        // work without creating linebreaks when pressing Enter
        if (isInsertLineBreak && !IS_IOS) {
          isInsertLineBreak = false;
          dispatchCommand(editor, INSERT_LINE_BREAK_COMMAND, false);
        } else {
          dispatchCommand(editor, INSERT_PARAGRAPH_COMMAND, undefined);
        }

        break;
      }

      case 'insertFromPaste':
      case 'insertFromPasteAsQuotation': {
        dispatchCommand(editor, PASTE_COMMAND, event);
        break;
      }

      case 'deleteByComposition': {
        if ($canRemoveText(anchorNode, focusNode)) {
          dispatchCommand(editor, REMOVE_TEXT_COMMAND, event);
        }

        break;
      }

      case 'deleteByDrag':
      case 'deleteByCut': {
        dispatchCommand(editor, REMOVE_TEXT_COMMAND, event);
        break;
      }

      case 'deleteContent': {
        dispatchCommand(editor, DELETE_CHARACTER_COMMAND, false);
        break;
      }

      case 'deleteWordBackward': {
        dispatchCommand(editor, DELETE_WORD_COMMAND, true);
        break;
      }

      case 'deleteWordForward': {
        dispatchCommand(editor, DELETE_WORD_COMMAND, false);
        break;
      }

      case 'deleteHardLineBackward':
      case 'deleteSoftLineBackward': {
        dispatchCommand(editor, DELETE_LINE_COMMAND, true);
        break;
      }

      case 'deleteContentForward':
      case 'deleteHardLineForward':
      case 'deleteSoftLineForward': {
        dispatchCommand(editor, DELETE_LINE_COMMAND, false);
        break;
      }

      case 'formatStrikeThrough': {
        dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'strikethrough');
        break;
      }

      case 'formatBold': {
        dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'bold');
        break;
      }

      case 'formatItalic': {
        dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'italic');
        break;
      }

      case 'formatUnderline': {
        dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'underline');
        break;
      }

      case 'historyUndo': {
        dispatchCommand(editor, UNDO_COMMAND, undefined);
        break;
      }

      case 'historyRedo': {
        dispatchCommand(editor, REDO_COMMAND, undefined);
        break;
      }

      default:
      // NO-OP
    }
  });
}

function onInput(event: InputEvent, editor: LexicalEditor): void {
  // Note that the MutationObserver may or may not have already fired,
  // but the the DOM and selection may have already changed.
  // See also:
  // - https://github.com/facebook/lexical/issues/7028
  // - https://github.com/facebook/lexical/pull/794

  // We don't want the onInput to bubble, in the case of nested editors.
  event.stopPropagation();
  updateEditorSync(
    editor,
    () => {
      if (isHTMLElement(event.target) && $isSelectionCapturedInDecorator(event.target)) {
        return;
      }

      const selection = $getSelection();
      const data = event.data;
      const targetRange = getTargetRange(event);

      if (
        data != null &&
        $isRangeSelection(selection) &&
        $shouldPreventDefaultAndInsertText(selection, targetRange, data, event.timeStamp, false)
      ) {
        // Given we're over-riding the default behavior, we will need
        // to ensure to disable composition before dispatching the
        // insertText command for when changing the sequence for FF.
        if (isFirefoxEndingComposition) {
          $onCompositionEndImpl(editor, data);
          isFirefoxEndingComposition = false;
        }
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        const domSelection = getDOMSelection(getWindow(editor));
        if (domSelection === null) {
          return;
        }
        const isBackward = selection.isBackward();
        const startOffset = isBackward ? selection.anchor.offset : selection.focus.offset;
        const endOffset = isBackward ? selection.focus.offset : selection.anchor.offset;
        // If the content is the same as inserted, then don't dispatch an insertion.
        // Given onInput doesn't take the current selection (it uses the previous)
        // we can compare that against what the DOM currently says.
        if (
          !CAN_USE_BEFORE_INPUT ||
          selection.isCollapsed() ||
          !$isTextNode(anchorNode) ||
          domSelection.anchorNode === null ||
          anchorNode.getTextContent().slice(0, startOffset) +
            data +
            anchorNode.getTextContent().slice(startOffset + endOffset) !==
            getAnchorTextFromDOM(domSelection.anchorNode)
        ) {
          dispatchCommand(editor, CONTROLLED_TEXT_INSERTION_COMMAND, data);
        }

        const textLength = data.length;

        // Another hack for FF, as it's possible that the IME is still
        // open, even though compositionend has already fired (sigh).
        if (
          IS_FIREFOX &&
          textLength > 1 &&
          event.inputType === 'insertCompositionText' &&
          !editor.isComposing()
        ) {
          selection.anchor.offset -= textLength;
        }

        // This ensures consistency on Android.
        if (!IS_SAFARI && !IS_IOS && !IS_APPLE_WEBKIT && editor.isComposing()) {
          lastKeyDownTimeStamp = 0;
          $setCompositionKey(null);
        }
      } else {
        const characterData = data !== null ? data : undefined;
        $updateSelectedTextFromDOM(false, editor, characterData);

        // onInput always fires after onCompositionEnd for FF.
        if (isFirefoxEndingComposition) {
          $onCompositionEndImpl(editor, data || undefined);
          isFirefoxEndingComposition = false;
        }
      }

      // Also flush any other mutations that might have occurred
      // since the change.
      $flushMutations();
    },
    { event },
  );
  unprocessedBeforeInputData = null;
}

function onCompositionStart(event: CompositionEvent, editor: LexicalEditor): void {
  updateEditorSync(editor, () => {
    const selection = $getSelection();

    if ($isRangeSelection(selection) && !editor.isComposing()) {
      const anchor = selection.anchor;
      const node = selection.anchor.getNode();
      $setCompositionKey(anchor.key);

      if (
        // If it has been 30ms since the last keydown, then we should
        // apply the empty space heuristic. We can't do this for Safari,
        // as the keydown fires after composition start.
        event.timeStamp < lastKeyDownTimeStamp + ANDROID_COMPOSITION_LATENCY ||
        // FF has issues around composing multibyte characters, so we also
        // need to invoke the empty space heuristic below.
        anchor.type === 'element' ||
        !selection.isCollapsed() ||
        node.getFormat() !== selection.format ||
        ($isTextNode(node) && node.getStyle() !== selection.style)
      ) {
        // We insert a zero width character, ready for the composition
        // to get inserted into the new node we create. If
        // we don't do this, Safari will fail on us because
        // there is no text node matching the selection.
        dispatchCommand(editor, CONTROLLED_TEXT_INSERTION_COMMAND, COMPOSITION_START_CHAR);
      }
    }
  });
}

function $onCompositionEndImpl(editor: LexicalEditor, data?: string): void {
  const compositionKey = editor._compositionKey;
  $setCompositionKey(null);

  // Handle termination of composition.
  if (compositionKey !== null && data != null) {
    // Composition can sometimes move to an adjacent DOM node when backspacing.
    // So check for the empty case.
    if (data === '') {
      const node = $getNodeByKey(compositionKey);
      const textNode = getDOMTextNode(editor.getElementByKey(compositionKey));

      if (textNode !== null && textNode.nodeValue !== null && $isTextNode(node)) {
        $updateTextNodeFromDOMContent(node, textNode.nodeValue, null, null, true);
      }

      return;
    }

    // Composition can sometimes be that of a new line. In which case, we need to
    // handle that accordingly.
    // eslint-disable-next-line unicorn/prefer-at
    if (data[data.length - 1] === '\n') {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        // If the last character is a line break, we also need to insert
        // a line break.
        const focus = selection.focus;
        selection.anchor.set(focus.key, focus.offset, focus.type);
        dispatchCommand(editor, KEY_ENTER_COMMAND, null);
        return;
      }
    }
  }

  $updateSelectedTextFromDOM(true, editor, data);
}

function onCompositionEnd(event: CompositionEvent, editor: LexicalEditor): void {
  // Firefox fires onCompositionEnd before onInput, but Chrome/Webkit,
  // fire onInput before onCompositionEnd. To ensure the sequence works
  // like Chrome/Webkit we use the isFirefoxEndingComposition flag to
  // defer handling of onCompositionEnd in Firefox till we have processed
  // the logic in onInput.
  if (IS_FIREFOX) {
    isFirefoxEndingComposition = true;
  } else if (!IS_IOS && (IS_SAFARI || IS_APPLE_WEBKIT)) {
    // Fix：https://github.com/facebook/lexical/pull/7061
    // In safari, onCompositionEnd triggers before keydown
    // This will cause an extra character to be deleted when exiting the IME
    // Therefore, a flag is used to mark that the keydown event is triggered after onCompositionEnd
    // Ensure that an extra character is not deleted due to the backspace event being triggered in the keydown event.
    isSafariEndingComposition = true;
    safariEndCompositionEventData = event.data;
  } else {
    updateEditorSync(editor, () => {
      $onCompositionEndImpl(editor, event.data);
    });
  }
}

function onKeyDown(event: KeyboardEvent, editor: LexicalEditor): void {
  lastKeyDownTimeStamp = event.timeStamp;
  lastKeyCode = event.key;
  if (editor.isComposing()) {
    return;
  }

  if (dispatchCommand(editor, KEY_DOWN_COMMAND, event)) {
    return;
  }

  if (event.key == null) {
    return;
  }
  if (isSafariEndingComposition && isBackspace(event)) {
    updateEditorSync(editor, () => {
      $onCompositionEndImpl(editor, safariEndCompositionEventData);
    });
    isSafariEndingComposition = false;
    safariEndCompositionEventData = '';
    return;
  }

  if (isMoveForward(event)) {
    dispatchCommand(editor, KEY_ARROW_RIGHT_COMMAND, event);
  } else if (isMoveToEnd(event)) {
    dispatchCommand(editor, MOVE_TO_END, event);
  } else if (isMoveBackward(event)) {
    dispatchCommand(editor, KEY_ARROW_LEFT_COMMAND, event);
  } else if (isMoveToStart(event)) {
    dispatchCommand(editor, MOVE_TO_START, event);
  } else if (isMoveUp(event)) {
    dispatchCommand(editor, KEY_ARROW_UP_COMMAND, event);
  } else if (isMoveDown(event)) {
    dispatchCommand(editor, KEY_ARROW_DOWN_COMMAND, event);
  } else if (isLineBreak(event)) {
    isInsertLineBreak = true;
    dispatchCommand(editor, KEY_ENTER_COMMAND, event);
  } else if (isSpace(event)) {
    dispatchCommand(editor, KEY_SPACE_COMMAND, event);
  } else if (isOpenLineBreak(event)) {
    event.preventDefault();
    isInsertLineBreak = true;
    dispatchCommand(editor, INSERT_LINE_BREAK_COMMAND, true);
  } else if (isParagraph(event)) {
    isInsertLineBreak = false;
    dispatchCommand(editor, KEY_ENTER_COMMAND, event);
  } else if (isDeleteBackward(event)) {
    if (isBackspace(event)) {
      dispatchCommand(editor, KEY_BACKSPACE_COMMAND, event);
    } else {
      event.preventDefault();
      dispatchCommand(editor, DELETE_CHARACTER_COMMAND, true);
    }
  } else if (isEscape(event)) {
    dispatchCommand(editor, KEY_ESCAPE_COMMAND, event);
  } else if (isDeleteForward(event)) {
    if (isDelete(event)) {
      dispatchCommand(editor, KEY_DELETE_COMMAND, event);
    } else {
      event.preventDefault();
      dispatchCommand(editor, DELETE_CHARACTER_COMMAND, false);
    }
  } else if (isDeleteWordBackward(event)) {
    event.preventDefault();
    dispatchCommand(editor, DELETE_WORD_COMMAND, true);
  } else if (isDeleteWordForward(event)) {
    event.preventDefault();
    dispatchCommand(editor, DELETE_WORD_COMMAND, false);
  } else if (isDeleteLineBackward(event)) {
    event.preventDefault();
    dispatchCommand(editor, DELETE_LINE_COMMAND, true);
  } else if (isDeleteLineForward(event)) {
    event.preventDefault();
    dispatchCommand(editor, DELETE_LINE_COMMAND, false);
  } else if (isBold(event)) {
    event.preventDefault();
    dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'bold');
  } else if (isUnderline(event)) {
    event.preventDefault();
    dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'underline');
  } else if (isItalic(event)) {
    event.preventDefault();
    dispatchCommand(editor, FORMAT_TEXT_COMMAND, 'italic');
  } else if (isTab(event)) {
    dispatchCommand(editor, KEY_TAB_COMMAND, event);
  } else if (isUndo(event)) {
    event.preventDefault();
    dispatchCommand(editor, UNDO_COMMAND, undefined);
  } else if (isRedo(event)) {
    event.preventDefault();
    dispatchCommand(editor, REDO_COMMAND, undefined);
  } else {
    const prevSelection = editor._editorState._selection;
    if (prevSelection !== null && !$isRangeSelection(prevSelection)) {
      // Only RangeSelection can use the native cut/copy/select all
      if (isCopy(event)) {
        event.preventDefault();
        dispatchCommand(editor, COPY_COMMAND, event);
      } else if (isCut(event)) {
        event.preventDefault();
        dispatchCommand(editor, CUT_COMMAND, event);
      } else if (isSelectAll(event)) {
        event.preventDefault();
        dispatchCommand(editor, SELECT_ALL_COMMAND, event);
      }
    } else if (isSelectAll(event)) {
      event.preventDefault();
      dispatchCommand(editor, SELECT_ALL_COMMAND, event);
    }
  }

  if (isModifier(event)) {
    dispatchCommand(editor, KEY_MODIFIER_COMMAND, event);
  }
}

function getRootElementRemoveHandles(rootElement: HTMLElement): RootElementRemoveHandles {
  // @ts-expect-error: internal field
  let eventHandles = rootElement.__lexicalEventHandles;

  if (eventHandles === undefined) {
    eventHandles = [];
    // @ts-expect-error: internal field
    rootElement.__lexicalEventHandles = eventHandles;
  }

  return eventHandles;
}

// Mapping root editors to their active nested editors, contains nested editors
// mapping only, so if root editor is selected map will have no reference to free up memory
const activeNestedEditorsMap: Map<string, LexicalEditor> = new Map();

function onDocumentSelectionChange(event: Event): void {
  const domSelection = getDOMSelectionFromTarget(event.target);
  if (domSelection === null) {
    return;
  }
  const nextActiveEditor = getNearestEditorFromDOMNode(domSelection.anchorNode);
  if (nextActiveEditor === null) {
    return;
  }

  if (isSelectionChangeFromMouseDown) {
    isSelectionChangeFromMouseDown = false;
    updateEditorSync(nextActiveEditor, () => {
      const lastSelection = $getPreviousSelection();
      const domAnchorNode = domSelection.anchorNode;
      if (isHTMLElement(domAnchorNode) || isDOMTextNode(domAnchorNode)) {
        // If the user is attempting to click selection back onto text, then
        // we should attempt create a range selection.
        // When we click on an empty paragraph node or the end of a paragraph that ends
        // with an image/poll, the nodeType will be ELEMENT_NODE
        const newSelection = $internalCreateRangeSelection(
          lastSelection,
          domSelection,
          nextActiveEditor,
          event,
        );
        $setSelection(newSelection);
      }
    });
  }

  // When editor receives selection change event, we're checking if
  // it has any sibling editors (within same parent editor) that were active
  // before, and trigger selection change on it to nullify selection.
  const editors = getEditorsToPropagate(nextActiveEditor);
  const rootEditor = editors[editors.length - 1];
  const rootEditorKey = rootEditor._key;
  const activeNestedEditor = activeNestedEditorsMap.get(rootEditorKey);
  const prevActiveEditor = activeNestedEditor || rootEditor;

  if (prevActiveEditor !== nextActiveEditor) {
    onSelectionChange(domSelection, prevActiveEditor, false);
  }

  onSelectionChange(domSelection, nextActiveEditor, true);

  // If newly selected editor is nested, then add it to the map, clean map otherwise
  if (nextActiveEditor !== rootEditor) {
    activeNestedEditorsMap.set(rootEditorKey, nextActiveEditor);
  } else if (activeNestedEditor) {
    activeNestedEditorsMap.delete(rootEditorKey);
  }
}

function stopLexicalPropagation(event: Event): void {
  // We attach a special property to ensure the same event doesn't re-fire
  // for parent editors.
  // @ts-ignore
  event._lexicalHandled = true;
}

function hasStoppedLexicalPropagation(event: Event): boolean {
  // @ts-ignore
  const stopped = event._lexicalHandled === true;
  return stopped;
}

export type EventHandler = (event: Event, editor: LexicalEditor) => void;

export function addRootElementEvents(rootElement: HTMLElement, editor: LexicalEditor): void {
  // We only want to have a single global selectionchange event handler, shared
  // between all editor instances.
  const doc = rootElement.ownerDocument;
  const documentRootElementsCount = rootElementsRegistered.get(doc);
  if (documentRootElementsCount === undefined || documentRootElementsCount < 1) {
    doc.addEventListener('selectionchange', onDocumentSelectionChange);
  }
  rootElementsRegistered.set(doc, (documentRootElementsCount || 0) + 1);

  // @ts-expect-error: internal field
  rootElement.__lexicalEditor = editor;
  const removeHandles = getRootElementRemoveHandles(rootElement);

  for (let i = 0; i < rootElementEvents.length; i++) {
    const [eventName, onEvent] = rootElementEvents[i];
    const eventHandler =
      typeof onEvent === 'function'
        ? (event: Event) => {
            if (hasStoppedLexicalPropagation(event)) {
              return;
            }
            stopLexicalPropagation(event);
            if (editor.isEditable() || eventName === 'click') {
              onEvent(event, editor);
            }
          }
        : (event: Event) => {
            if (hasStoppedLexicalPropagation(event)) {
              return;
            }
            stopLexicalPropagation(event);
            const isEditable = editor.isEditable();
            switch (eventName) {
              case 'cut': {
                return isEditable && dispatchCommand(editor, CUT_COMMAND, event as ClipboardEvent);
              }

              case 'copy': {
                return dispatchCommand(editor, COPY_COMMAND, event as ClipboardEvent);
              }

              case 'paste': {
                return (
                  isEditable && dispatchCommand(editor, PASTE_COMMAND, event as ClipboardEvent)
                );
              }

              case 'dragstart': {
                return isEditable && dispatchCommand(editor, DRAGSTART_COMMAND, event as DragEvent);
              }

              case 'dragover': {
                return isEditable && dispatchCommand(editor, DRAGOVER_COMMAND, event as DragEvent);
              }

              case 'dragend': {
                return isEditable && dispatchCommand(editor, DRAGEND_COMMAND, event as DragEvent);
              }

              case 'focus': {
                return isEditable && dispatchCommand(editor, FOCUS_COMMAND, event as FocusEvent);
              }

              case 'blur': {
                return isEditable && dispatchCommand(editor, BLUR_COMMAND, event as FocusEvent);
              }

              case 'drop': {
                return isEditable && dispatchCommand(editor, DROP_COMMAND, event as DragEvent);
              }
            }
          };
    rootElement.addEventListener(eventName, eventHandler);
    removeHandles.push(() => {
      rootElement.removeEventListener(eventName, eventHandler);
    });
  }
}

const rootElementNotRegisteredWarning = warnOnlyOnce('Root element not registered');

export function removeRootElementEvents(rootElement: HTMLElement): void {
  const doc = rootElement.ownerDocument;
  const documentRootElementsCount = rootElementsRegistered.get(doc);
  if (documentRootElementsCount === undefined) {
    // This can happen if setRootElement() failed
    rootElementNotRegisteredWarning();
    return;
  }

  // We only want to have a single global selectionchange event handler, shared
  // between all editor instances.
  const newCount = documentRootElementsCount - 1;
  invariant(newCount >= 0, 'Root element count less than 0');
  rootElementsRegistered.set(doc, newCount);
  if (newCount === 0) {
    doc.removeEventListener('selectionchange', onDocumentSelectionChange);
  }

  const editor = getEditorPropertyFromDOMNode(rootElement);

  if (isLexicalEditor(editor)) {
    cleanActiveNestedEditorsMap(editor);
    // @ts-expect-error: internal field
    rootElement.__lexicalEditor = null;
  } else if (editor) {
    invariant(
      false,
      'Attempted to remove event handlers from a node that does not belong to this build of Lexical',
    );
  }

  const removeHandles = getRootElementRemoveHandles(rootElement);

  for (let i = 0; i < removeHandles.length; i++) {
    removeHandles[i]();
  }

  // @ts-expect-error: internal field
  rootElement.__lexicalEventHandles = [];
}

function cleanActiveNestedEditorsMap(editor: LexicalEditor) {
  if (editor._parentEditor !== null) {
    // For nested editor cleanup map if this editor was marked as active
    const editors = getEditorsToPropagate(editor);
    const rootEditor = editors[editors.length - 1];
    const rootEditorKey = rootEditor._key;

    if (activeNestedEditorsMap.get(rootEditorKey) === editor) {
      activeNestedEditorsMap.delete(rootEditorKey);
    }
  } else {
    // For top-level editors cleanup map
    activeNestedEditorsMap.delete(editor._key);
  }
}

export function markSelectionChangeFromDOMUpdate(): void {
  isSelectionChangeFromDOMUpdate = true;
}

export function markCollapsedSelectionFormat(
  format: number,
  style: string,
  offset: number,
  key: NodeKey,
  timeStamp: number,
): void {
  collapsedSelectionFormat = [format, style, offset, key, timeStamp];
}

export function $garbageCollectDetachedDecorators(
  editor: LexicalEditor,
  pendingEditorState: EditorState,
): void {
  const currentDecorators = editor._decorators;
  const pendingDecorators = editor._pendingDecorators;
  let decorators = pendingDecorators || currentDecorators;
  const nodeMap = pendingEditorState._nodeMap;
  let key;

  for (key in decorators) {
    if (!nodeMap.has(key)) {
      if (decorators === currentDecorators) {
        decorators = cloneDecorators(editor);
      }

      delete decorators[key];
    }
  }
}

function $garbageCollectDetachedDeepChildNodes(
  node: ElementNode,
  parentKey: NodeKey,
  prevNodeMap: NodeMap,
  nodeMap: NodeMap,
  nodeMapDelete: Array<NodeKey>,
  dirtyNodes: Map<NodeKey, IntentionallyMarkedAsDirtyElement>,
): void {
  let child = node.getFirstChild();

  while (child !== null) {
    const childKey = child.__key;
    // TODO Revise condition below, redundant? LexicalNode already cleans up children when moving Nodes
    if (child.__parent === parentKey) {
      if ($isElementNode(child)) {
        $garbageCollectDetachedDeepChildNodes(
          child,
          childKey,
          prevNodeMap,
          nodeMap,
          nodeMapDelete,
          dirtyNodes,
        );
      }

      // If we have created a node and it was dereferenced, then also
      // remove it from out dirty nodes Set.
      if (!prevNodeMap.has(childKey)) {
        dirtyNodes.delete(childKey);
      }
      nodeMapDelete.push(childKey);
    }
    child = child.getNextSibling();
  }
}

export function $garbageCollectDetachedNodes(
  prevEditorState: EditorState,
  editorState: EditorState,
  dirtyLeaves: Set<NodeKey>,
  dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>,
): void {
  const prevNodeMap = prevEditorState._nodeMap;
  const nodeMap = editorState._nodeMap;
  // Store dirtyElements in a queue for later deletion; deleting dirty subtrees too early will
  // hinder accessing .__next on child nodes
  const nodeMapDelete: Array<NodeKey> = [];

  for (const [nodeKey] of dirtyElements) {
    const node = nodeMap.get(nodeKey);
    if (node !== undefined) {
      // Garbage collect node and its children if they exist
      if (!node.isAttached()) {
        if ($isElementNode(node)) {
          $garbageCollectDetachedDeepChildNodes(
            node,
            nodeKey,
            prevNodeMap,
            nodeMap,
            nodeMapDelete,
            dirtyElements,
          );
        }
        // If we have created a node and it was dereferenced, then also
        // remove it from out dirty nodes Set.
        if (!prevNodeMap.has(nodeKey)) {
          dirtyElements.delete(nodeKey);
        }
        nodeMapDelete.push(nodeKey);
      }
    }
  }
  for (const nodeKey of nodeMapDelete) {
    nodeMap.delete(nodeKey);
  }

  for (const nodeKey of dirtyLeaves) {
    const node = nodeMap.get(nodeKey);
    if (node !== undefined && !node.isAttached()) {
      if (!prevNodeMap.has(nodeKey)) {
        dirtyLeaves.delete(nodeKey);
      }
      nodeMap.delete(nodeKey);
    }
  }
}

// The time between a text entry event and the mutation observer firing.
const TEXT_MUTATION_VARIANCE = 100;

let isProcessingMutations = false;
let lastTextEntryTimeStamp = 0;

export function getIsProcessingMutations(): boolean {
  return isProcessingMutations;
}

function updateTimeStamp(event: Event) {
  lastTextEntryTimeStamp = event.timeStamp;
}

function initTextEntryListener(editor: LexicalEditor): void {
  if (lastTextEntryTimeStamp === 0) {
    getWindow(editor).addEventListener('textInput', updateTimeStamp, true);
  }
}

function isManagedLineBreak(
  dom: Node,
  target: Node & LexicalPrivateDOM,
  editor: LexicalEditor,
): boolean {
  const isBR = dom.nodeName === 'BR';
  const lexicalLineBreak = target.__lexicalLineBreak;
  return (
    (lexicalLineBreak &&
      (dom === lexicalLineBreak || (isBR && dom.previousSibling === lexicalLineBreak))) ||
    (isBR && getNodeKeyFromDOMNode(dom, editor) !== undefined)
  );
}

function getLastSelection(editor: LexicalEditor): null | BaseSelection {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    return selection !== null ? selection.clone() : null;
  });
}

function $handleTextMutation(target: Text, node: TextNode, editor: LexicalEditor): void {
  const domSelection = getDOMSelection(getWindow(editor));
  let anchorOffset = null;
  let focusOffset = null;

  if (domSelection !== null && domSelection.anchorNode === target) {
    anchorOffset = domSelection.anchorOffset;
    focusOffset = domSelection.focusOffset;
  }

  const text = target.nodeValue;
  if (text !== null) {
    $updateTextNodeFromDOMContent(node, text, anchorOffset, focusOffset, false);
  }
}

function shouldUpdateTextNodeFromMutation(
  selection: null | BaseSelection,
  targetDOM: Node,
  targetNode: TextNode,
): boolean {
  if ($isRangeSelection(selection)) {
    const anchorNode = selection.anchor.getNode();
    if (anchorNode.is(targetNode) && selection.format !== anchorNode.getFormat()) {
      return false;
    }
  }
  return isDOMTextNode(targetDOM) && targetNode.isAttached();
}

function $getNearestManagedNodePairFromDOMNode(
  startingDOM: Node,
  editor: LexicalEditor,
  editorState: EditorState,
  rootElement: HTMLElement | null,
): [HTMLElement, LexicalNode] | undefined {
  for (
    let dom: Node | null = startingDOM;
    dom && !isDOMUnmanaged(dom);
    dom = getParentElement(dom)
  ) {
    const key = getNodeKeyFromDOMNode(dom, editor);
    if (key !== undefined) {
      const node = $getNodeByKey(key, editorState);
      if (node) {
        // All decorator nodes are unmanaged
        return $isDecoratorNode(node) || !isHTMLElement(dom) ? undefined : [dom, node];
      }
    } else if (dom === rootElement) {
      return [rootElement, internalGetRoot(editorState)];
    }
  }
}

function flushMutations(
  editor: LexicalEditor,
  mutations: Array<MutationRecord>,
  observer: MutationObserver,
): void {
  isProcessingMutations = true;
  const shouldFlushTextMutations =
    performance.now() - lastTextEntryTimeStamp > TEXT_MUTATION_VARIANCE;
  try {
    updateEditorSync(editor, () => {
      const selection = $getSelection() || getLastSelection(editor);
      const badDOMTargets = new Map<HTMLElement, LexicalNode>();
      const rootElement = editor.getRootElement();
      // We use the current editor state, as that reflects what is
      // actually "on screen".
      const currentEditorState = editor._editorState;
      const blockCursorElement = editor._blockCursorElement;
      let shouldRevertSelection = false;
      let possibleTextForFirefoxPaste = '';

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        const type = mutation.type;
        const targetDOM = mutation.target;
        const pair = $getNearestManagedNodePairFromDOMNode(
          targetDOM,
          editor,
          currentEditorState,
          rootElement,
        );
        if (!pair) {
          continue;
        }
        const [nodeDOM, targetNode] = pair;

        if (type === 'characterData') {
          // Text mutations are deferred and passed to mutation listeners to be
          // processed outside of the Lexical engine.
          if (
            // TODO there is an edge case here if a mutation happens too quickly
            //      after text input, it may never be handled since we do not
            //      track the ignored mutations in any way
            shouldFlushTextMutations &&
            $isTextNode(targetNode) &&
            isDOMTextNode(targetDOM) &&
            shouldUpdateTextNodeFromMutation(selection, targetDOM, targetNode)
          ) {
            $handleTextMutation(targetDOM, targetNode, editor);
          }
        } else if (type === 'childList') {
          shouldRevertSelection = true;
          // We attempt to "undo" any changes that have occurred outside
          // of Lexical. We want Lexical's editor state to be source of truth.
          // To the user, these will look like no-ops.
          const addedDOMs = mutation.addedNodes;

          for (let s = 0; s < addedDOMs.length; s++) {
            const addedDOM = addedDOMs[s];
            const node = $getNodeFromDOMNode(addedDOM);
            const parentDOM = addedDOM.parentNode;

            if (
              parentDOM != null &&
              addedDOM !== blockCursorElement &&
              node === null &&
              !isManagedLineBreak(addedDOM, parentDOM, editor)
            ) {
              if (IS_FIREFOX) {
                const possibleText =
                  (isHTMLElement(addedDOM) ? addedDOM.innerText : null) || addedDOM.nodeValue;

                if (possibleText) {
                  possibleTextForFirefoxPaste += possibleText;
                }
              }

              parentDOM.removeChild(addedDOM);
            }
          }

          const removedDOMs = mutation.removedNodes;
          const removedDOMsLength = removedDOMs.length;

          if (removedDOMsLength > 0) {
            let unremovedBRs = 0;

            for (let s = 0; s < removedDOMsLength; s++) {
              const removedDOM = removedDOMs[s];

              if (
                isManagedLineBreak(removedDOM, targetDOM, editor) ||
                blockCursorElement === removedDOM
              ) {
                targetDOM.appendChild(removedDOM);
                unremovedBRs++;
              }
            }

            if (removedDOMsLength !== unremovedBRs) {
              badDOMTargets.set(nodeDOM, targetNode);
            }
          }
        }
      }

      // Now we process each of the unique target nodes, attempting
      // to restore their contents back to the source of truth, which
      // is Lexical's "current" editor state. This is basically like
      // an internal revert on the DOM.
      if (badDOMTargets.size > 0) {
        for (const [nodeDOM, targetNode] of badDOMTargets) {
          targetNode.reconcileObservedMutation(nodeDOM, editor);
        }
      }

      // Capture all the mutations made during this function. This
      // also prevents us having to process them on the next cycle
      // of onMutation, as these mutations were made by us.
      const records = observer.takeRecords();

      // Check for any random auto-added <br> elements, and remove them.
      // These get added by the browser when we undo the above mutations
      // and this can lead to a broken UI.
      if (records.length > 0) {
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          const addedNodes = record.addedNodes;
          const target = record.target;

          for (let s = 0; s < addedNodes.length; s++) {
            const addedDOM = addedNodes[s];
            const parentDOM = addedDOM.parentNode;

            if (
              parentDOM != null &&
              addedDOM.nodeName === 'BR' &&
              !isManagedLineBreak(addedDOM, target, editor)
            ) {
              parentDOM.removeChild(addedDOM);
            }
          }
        }

        // Clear any of those removal mutations
        observer.takeRecords();
      }

      if (selection !== null) {
        if (shouldRevertSelection) {
          $setSelection(selection);
        }

        if (IS_FIREFOX && isFirefoxClipboardEvents(editor)) {
          selection.insertRawText(possibleTextForFirefoxPaste);
        }
      }
    });
  } finally {
    isProcessingMutations = false;
  }
}

export function flushRootMutations(editor: LexicalEditor): void {
  const observer = editor._observer;

  if (observer !== null) {
    const mutations = observer.takeRecords();
    flushMutations(editor, mutations, observer);
  }
}

export function initMutationObserver(editor: LexicalEditor): void {
  initTextEntryListener(editor);
  editor._observer = new MutationObserver(
    (mutations: Array<MutationRecord>, observer: MutationObserver) => {
      flushMutations(editor, mutations, observer);
    },
  );
}

/**
 * Get the value type (V) from a StateConfig
 */
export type StateConfigValue<S extends AnyStateConfig> =
  S extends StateConfig<infer _K, infer V> ? V : never;
/**
 * Get the key type (K) from a StateConfig
 */
export type StateConfigKey<S extends AnyStateConfig> =
  S extends StateConfig<infer K, infer _V> ? K : never;

/**
 * A value type, or an updater for that value type. For use with
 * {@link $setState} or any user-defined wrappers around it.
 */
export type ValueOrUpdater<V> = V | ((prevValue: V) => V);

/**
 * A type alias to make it easier to define setter methods on your node class
 *
 * @example
 * ```ts
 * const fooState = createState("foo", { parse: ... });
 * class MyClass extends TextNode {
 *   // ...
 *   setFoo(valueOrUpdater: StateValueOrUpdater<typeof fooState>): this {
 *     return $setState(this, fooState, valueOrUpdater);
 *   }
 * }
 * ```
 */
export type StateValueOrUpdater<Cfg extends AnyStateConfig> = ValueOrUpdater<StateConfigValue<Cfg>>;

export interface NodeStateConfig<S extends AnyStateConfig> {
  stateConfig: S;
  // eslint-disable-next-line typescript-sort-keys/interface
  flat?: boolean;
}

export type RequiredNodeStateConfig = NodeStateConfig<AnyStateConfig> | AnyStateConfig;

export type StateConfigJSON<S> =
  S extends StateConfig<infer K, infer V> ? { [Key in K]?: V } : Record<never, never>;

export type RequiredNodeStateConfigJSON<
  Config extends RequiredNodeStateConfig,
  Flat extends boolean,
> = StateConfigJSON<
  Config extends NodeStateConfig<infer S>
    ? Spread<Config, { flat: false }> extends { flat: Flat }
      ? S
      : never
    : false extends Flat
      ? Config
      : never
>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/* eslint-disable @typescript-eslint/no-explicit-any */
export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (
  x: infer R,
) => any
  ? R
  : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type CollectStateJSON<
  Tuple extends readonly RequiredNodeStateConfig[],
  Flat extends boolean,
> = UnionToIntersection<
  { [K in keyof Tuple]: RequiredNodeStateConfigJSON<Tuple[K], Flat> }[number]
>;

type GetStaticNodeConfig<T extends LexicalNode> =
  ReturnType<T[typeof PROTOTYPE_CONFIG_METHOD]> extends infer Record
    ? Record extends StaticNodeConfigRecord<infer Type, infer Config>
      ? Config & { readonly type: Type }
      : never
    : never;
type GetStaticNodeConfigs<T extends LexicalNode> =
  GetStaticNodeConfig<T> extends infer OwnConfig
    ? OwnConfig extends never
      ? []
      : OwnConfig extends { extends: Klass<infer Parent> }
        ? GetStaticNodeConfig<Parent> extends infer ParentNodeConfig
          ? ParentNodeConfig extends never
            ? [OwnConfig]
            : [OwnConfig, ...GetStaticNodeConfigs<Parent>]
          : OwnConfig
        : [OwnConfig]
    : [];

type CollectStateConfigs<Configs> = Configs extends [infer OwnConfig, ...infer ParentConfigs]
  ? OwnConfig extends { stateConfigs: infer StateConfigs }
    ? StateConfigs extends readonly RequiredNodeStateConfig[]
      ? [...StateConfigs, ...CollectStateConfigs<ParentConfigs>]
      : CollectStateConfigs<ParentConfigs>
    : CollectStateConfigs<ParentConfigs>
  : [];

export type GetNodeStateConfig<T extends LexicalNode> = CollectStateConfigs<
  GetStaticNodeConfigs<T>
>;

/**
 * The NodeState JSON produced by this LexicalNode
 */
export type NodeStateJSON<T extends LexicalNode> = Prettify<
  {
    [NODE_STATE_KEY]?: Prettify<CollectStateJSON<GetNodeStateConfig<T>, false>>;
  } & CollectStateJSON<GetNodeStateConfig<T>, true>
>;

/**
 * Configure a value to be used with StateConfig.
 *
 * The value type should be inferred from the definition of parse.
 *
 * If the value type is not JSON serializable, then unparse must also be provided.
 *
 * Values should be treated as immutable, much like React.useState. Mutating
 * stored values directly will cause unpredictable behavior, is not supported,
 * and may trigger errors in the future.
 *
 * @example
 * ```ts
 * const numberOrNullState = createState('numberOrNull', {parse: (v) => typeof v === 'number' ? v : null});
 * //    ^? State<'numberOrNull', StateValueConfig<number | null>>
 * const numberState = createState('number', {parse: (v) => typeof v === 'number' ? v : 0});
 * //    ^? State<'number', StateValueConfig<number>>
 * ```
 *
 * Only the parse option is required, it is generally not useful to
 * override `unparse` or `isEqual`. However, if you are using
 * non-primitive types such as Array, Object, Date, or something
 * more exotic then you would want to override this. In these
 * cases you might want to reach for third party libraries.
 *
 * @example
 * ```ts
 * const isoDateState = createState('isoDate', {
 *   parse: (v): null | Date => {
 *     const date = typeof v === 'string' ? new Date(v) : null;
 *     return date && !isNaN(date.valueOf()) ? date : null;
 *   }
 *   isEqual: (a, b) => a === b || (a && b && a.valueOf() === b.valueOf()),
 *   unparse: (v) => v && v.toString()
 * });
 * ```
 *
 * You may find it easier to write a parse function using libraries like
 * zod, valibot, ajv, Effect, TypeBox, etc. perhaps with a wrapper function.
 */
export interface StateValueConfig<V> {
  /**
   * This function must return a default value when called with undefined,
   * otherwise it should parse the given JSON value to your type V. Note
   * that it is not required to copy or clone the given value, you can
   * pass it directly through if it matches the expected type.
   *
   * When you encounter an invalid value, it's up to you to decide
   * as to whether to ignore it and return the default value,
   * return some non-default error value, or throw an error.
   *
   * It is possible for V to include undefined, but if it does, then
   * it should also be considered the default value since undefined
   * can not be serialized to JSON so it is indistinguishable from the
   * default.
   *
   * Similarly, if your V is a function, then usage of {@link $setState}
   * must use an updater function because your type will be indistinguishable
   * from an updater function.
   */
  parse: (jsonValue: unknown) => V;
  /**
   * This is optional and for advanced use cases only.
   *
   * You may specify a function that converts V back to JSON.
   * This is mandatory when V is not a JSON serializable type.
   */
  unparse?: (parsed: V) => unknown;
  /**
   * This is optional and for advanced use cases only.
   *
   * Used to define the equality function so you can use an Array or Object
   * as V and still omit default values from the exported JSON.
   *
   * The default is `Object.is`, but something like `fast-deep-equal` might be
   * more appropriate for your use case.
   */
  isEqual?: (a: V, b: V) => boolean;
}

/**
 * The return value of {@link createState}, for use with
 * {@link $getState} and {@link $setState}.
 */
export class StateConfig<K extends string, V> {
  /** The string key used when serializing this state to JSON */
  readonly key: K;
  /** The parse function from the StateValueConfig passed to createState */
  readonly parse: (value?: unknown) => V;
  /**
   * The unparse function from the StateValueConfig passed to createState,
   * with a default that is simply a pass-through that assumes the value is
   * JSON serializable.
   */
  readonly unparse: (value: V) => unknown;
  /**
   * An equality function from the StateValueConfig, with a default of
   * Object.is.
   */
  readonly isEqual: (a: V, b: V) => boolean;
  /**
   * The result of `stateValueConfig.parse(undefined)`, which is computed only
   * once and used as the default value. When the current value `isEqual` to
   * the `defaultValue`, it will not be serialized to JSON.
   */
  readonly defaultValue: V;
  constructor(key: K, stateValueConfig: StateValueConfig<V>) {
    this.key = key;
    this.parse = stateValueConfig.parse.bind(stateValueConfig);
    this.unparse = (stateValueConfig.unparse || coerceToJSON).bind(stateValueConfig);
    this.isEqual = (stateValueConfig.isEqual || Object.is).bind(stateValueConfig);
    this.defaultValue = this.parse(undefined);
  }
}

/**
 * For advanced use cases, using this type is not recommended unless
 * it is required (due to TypeScript's lack of features like
 * higher-kinded types).
 *
 * A {@link StateConfig} type with any key and any value that can be
 * used in situations where the key and value type can not be known,
 * such as in a generic constraint when working with a collection of
 * StateConfig.
 *
 * {@link StateConfigKey} and {@link StateConfigValue} will be
 * useful when this is used as a generic constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStateConfig = StateConfig<any, any>;

/**
 * Create a StateConfig for the given string key and StateValueConfig.
 *
 * The key must be locally unique. In dev you will get a key collision error
 * when you use two separate StateConfig on the same node with the same key.
 *
 * The returned StateConfig value should be used with {@link $getState} and
 * {@link $setState}.
 *
 * @param key The key to use
 * @param valueConfig Configuration for the value type
 * @returns a StateConfig
 */
export function createState<K extends string, V>(
  key: K,
  valueConfig: StateValueConfig<V>,
): StateConfig<K, V> {
  return new StateConfig(key, valueConfig);
}

/**
 * The accessor for working with node state. This will read the value for the
 * state on the given node, and will return `stateConfig.defaultValue` if the
 * state has never been set on this node.
 *
 * The `version` parameter is optional and should generally be `'latest'`,
 * consistent with the behavior of other node methods and functions,
 * but for certain use cases such as `updateDOM` you may have a need to
 * use `'direct'` to read the state from a previous version of the node.
 *
 * For very advanced use cases, you can expect that 'direct' does not
 * require an editor state, just like directly accessing other properties
 * of a node without an accessor (e.g. `textNode.__text`).
 *
 * @param node Any LexicalNode
 * @param stateConfig The configuration of the state to read
 * @param version The default value 'latest' will read the latest version of the node state, 'direct' will read the version that is stored on this LexicalNode which not reflect the version used in the current editor state
 * @returns The current value from the state, or the default value provided by the configuration.
 */
export function $getState<K extends string, V>(
  node: LexicalNode,
  stateConfig: StateConfig<K, V>,
  version: 'latest' | 'direct' = 'latest',
): V {
  const latestOrDirectNode = version === 'latest' ? node.getLatest() : node;
  const state = latestOrDirectNode.__state;
  if (state) {
    $checkCollision(node, stateConfig, state);
    return state.getValue(stateConfig);
  }
  return stateConfig.defaultValue;
}

/**
 * Given two versions of a node and a stateConfig, compare their state values
 * using `$getState(nodeVersion, stateConfig, 'direct')`.
 * If the values are equal according to `stateConfig.isEqual`, return `null`,
 * otherwise return `[value, prevValue]`.
 *
 * This is useful for implementing updateDOM. Note that the `'direct'`
 * version argument is used for both nodes.
 *
 * @param node Any LexicalNode
 * @param prevNode A previous version of node
 * @param stateConfig The configuration of the state to read
 * @returns `[value, prevValue]` if changed, otherwise `null`
 */
export function $getStateChange<T extends LexicalNode, K extends string, V>(
  node: T,
  prevNode: T,
  stateConfig: StateConfig<K, V>,
): null | [value: V, prevValue: V] {
  const value = $getState(node, stateConfig, 'direct');
  const prevValue = $getState(prevNode, stateConfig, 'direct');
  return stateConfig.isEqual(value, prevValue) ? null : [value, prevValue];
}

/**
 * Set the state defined by stateConfig on node. Like with `React.useState`
 * you may directly specify the value or use an updater function that will
 * be called with the previous value of the state on that node (which will
 * be the `stateConfig.defaultValue` if not set).
 *
 * When an updater function is used, the node will only be marked dirty if
 * `stateConfig.isEqual(prevValue, value)` is false.
 *
 * @example
 * ```ts
 * const toggle = createState('toggle', {parse: Boolean});
 * // set it direction
 * $setState(node, counterState, true);
 * // use an updater
 * $setState(node, counterState, (prev) => !prev);
 * ```
 *
 * @param node The LexicalNode to set the state on
 * @param stateConfig The configuration for this state
 * @param valueOrUpdater The value or updater function
 * @returns node
 */
export function $setState<Node extends LexicalNode, K extends string, V>(
  node: Node,
  stateConfig: StateConfig<K, V>,
  valueOrUpdater: ValueOrUpdater<V>,
): Node {
  errorOnReadOnly();
  let value: V;
  if (typeof valueOrUpdater === 'function') {
    const latest = node.getLatest();
    const prevValue = $getState(latest, stateConfig);
    value = (valueOrUpdater as (v: V) => V)(prevValue);
    if (stateConfig.isEqual(prevValue, value)) {
      return latest;
    }
  } else {
    value = valueOrUpdater;
  }
  const writable = node.getWritable();
  const state = $getWritableNodeState(writable);
  $checkCollision(node, stateConfig, state);
  state.updateFromKnown(stateConfig, value);
  return writable;
}

/**
 * @internal
 *
 * Register the config to this node's sharedConfigMap and throw an exception in
 * `__DEV__` when a collision is detected.
 */
function $checkCollision<Node extends LexicalNode, K extends string, V>(
  node: Node,
  stateConfig: StateConfig<K, V>,
  state: NodeState<Node>,
): void {
  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    const collision = state.sharedNodeState.sharedConfigMap.get(stateConfig.key);
    if (collision !== undefined && collision !== stateConfig) {
      invariant(
        false,
        '$setState: State key collision %s detected in %s node with type %s and key %s. Only one StateConfig with a given key should be used on a node.',
        JSON.stringify(stateConfig.key),
        node.constructor.name,
        node.getType(),
        node.getKey(),
      );
    }
  }
}

/**
 * @internal
 *
 * Opaque state to be stored on the editor's RegisterNode for use by NodeState
 */
export type SharedNodeState = {
  sharedConfigMap: SharedConfigMap;
  flatKeys: Set<string>;
};

/**
 * @internal
 *
 * Create the state to store on RegisteredNode
 */
export function createSharedNodeState(nodeConfig: LexicalNodeConfig): SharedNodeState {
  const sharedConfigMap = new Map<string, AnyStateConfig>();
  const flatKeys = new Set<string>();
  for (
    let klass = typeof nodeConfig === 'function' ? nodeConfig : nodeConfig.replace;
    klass.prototype && klass.prototype.getType !== undefined;
    klass = Object.getPrototypeOf(klass)
  ) {
    const { ownNodeConfig } = getStaticNodeConfig(klass);
    if (ownNodeConfig && ownNodeConfig.stateConfigs) {
      for (const requiredStateConfig of ownNodeConfig.stateConfigs) {
        let stateConfig: AnyStateConfig;
        if ('stateConfig' in requiredStateConfig) {
          stateConfig = requiredStateConfig.stateConfig;
          if (requiredStateConfig.flat) {
            flatKeys.add(stateConfig.key);
          }
        } else {
          stateConfig = requiredStateConfig;
        }
        sharedConfigMap.set(stateConfig.key, stateConfig);
      }
    }
  }
  return { flatKeys, sharedConfigMap };
}

type KnownStateMap = Map<AnyStateConfig, unknown>;
type UnknownStateRecord = Record<string, unknown>;
/**
 * @internal
 *
 * A Map of string keys to state configurations to be shared across nodes
 * and/or node versions.
 */
type SharedConfigMap = Map<string, AnyStateConfig>;

/**
 * @internal
 */
export class NodeState<T extends LexicalNode> {
  /**
   * @internal
   *
   * Track the (versioned) node that this NodeState was created for, to
   * facilitate copy-on-write for NodeState. When a LexicalNode is cloned,
   * it will *reference* the NodeState from its prevNode. From the nextNode
   * you can continue to read state without copying, but the first $setState
   * will trigger a copy of the prevNode's NodeState with the node property
   * updated.
   */
  readonly node: LexicalNode;

  /**
   * @internal
   *
   * State that has already been parsed in a get state, so it is safe. (can be returned with
   * just a cast since the proof was given before).
   *
   * Note that it uses StateConfig, so in addition to (1) the CURRENT VALUE, it has access to
   * (2) the State key (3) the DEFAULT VALUE and (4) the PARSE FUNCTION
   */
  readonly knownState: KnownStateMap;

  /**
   * @internal
   *
   * A copy of serializedNode[NODE_STATE_KEY] that is made when JSON is
   * imported but has not been parsed yet.
   *
   * It stays here until a get state requires us to parse it, and since we
   * then know the value is safe we move it to knownState.
   *
   * Note that since only string keys are used here, we can only allow this
   * state to pass-through on export or on the next version since there is
   * no known value configuration. This pass-through is to support scenarios
   * where multiple versions of the editor code are working in parallel so
   * an old version of your code doesnt erase metadata that was
   * set by a newer version of your code.
   */
  unknownState: undefined | UnknownStateRecord;

  /**
   * @internal
   *
   * This sharedNodeState is preserved across all instances of a given
   * node type in an editor and remains writable. It is how keys are resolved
   * to configuration.
   */
  readonly sharedNodeState: SharedNodeState;
  /**
   * @internal
   *
   * The count of known or unknown keys in this state, ignoring the
   * intersection between the two sets.
   */
  size: number;

  /**
   * @internal
   */
  constructor(
    node: T,
    sharedNodeState: SharedNodeState,
    unknownState: undefined | UnknownStateRecord = undefined,
    knownState: KnownStateMap = new Map(),
    size: number | undefined = undefined,
  ) {
    this.node = node;
    this.sharedNodeState = sharedNodeState;
    this.unknownState = unknownState;
    this.knownState = knownState;
    const { sharedConfigMap } = this.sharedNodeState;
    const computedSize =
      size !== undefined ? size : computeSize(sharedConfigMap, unknownState, knownState);
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      invariant(
        size === undefined || computedSize === size,
        'NodeState: size != computedSize (%s != %s)',
        String(size),
        String(computedSize),
      );
      for (const stateConfig of knownState.keys()) {
        invariant(
          sharedConfigMap.has(stateConfig.key),
          'NodeState: sharedConfigMap missing knownState key %s',
          stateConfig.key,
        );
      }
    }
    this.size = computedSize;
  }

  /**
   * @internal
   *
   * Get the value from knownState, or parse it from unknownState
   * if it contains the given key.
   *
   * Updates the sharedConfigMap when no known state is found.
   * Updates unknownState and knownState when an unknownState is parsed.
   */
  getValue<K extends string, V>(stateConfig: StateConfig<K, V>): V {
    const known = this.knownState.get(stateConfig) as V | undefined;
    if (known !== undefined) {
      return known;
    }
    this.sharedNodeState.sharedConfigMap.set(stateConfig.key, stateConfig);
    let parsed = stateConfig.defaultValue;
    if (this.unknownState && stateConfig.key in this.unknownState) {
      const jsonValue = this.unknownState[stateConfig.key];
      if (jsonValue !== undefined) {
        parsed = stateConfig.parse(jsonValue);
      }
      // Only update if the key was unknown
      this.updateFromKnown(stateConfig, parsed);
    }
    return parsed;
  }

  /**
   * @internal
   *
   * Used only for advanced use cases, such as collab. The intent here is to
   * allow you to diff states with a more stable interface than the properties
   * of this class.
   */
  getInternalState(): [
    { readonly [k in string]: unknown } | undefined,
    ReadonlyMap<AnyStateConfig, unknown>,
  ] {
    return [this.unknownState, this.knownState];
  }

  /**
   * Encode this NodeState to JSON in the format that its node expects.
   * This returns `{[NODE_STATE_KEY]?: UnknownStateRecord}` rather than
   * `UnknownStateRecord | undefined` so that we can support flattening
   * specific entries in the future when nodes can declare what
   * their required StateConfigs are.
   */
  toJSON(): NodeStateJSON<T> {
    const state = { ...this.unknownState };
    const flatState: Record<string, unknown> = {};
    for (const [stateConfig, v] of this.knownState) {
      if (stateConfig.isEqual(v, stateConfig.defaultValue)) {
        delete state[stateConfig.key];
      } else {
        state[stateConfig.key] = stateConfig.unparse(v);
      }
    }
    for (const key of this.sharedNodeState.flatKeys) {
      if (key in state) {
        flatState[key] = state[key];
        delete state[key];
      }
    }
    if (undefinedIfEmpty(state)) {
      flatState[NODE_STATE_KEY] = state;
    }
    return flatState as NodeStateJSON<T>;
  }

  /**
   * @internal
   *
   * A NodeState is writable when the node to update matches
   * the node associated with the NodeState. This basically
   * mirrors how the EditorState NodeMap works, but in a
   * bottom-up organization rather than a top-down organization.
   *
   * This allows us to implement the same "copy on write"
   * pattern for state, without having the state version
   * update every time the node version changes (e.g. when
   * its parent or siblings change).
   *
   * @param node The node to associate with the state
   * @returns The next writable state
   */
  getWritable(node: T): NodeState<T> {
    if (this.node === node) {
      return this;
    }
    const { sharedNodeState, unknownState } = this;
    const nextKnownState = new Map(this.knownState);
    return new NodeState(
      node,
      sharedNodeState,
      parseAndPruneNextUnknownState(sharedNodeState.sharedConfigMap, nextKnownState, unknownState),
      nextKnownState,
      this.size,
    );
  }

  /** @internal */
  updateFromKnown<K extends string, V>(stateConfig: StateConfig<K, V>, value: V): void {
    const key = stateConfig.key;
    this.sharedNodeState.sharedConfigMap.set(key, stateConfig);
    const { knownState, unknownState } = this;
    if (!(knownState.has(stateConfig) || (unknownState && key in unknownState))) {
      if (unknownState) {
        delete unknownState[key];
        this.unknownState = undefinedIfEmpty(unknownState);
      }
      this.size++;
    }
    knownState.set(stateConfig, value);
  }

  /**
   * @internal
   *
   * This is intended for advanced use cases only, such
   * as collab or dev tools.
   *
   * Update a single key value pair from unknown state,
   * parsing it if the key is known to this node. This is
   * basically like updateFromJSON, but the effect is
   * isolated to a single entry.
   *
   * @param k The string key from an UnknownStateRecord
   * @param v The unknown value from an UnknownStateRecord
   */
  updateFromUnknown(k: string, v: unknown): void {
    const stateConfig = this.sharedNodeState.sharedConfigMap.get(k);
    if (stateConfig) {
      this.updateFromKnown(stateConfig, stateConfig.parse(v));
    } else {
      this.unknownState = this.unknownState || {};
      if (!(k in this.unknownState)) {
        this.size++;
      }
      this.unknownState[k] = v;
    }
  }

  /**
   * @internal
   *
   * Reset all existing state to default or empty values,
   * and perform any updates from the given unknownState.
   *
   * This is used when initializing a node's state from JSON,
   * or when resetting a node's state from JSON.
   *
   * @param unknownState The new state in serialized form
   */
  updateFromJSON(unknownState: undefined | UnknownStateRecord): void {
    const { knownState } = this;
    // Reset all known state to defaults
    for (const stateConfig of knownState.keys()) {
      knownState.set(stateConfig, stateConfig.defaultValue);
    }
    // Since we are resetting all state to this new record,
    // the size starts at the number of known keys
    // and will be updated as we traverse the new state
    this.size = knownState.size;
    this.unknownState = undefined;
    if (unknownState) {
      for (const [k, v] of Object.entries(unknownState)) {
        this.updateFromUnknown(k, v);
      }
    }
  }
}

/**
 * @internal
 *
 * Only for direct use in very advanced integrations, such as lexical-yjs.
 * Typically you would only use {@link createState}, {@link $getState}, and
 * {@link $setState}. This is effectively the preamble for {@link $setState}.
 */
export function $getWritableNodeState<T extends LexicalNode>(node: T): NodeState<T> {
  const writable = node.getWritable();
  const state = writable.__state
    ? writable.__state.getWritable(writable)
    : new NodeState(writable, $getSharedNodeState(writable));
  writable.__state = state;
  return state;
}

/**
 * @internal
 *
 * Get the SharedNodeState for a node on this editor
 */
export function $getSharedNodeState<T extends LexicalNode>(node: T): SharedNodeState {
  return node.__state
    ? node.__state.sharedNodeState
    : getRegisteredNodeOrThrow($getEditor(), node.getType()).sharedNodeState;
}

/**
 * @internal
 *
 * This is used to implement LexicalNode.updateFromJSON and is
 * not intended to be exported from the package.
 *
 * @param node any LexicalNode
 * @param unknownState undefined or a serialized State
 * @returns A writable version of node, with the state set.
 */
export function $updateStateFromJSON<T extends LexicalNode>(
  node: T,
  serialized: LexicalUpdateJSON<SerializedLexicalNode>,
): T {
  const writable = node.getWritable();
  const unknownState = serialized[NODE_STATE_KEY];
  let parseState = unknownState;
  for (const k of $getSharedNodeState(writable).flatKeys) {
    if (k in serialized) {
      if (parseState === undefined || parseState === unknownState) {
        parseState = { ...unknownState };
      }
      parseState[k] = serialized[k as keyof typeof serialized];
    }
  }
  if (writable.__state || parseState) {
    $getWritableNodeState(node).updateFromJSON(parseState);
  }
  return writable;
}

/**
 * @internal
 *
 * Return true if the two nodes have equivalent NodeState, to be used
 * to determine when TextNode are being merged, not a lot of use cases
 * otherwise.
 */
export function nodeStatesAreEquivalent<T extends LexicalNode>(
  a: undefined | NodeState<T>,
  b: undefined | NodeState<T>,
): boolean {
  if (a === b) {
    return true;
  }
  if (a && b && a.size !== b.size) {
    return false;
  }
  const keys = new Set<string>();
  return !(
    (a && hasUnequalMapEntry(keys, a, b)) ||
    (b && hasUnequalMapEntry(keys, b, a)) ||
    (a && hasUnequalRecordEntry(keys, a, b)) ||
    (b && hasUnequalRecordEntry(keys, b, a))
  );
}

/**
 * Compute the number of distinct keys that will be in a NodeState
 */
function computeSize(
  sharedConfigMap: SharedConfigMap,
  unknownState: UnknownStateRecord | undefined,
  knownState: KnownStateMap,
): number {
  let size = knownState.size;
  if (unknownState) {
    for (const k in unknownState) {
      const sharedConfig = sharedConfigMap.get(k);
      if (!sharedConfig || !knownState.has(sharedConfig)) {
        size++;
      }
    }
  }
  return size;
}

/**
 * @internal
 *
 * Return obj if it is an object with at least one property, otherwise
 * return undefined.
 */
function undefinedIfEmpty<T extends object>(obj: undefined | T): undefined | T {
  if (obj) {
    for (const key in obj) {
      return obj;
    }
  }
  return undefined;
}

/**
 * @internal
 *
 * Cast the given v to unknown
 */
function coerceToJSON(v: unknown): unknown {
  return v;
}

/**
 * @internal
 *
 * Parse all knowable values in an UnknownStateRecord into nextKnownState
 * and return the unparsed values in a new UnknownStateRecord. Returns
 * undefined if no unknown values remain.
 */
function parseAndPruneNextUnknownState(
  sharedConfigMap: SharedConfigMap,
  nextKnownState: KnownStateMap,
  unknownState: undefined | UnknownStateRecord,
): undefined | UnknownStateRecord {
  let nextUnknownState: undefined | UnknownStateRecord = undefined;
  if (unknownState) {
    for (const [k, v] of Object.entries(unknownState)) {
      const stateConfig = sharedConfigMap.get(k);
      if (stateConfig) {
        if (!nextKnownState.has(stateConfig)) {
          nextKnownState.set(stateConfig, stateConfig.parse(v));
        }
      } else {
        nextUnknownState = nextUnknownState || {};
        nextUnknownState[k] = v;
      }
    }
  }
  return nextUnknownState;
}

/**
 * @internal
 *
 * Compare each entry of sourceState.knownState that is not in keys to
 * otherState (or the default value if otherState is undefined.
 * Note that otherState will return the defaultValue as well if it
 * has never been set. Any checked entry's key will be added to keys.
 *
 * @returns true if any difference is found, false otherwise
 */
function hasUnequalMapEntry<T extends LexicalNode>(
  keys: Set<string>,
  sourceState: NodeState<T>,
  otherState?: NodeState<T>,
): boolean {
  for (const [stateConfig, value] of sourceState.knownState) {
    if (keys.has(stateConfig.key)) {
      continue;
    }
    keys.add(stateConfig.key);
    const otherValue = otherState ? otherState.getValue(stateConfig) : stateConfig.defaultValue;
    if (otherValue !== value && !stateConfig.isEqual(otherValue, value)) {
      return true;
    }
  }
  return false;
}

/**
 * @internal
 *
 * Compare each entry of sourceState.unknownState that is not in keys to
 * otherState.unknownState (or undefined if otherState is undefined).
 * Any checked entry's key will be added to keys.
 *
 * Notably since we have already checked hasUnequalMapEntry on both sides,
 * we do not do any parsing or checking of knownState.
 *
 * @returns true if any difference is found, false otherwise
 */
function hasUnequalRecordEntry<T extends LexicalNode>(
  keys: Set<string>,
  sourceState: NodeState<T>,
  otherState?: NodeState<T>,
): boolean {
  const { unknownState } = sourceState;
  const otherUnknownState = otherState ? otherState.unknownState : undefined;
  if (unknownState) {
    for (const [key, value] of Object.entries(unknownState)) {
      if (keys.has(key)) {
        continue;
      }
      keys.add(key);
      const otherValue = otherUnknownState ? otherUnknownState[key] : undefined;
      if (value !== otherValue) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @internal
 *
 * Clones the NodeState for a given node. Handles aliasing if the state references the from node.
 */
export function $cloneNodeState<T extends LexicalNode>(from: T, to: T): undefined | NodeState<T> {
  const state = from.__state;
  return state && state.node === from ? state.getWritable(to) : state;
}

function $canSimpleTextNodesBeMerged(node1: TextNode, node2: TextNode): boolean {
  const node1Mode = node1.__mode;
  const node1Format = node1.__format;
  const node1Style = node1.__style;
  const node2Mode = node2.__mode;
  const node2Format = node2.__format;
  const node2Style = node2.__style;
  const node1State = node1.__state;
  const node2State = node2.__state;
  return (
    (node1Mode === null || node1Mode === node2Mode) &&
    (node1Format === null || node1Format === node2Format) &&
    (node1Style === null || node1Style === node2Style) &&
    (node1.__state === null ||
      node1State === node2State ||
      nodeStatesAreEquivalent(node1State, node2State))
  );
}

function $mergeTextNodes(node1: TextNode, node2: TextNode): TextNode {
  const writableNode1 = node1.mergeWithSibling(node2);

  const normalizedNodes = getActiveEditor()._normalizedNodes;

  normalizedNodes.add(node1.__key);
  normalizedNodes.add(node2.__key);
  return writableNode1;
}

export function $normalizeTextNode(textNode: TextNode): void {
  let node = textNode;

  if (node.__text === '' && node.isSimpleText() && !node.isUnmergeable()) {
    node.remove();
    return;
  }

  // Backward
  let previousNode;

  while (
    (previousNode = node.getPreviousSibling()) !== null &&
    $isTextNode(previousNode) &&
    previousNode.isSimpleText() &&
    !previousNode.isUnmergeable()
  ) {
    if (previousNode.__text === '') {
      previousNode.remove();
    } else if ($canSimpleTextNodesBeMerged(previousNode, node)) {
      node = $mergeTextNodes(previousNode, node);
      break;
    } else {
      break;
    }
  }

  // Forward
  let nextNode;

  while (
    (nextNode = node.getNextSibling()) !== null &&
    $isTextNode(nextNode) &&
    nextNode.isSimpleText() &&
    !nextNode.isUnmergeable()
  ) {
    if (nextNode.__text === '') {
      nextNode.remove();
    } else if ($canSimpleTextNodesBeMerged(node, nextNode)) {
      node = $mergeTextNodes(node, nextNode);
      break;
    } else {
      break;
    }
  }
}

export function $normalizeSelection(selection: RangeSelection): RangeSelection {
  $normalizePoint(selection.anchor);
  $normalizePoint(selection.focus);
  return selection;
}

export const $normalizeSelection__EXPERIMENTAL = $normalizeSelection;

function $normalizePoint(point: PointType): void {
  while (point.type === 'element') {
    const node = point.getNode();
    const offset = point.offset;
    let nextNode;
    let nextOffsetAtEnd;
    if (offset === node.getChildrenSize()) {
      nextNode = node.getChildAtIndex(offset - 1);
      nextOffsetAtEnd = true;
    } else {
      nextNode = node.getChildAtIndex(offset);
      nextOffsetAtEnd = false;
    }
    if ($isTextNode(nextNode)) {
      point.set(nextNode.__key, nextOffsetAtEnd ? nextNode.getTextContentSize() : 0, 'text', true);
      break;
    } else if (!$isElementNode(nextNode)) {
      break;
    }
    point.set(nextNode.__key, nextOffsetAtEnd ? nextNode.getChildrenSize() : 0, 'element', true);
  }
}

export type TextPointType = {
  _selection: BaseSelection;
  getNode: () => TextNode;
  is: (point: PointType) => boolean;
  isBefore: (point: PointType) => boolean;
  key: NodeKey;
  offset: number;
  set: (key: NodeKey, offset: number, type: 'text' | 'element', onlyIfChanged?: boolean) => void;
  type: 'text';
};

export type ElementPointType = {
  _selection: BaseSelection;
  getNode: () => ElementNode;
  is: (point: PointType) => boolean;
  isBefore: (point: PointType) => boolean;
  key: NodeKey;
  offset: number;
  set: (key: NodeKey, offset: number, type: 'text' | 'element', onlyIfChanged?: boolean) => void;
  type: 'element';
};

export type PointType = TextPointType | ElementPointType;

export class Point {
  key: NodeKey;
  offset: number;
  type: 'text' | 'element';
  _selection: BaseSelection | null;

  constructor(key: NodeKey, offset: number, type: 'text' | 'element') {
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      // This prevents a circular reference error when serialized as JSON,
      // which happens on unit test failures
      Object.defineProperty(this, '_selection', {
        enumerable: false,
        writable: true,
      });
    }
    this._selection = null;
    this.key = key;
    this.offset = offset;
    this.type = type;
  }

  is(point: PointType): boolean {
    return this.key === point.key && this.offset === point.offset && this.type === point.type;
  }

  isBefore(b: PointType): boolean {
    if (this.key === b.key) {
      return this.offset < b.offset;
    }
    const aCaret = $normalizeCaret($caretFromPoint(this, 'next'));
    const bCaret = $normalizeCaret($caretFromPoint(b, 'next'));
    return $comparePointCaretNext(aCaret, bCaret) < 0;
  }

  getNode(): LexicalNode {
    const key = this.key;
    const node = $getNodeByKey(key);
    if (node === null) {
      invariant(false, 'Point.getNode: node not found');
    }
    return node;
  }

  set(key: NodeKey, offset: number, type: 'text' | 'element', onlyIfChanged?: boolean): void {
    const selection = this._selection;
    const oldKey = this.key;
    if (onlyIfChanged && this.key === key && this.offset === offset && this.type === type) {
      return;
    }
    this.key = key;
    this.offset = offset;
    this.type = type;
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      const node = $getNodeByKey(key);
      invariant(
        type === 'text' ? $isTextNode(node) : $isElementNode(node),
        'PointType.set: node with key %s is %s and can not be used for a %s point',
        key,
        node ? node.__type : '[not found]',
        type,
      );
    }
    if (!isCurrentlyReadOnlyMode()) {
      if ($getCompositionKey() === oldKey) {
        $setCompositionKey(key);
      }
      if (selection !== null) {
        selection.setCachedNodes(null);
        selection.dirty = true;
      }
    }
  }
}

export function $createPoint(key: NodeKey, offset: number, type: 'text' | 'element'): PointType {
  // @ts-expect-error: intentionally cast as we use a class for perf reasons
  return new Point(key, offset, type);
}

function selectPointOnNode(point: PointType, node: LexicalNode): void {
  let key = node.__key;
  let offset = point.offset;
  let type: 'element' | 'text' = 'element';
  if ($isTextNode(node)) {
    type = 'text';
    const textContentLength = node.getTextContentSize();
    if (offset > textContentLength) {
      offset = textContentLength;
    }
  } else if (!$isElementNode(node)) {
    const nextSibling = node.getNextSibling();
    if ($isTextNode(nextSibling)) {
      key = nextSibling.__key;
      offset = 0;
      type = 'text';
    } else {
      const parentNode = node.getParent();
      if (parentNode) {
        key = parentNode.__key;
        offset = node.getIndexWithinParent() + 1;
      }
    }
  }
  point.set(key, offset, type);
}

export function $moveSelectionPointToEnd(point: PointType, node: LexicalNode): void {
  if ($isElementNode(node)) {
    const lastNode = node.getLastDescendant();
    if ($isElementNode(lastNode) || $isTextNode(lastNode)) {
      selectPointOnNode(point, lastNode);
    } else {
      selectPointOnNode(point, node);
    }
  } else {
    selectPointOnNode(point, node);
  }
}

function $transferStartingElementPointToTextPoint(
  start: ElementPointType,
  end: PointType,
  format: number,
  style: string,
): void {
  const element = start.getNode();
  const placementNode = element.getChildAtIndex(start.offset);
  const textNode = $createTextNode();
  const target = $isRootNode(element) ? $createParagraphNode().append(textNode) : textNode;
  textNode.setFormat(format);
  textNode.setStyle(style);
  if (placementNode === null) {
    element.append(target);
  } else {
    placementNode.insertBefore(target);
  }
  // Transfer the element point to a text point.
  if (start.is(end)) {
    end.set(textNode.__key, 0, 'text');
  }
  start.set(textNode.__key, 0, 'text');
}

export interface BaseSelection {
  _cachedNodes: Array<LexicalNode> | null;
  dirty: boolean;

  clone(): BaseSelection;
  extract(): Array<LexicalNode>;
  getNodes(): Array<LexicalNode>;
  getTextContent(): string;
  insertText(text: string): void;
  insertRawText(text: string): void;
  is(selection: null | BaseSelection): boolean;
  insertNodes(nodes: Array<LexicalNode>): void;
  getStartEndPoints(): null | [PointType, PointType];
  isCollapsed(): boolean;
  isBackward(): boolean;
  getCachedNodes(): LexicalNode[] | null;
  setCachedNodes(nodes: LexicalNode[] | null): void;
}

export class NodeSelection implements BaseSelection {
  _nodes: Set<NodeKey>;
  _cachedNodes: Array<LexicalNode> | null;
  dirty: boolean;

  constructor(objects: Set<NodeKey>) {
    this._cachedNodes = null;
    this._nodes = objects;
    this.dirty = false;
  }

  getCachedNodes(): LexicalNode[] | null {
    return this._cachedNodes;
  }

  setCachedNodes(nodes: LexicalNode[] | null): void {
    this._cachedNodes = nodes;
  }

  is(selection: null | BaseSelection): boolean {
    if (!$isNodeSelection(selection)) {
      return false;
    }
    const a: Set<NodeKey> = this._nodes;
    const b: Set<NodeKey> = selection._nodes;
    return a.size === b.size && Array.from(a).every((key) => b.has(key));
  }

  isCollapsed(): boolean {
    return false;
  }

  isBackward(): boolean {
    return false;
  }

  getStartEndPoints(): null {
    return null;
  }

  add(key: NodeKey): void {
    this.dirty = true;
    this._nodes.add(key);
    this._cachedNodes = null;
  }

  delete(key: NodeKey): void {
    this.dirty = true;
    this._nodes.delete(key);
    this._cachedNodes = null;
  }

  clear(): void {
    this.dirty = true;
    this._nodes.clear();
    this._cachedNodes = null;
  }

  has(key: NodeKey): boolean {
    return this._nodes.has(key);
  }

  clone(): NodeSelection {
    return new NodeSelection(new Set(this._nodes));
  }

  extract(): Array<LexicalNode> {
    return this.getNodes();
  }

  insertRawText(text: string): void {
    // Do nothing?
  }

  insertText(): void {
    // Do nothing?
  }

  insertNodes(nodes: Array<LexicalNode>) {
    const selectedNodes = this.getNodes();
    const selectedNodesLength = selectedNodes.length;
    const lastSelectedNode = selectedNodes[selectedNodesLength - 1];
    let selectionAtEnd: RangeSelection;
    // Insert nodes
    if ($isTextNode(lastSelectedNode)) {
      selectionAtEnd = lastSelectedNode.select();
    } else {
      const index = lastSelectedNode.getIndexWithinParent() + 1;
      selectionAtEnd = lastSelectedNode.getParentOrThrow().select(index, index);
    }
    selectionAtEnd.insertNodes(nodes);
    // Remove selected nodes
    for (let i = 0; i < selectedNodesLength; i++) {
      selectedNodes[i].remove();
    }
  }

  getNodes(): Array<LexicalNode> {
    const cachedNodes = this._cachedNodes;
    if (cachedNodes !== null) {
      return cachedNodes;
    }
    const objects = this._nodes;
    const nodes = [];
    for (const object of objects) {
      const node = $getNodeByKey(object);
      if (node !== null) {
        nodes.push(node);
      }
    }
    if (!isCurrentlyReadOnlyMode()) {
      this._cachedNodes = nodes;
    }
    return nodes;
  }

  getTextContent(): string {
    const nodes = this.getNodes();
    let textContent = '';
    for (let i = 0; i < nodes.length; i++) {
      textContent += nodes[i].getTextContent();
    }
    return textContent;
  }

  /**
   * Remove all nodes in the NodeSelection. If there were any nodes,
   * replace the selection with a new RangeSelection at the previous
   * location of the first node.
   */
  deleteNodes(): void {
    const nodes = this.getNodes();
    if (($getSelection() || $getPreviousSelection()) === this && nodes[0]) {
      const firstCaret = $getSiblingCaret(nodes[0], 'next');
      $setSelectionFromCaretRange($getCaretRange(firstCaret, firstCaret));
    }
    for (const node of nodes) {
      node.remove();
    }
  }
}

export function $isRangeSelection(x: unknown): x is RangeSelection {
  return x instanceof RangeSelection;
}

export class RangeSelection implements BaseSelection {
  format: number;
  style: string;
  anchor: PointType;
  focus: PointType;
  _cachedNodes: Array<LexicalNode> | null;
  dirty: boolean;

  constructor(anchor: PointType, focus: PointType, format: number, style: string) {
    this.anchor = anchor;
    this.focus = focus;
    anchor._selection = this;
    focus._selection = this;
    this._cachedNodes = null;
    this.format = format;
    this.style = style;
    this.dirty = false;
  }

  getCachedNodes(): LexicalNode[] | null {
    return this._cachedNodes;
  }

  setCachedNodes(nodes: LexicalNode[] | null): void {
    this._cachedNodes = nodes;
  }

  /**
   * Used to check if the provided selections is equal to this one by value,
   * including anchor, focus, format, and style properties.
   * @param selection - the Selection to compare this one to.
   * @returns true if the Selections are equal, false otherwise.
   */
  is(selection: null | BaseSelection): boolean {
    if (!$isRangeSelection(selection)) {
      return false;
    }
    return (
      this.anchor.is(selection.anchor) &&
      this.focus.is(selection.focus) &&
      this.format === selection.format &&
      this.style === selection.style
    );
  }

  /**
   * Returns whether the Selection is "collapsed", meaning the anchor and focus are
   * the same node and have the same offset.
   *
   * @returns true if the Selection is collapsed, false otherwise.
   */
  isCollapsed(): boolean {
    return this.anchor.is(this.focus);
  }

  /**
   * Gets all the nodes in the Selection. Uses caching to make it generally suitable
   * for use in hot paths.
   *
   * See also the {@link CaretRange} APIs (starting with
   * {@link $caretRangeFromSelection}), which are likely to provide a better
   * foundation for any operation where partial selection is relevant
   * (e.g. the anchor or focus are inside an ElementNode and TextNode)
   *
   * @returns an Array containing all the nodes in the Selection
   */
  getNodes(): Array<LexicalNode> {
    const cachedNodes = this._cachedNodes;
    if (cachedNodes !== null) {
      return cachedNodes;
    }
    const range = $getCaretRangeInDirection($caretRangeFromSelection(this), 'next');
    const nodes = $getNodesFromCaretRangeCompat(range);
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      if (this.isCollapsed() && nodes.length > 1) {
        invariant(
          false,
          'RangeSelection.getNodes() returned %s > 1 nodes in a collapsed selection',
          String(nodes.length),
        );
      }
    }
    if (!isCurrentlyReadOnlyMode()) {
      this._cachedNodes = nodes;
    }
    return nodes;
  }

  /**
   * Sets this Selection to be of type "text" at the provided anchor and focus values.
   *
   * @param anchorNode - the anchor node to set on the Selection
   * @param anchorOffset - the offset to set on the Selection
   * @param focusNode - the focus node to set on the Selection
   * @param focusOffset - the focus offset to set on the Selection
   */
  setTextNodeRange(
    anchorNode: TextNode,
    anchorOffset: number,
    focusNode: TextNode,
    focusOffset: number,
  ): void {
    this.anchor.set(anchorNode.__key, anchorOffset, 'text');
    this.focus.set(focusNode.__key, focusOffset, 'text');
  }

  /**
   * Gets the (plain) text content of all the nodes in the selection.
   *
   * @returns a string representing the text content of all the nodes in the Selection
   */
  getTextContent(): string {
    const nodes = this.getNodes();
    if (nodes.length === 0) {
      return '';
    }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    const anchor = this.anchor;
    const focus = this.focus;
    const isBefore = anchor.isBefore(focus);
    const [anchorOffset, focusOffset] = $getCharacterOffsets(this);
    let textContent = '';
    let prevWasElement = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if ($isElementNode(node) && !node.isInline()) {
        if (!prevWasElement) {
          textContent += '\n';
        }
        if (node.isEmpty()) {
          prevWasElement = false;
        } else {
          prevWasElement = true;
        }
      } else {
        prevWasElement = false;
        if ($isTextNode(node)) {
          let text = node.getTextContent();
          if (node === firstNode) {
            if (node === lastNode) {
              if (
                anchor.type !== 'element' ||
                focus.type !== 'element' ||
                focus.offset === anchor.offset
              ) {
                text =
                  anchorOffset < focusOffset
                    ? text.slice(anchorOffset, focusOffset)
                    : text.slice(focusOffset, anchorOffset);
              }
            } else {
              text = isBefore ? text.slice(anchorOffset) : text.slice(focusOffset);
            }
          } else if (node === lastNode) {
            text = isBefore ? text.slice(0, focusOffset) : text.slice(0, anchorOffset);
          }
          textContent += text;
        } else if (
          ($isDecoratorNode(node) || $isLineBreakNode(node)) &&
          (node !== lastNode || !this.isCollapsed())
        ) {
          textContent += node.getTextContent();
        }
      }
    }
    return textContent;
  }

  /**
   * Attempts to map a DOM selection range onto this Lexical Selection,
   * setting the anchor, focus, and type accordingly
   *
   * @param range a DOM Selection range conforming to the StaticRange interface.
   */
  applyDOMRange(range: StaticRange): void {
    const editor = getActiveEditor();
    const currentEditorState = editor.getEditorState();
    const lastSelection = currentEditorState._selection;
    const resolvedSelectionPoints = $internalResolveSelectionPoints(
      range.startContainer,
      range.startOffset,
      range.endContainer,
      range.endOffset,
      editor,
      lastSelection,
    );
    if (resolvedSelectionPoints === null) {
      return;
    }
    const [anchorPoint, focusPoint] = resolvedSelectionPoints;
    this.anchor.set(anchorPoint.key, anchorPoint.offset, anchorPoint.type, true);
    this.focus.set(focusPoint.key, focusPoint.offset, focusPoint.type, true);
    // Firefox will use an element point rather than a text point in some cases,
    // so we normalize for that
    $normalizeSelection(this);
  }

  /**
   * Creates a new RangeSelection, copying over all the property values from this one.
   *
   * @returns a new RangeSelection with the same property values as this one.
   */
  clone(): RangeSelection {
    const anchor = this.anchor;
    const focus = this.focus;
    const selection = new RangeSelection(
      $createPoint(anchor.key, anchor.offset, anchor.type),
      $createPoint(focus.key, focus.offset, focus.type),
      this.format,
      this.style,
    );
    return selection;
  }

  /**
   * Toggles the provided format on all the TextNodes in the Selection.
   *
   * @param format a string TextFormatType to toggle on the TextNodes in the selection
   */
  toggleFormat(format: TextFormatType): void {
    this.format = toggleTextFormatType(this.format, format, null);
    this.dirty = true;
  }

  /**
   * Sets the value of the format property on the Selection
   *
   * @param format - the format to set at the value of the format property.
   */
  setFormat(format: number): void {
    this.format = format;
    this.dirty = true;
  }

  /**
   * Sets the value of the style property on the Selection
   *
   * @param style - the style to set at the value of the style property.
   */
  setStyle(style: string): void {
    this.style = style;
    this.dirty = true;
  }

  /**
   * Returns whether the provided TextFormatType is present on the Selection. This will be true if any node in the Selection
   * has the specified format.
   *
   * @param type the TextFormatType to check for.
   * @returns true if the provided format is currently toggled on on the Selection, false otherwise.
   */
  hasFormat(type: TextFormatType): boolean {
    const formatFlag = TEXT_TYPE_TO_FORMAT[type];
    return (this.format & formatFlag) !== 0;
  }

  /**
   * Attempts to insert the provided text into the EditorState at the current Selection.
   * converts tabs, newlines, and carriage returns into LexicalNodes.
   *
   * @param text the text to insert into the Selection
   */
  insertRawText(text: string): void {
    const parts = text.split(/(\r?\n|\t)/);
    const nodes = [];
    const length = parts.length;
    for (let i = 0; i < length; i++) {
      const part = parts[i];
      if (part === '\n' || part === '\r\n') {
        nodes.push($createLineBreakNode());
      } else if (part === '\t') {
        nodes.push($createTabNode());
      } else {
        nodes.push($createTextNode(part));
      }
    }
    this.insertNodes(nodes);
  }

  /**
   * Insert the provided text into the EditorState at the current Selection.
   *
   * @param text the text to insert into the Selection
   */
  insertText(text: string): void {
    // Now that "removeText" has been improved and does not depend on
    // insertText, insertText can be greatly simplified. The next
    // commented version is a WIP (about 5 tests fail).
    //
    // this.removeText();
    // if (text === '') {
    //   return;
    // }
    // const anchorNode = this.anchor.getNode();
    // const textNode = $createTextNode(text);
    // textNode.setFormat(this.format);
    // textNode.setStyle(this.style);
    // if ($isTextNode(anchorNode)) {
    //   const parent = anchorNode.getParentOrThrow();
    //   if (this.anchor.offset === 0) {
    //     if (parent.isInline() && !anchorNode.__prev) {
    //       parent.insertBefore(textNode);
    //     } else {
    //       anchorNode.insertBefore(textNode);
    //     }
    //   } else if (this.anchor.offset === anchorNode.getTextContentSize()) {
    //     if (parent.isInline() && !anchorNode.__next) {
    //       parent.insertAfter(textNode);
    //     } else {
    //       anchorNode.insertAfter(textNode);
    //     }
    //   } else {
    //     const [before] = anchorNode.splitText(this.anchor.offset);
    //     before.insertAfter(textNode);
    //   }
    // } else {
    //   anchorNode.splice(this.anchor.offset, 0, [textNode]);
    // }
    // const nodeToSelect = textNode.isAttached() ? textNode : anchorNode;
    // nodeToSelect.selectEnd();
    // // When composing, we need to adjust the anchor offset so that
    // // we correctly replace that right range.
    // if (
    //   textNode.isComposing() &&
    //   this.anchor.type === 'text' &&
    //   anchorNode.getTextContent() !== ''
    // ) {
    //   this.anchor.offset -= text.length;
    // }

    const anchor = this.anchor;
    const focus = this.focus;
    const format = this.format;
    const style = this.style;
    let firstPoint = anchor;
    let endPoint = focus;
    if (!this.isCollapsed() && focus.isBefore(anchor)) {
      firstPoint = focus;
      endPoint = anchor;
    }
    if (firstPoint.type === 'element') {
      $transferStartingElementPointToTextPoint(firstPoint, endPoint, format, style);
    }
    if (endPoint.type === 'element') {
      $setPointFromCaret(endPoint, $normalizeCaret($caretFromPoint(endPoint, 'next')));
    }
    const startOffset = firstPoint.offset;
    let endOffset = endPoint.offset;
    const selectedNodes = this.getNodes();
    const selectedNodesLength = selectedNodes.length;
    let firstNode: TextNode = selectedNodes[0] as TextNode;

    if (!$isTextNode(firstNode)) {
      invariant(false, 'insertText: first node is not a text node');
    }
    const firstNodeText = firstNode.getTextContent();
    const firstNodeTextLength = firstNodeText.length;
    const firstNodeParent = firstNode.getParentOrThrow();
    const lastIndex = selectedNodesLength - 1;
    let lastNode = selectedNodes[lastIndex];

    if (selectedNodesLength === 1 && endPoint.type === 'element') {
      endOffset = firstNodeTextLength;
      endPoint.set(firstPoint.key, endOffset, 'text');
    }

    if (
      this.isCollapsed() &&
      startOffset === firstNodeTextLength &&
      ($isTokenOrSegmented(firstNode) ||
        !firstNode.canInsertTextAfter() ||
        (!firstNodeParent.canInsertTextAfter() && firstNode.getNextSibling() === null))
    ) {
      let nextSibling = firstNode.getNextSibling<TextNode>();
      if (
        !$isTextNode(nextSibling) ||
        !nextSibling.canInsertTextBefore() ||
        $isTokenOrSegmented(nextSibling)
      ) {
        nextSibling = $createTextNode();
        nextSibling.setFormat(format);
        nextSibling.setStyle(style);
        if (!firstNodeParent.canInsertTextAfter()) {
          firstNodeParent.insertAfter(nextSibling);
        } else {
          firstNode.insertAfter(nextSibling);
        }
      }
      nextSibling.select(0, 0);
      firstNode = nextSibling;
      if (text !== '') {
        this.insertText(text);
        return;
      }
    } else if (
      this.isCollapsed() &&
      startOffset === 0 &&
      ($isTokenOrSegmented(firstNode) ||
        !firstNode.canInsertTextBefore() ||
        (!firstNodeParent.canInsertTextBefore() && firstNode.getPreviousSibling() === null))
    ) {
      let prevSibling = firstNode.getPreviousSibling<TextNode>();
      if (!$isTextNode(prevSibling) || $isTokenOrSegmented(prevSibling)) {
        prevSibling = $createTextNode();
        prevSibling.setFormat(format);
        if (!firstNodeParent.canInsertTextBefore()) {
          firstNodeParent.insertBefore(prevSibling);
        } else {
          firstNode.insertBefore(prevSibling);
        }
      }
      prevSibling.select();
      firstNode = prevSibling;
      if (text !== '') {
        this.insertText(text);
        return;
      }
    } else if (firstNode.isSegmented() && startOffset !== firstNodeTextLength) {
      const textNode = $createTextNode(firstNode.getTextContent());
      textNode.setFormat(format);
      firstNode.replace(textNode);
      firstNode = textNode;
    } else if (!this.isCollapsed() && text !== '') {
      // When the firstNode or lastNode parents are elements that
      // do not allow text to be inserted before or after, we first
      // clear the content. Then we normalize selection, then insert
      // the new content.
      const lastNodeParent = lastNode.getParent();

      if (
        !firstNodeParent.canInsertTextBefore() ||
        !firstNodeParent.canInsertTextAfter() ||
        ($isElementNode(lastNodeParent) &&
          (!lastNodeParent.canInsertTextBefore() || !lastNodeParent.canInsertTextAfter()))
      ) {
        this.insertText('');
        $normalizeSelectionPointsForBoundaries(this.anchor, this.focus, null);
        this.insertText(text);
        return;
      }
    }

    if (selectedNodesLength === 1) {
      if ($isTokenOrTab(firstNode)) {
        const textNode = $createTextNode(text);
        textNode.select();
        firstNode.replace(textNode);
        return;
      }
      const firstNodeFormat = firstNode.getFormat();
      const firstNodeStyle = firstNode.getStyle();

      if (startOffset === endOffset && (firstNodeFormat !== format || firstNodeStyle !== style)) {
        if (firstNode.getTextContent() === '') {
          firstNode.setFormat(format);
          firstNode.setStyle(style);
        } else {
          const textNode = $createTextNode(text);
          textNode.setFormat(format);
          textNode.setStyle(style);
          textNode.select();
          if (startOffset === 0) {
            firstNode.insertBefore(textNode, false);
          } else {
            const [targetNode] = firstNode.splitText(startOffset);
            targetNode.insertAfter(textNode, false);
          }
          // When composing, we need to adjust the anchor offset so that
          // we correctly replace that right range.
          if (textNode.isComposing() && this.anchor.type === 'text') {
            this.anchor.offset -= text.length;
          }
          return;
        }
      } else if ($isTabNode(firstNode)) {
        // We don't need to check for delCount because there is only the entire selected node case
        // that can hit here for content size 1 and with canInsertTextBeforeAfter false
        const textNode = $createTextNode(text);
        textNode.setFormat(format);
        textNode.setStyle(style);
        textNode.select();
        firstNode.replace(textNode);
        return;
      }
      const delCount = endOffset - startOffset;

      firstNode = firstNode.spliceText(startOffset, delCount, text, true);
      if (firstNode.getTextContent() === '') {
        firstNode.remove();
      } else if (this.anchor.type === 'text') {
        if (firstNode.isComposing()) {
          // When composing, we need to adjust the anchor offset so that
          // we correctly replace that right range.
          this.anchor.offset -= text.length;
        } else {
          this.format = firstNodeFormat;
          this.style = firstNodeStyle;
        }
      }
    } else {
      const markedNodeKeysForKeep = new Set([
        ...firstNode.getParentKeys(),
        ...lastNode.getParentKeys(),
      ]);

      // We have to get the parent elements before the next section,
      // as in that section we might mutate the lastNode.
      const firstElement = $isElementNode(firstNode) ? firstNode : firstNode.getParentOrThrow();
      let lastElement = $isElementNode(lastNode) ? lastNode : lastNode.getParentOrThrow();
      let lastElementChild = lastNode;

      // If the last element is inline, we should instead look at getting
      // the nodes of its parent, rather than itself. This behavior will
      // then better match how text node insertions work. We will need to
      // also update the last element's child accordingly as we do this.
      if (!firstElement.is(lastElement) && lastElement.isInline()) {
        // Keep traversing till we have a non-inline element parent.
        do {
          lastElementChild = lastElement;
          lastElement = lastElement.getParentOrThrow();
        } while (lastElement.isInline());
      }

      // Handle mutations to the last node.
      if (
        (endPoint.type === 'text' && (endOffset !== 0 || lastNode.getTextContent() === '')) ||
        (endPoint.type === 'element' && lastNode.getIndexWithinParent() < endOffset)
      ) {
        if (
          $isTextNode(lastNode) &&
          !$isTokenOrTab(lastNode) &&
          endOffset !== lastNode.getTextContentSize()
        ) {
          if (lastNode.isSegmented()) {
            const textNode = $createTextNode(lastNode.getTextContent());
            lastNode.replace(textNode);
            lastNode = textNode;
          }
          // root node selections only select whole nodes, so no text splice is necessary
          if (!$isRootNode(endPoint.getNode()) && endPoint.type === 'text') {
            lastNode = (lastNode as TextNode).spliceText(0, endOffset, '');
          }
          markedNodeKeysForKeep.add(lastNode.__key);
        } else {
          const lastNodeParent = lastNode.getParentOrThrow();
          if (!lastNodeParent.canBeEmpty() && lastNodeParent.getChildrenSize() === 1) {
            lastNodeParent.remove();
          } else {
            lastNode.remove();
          }
        }
      } else {
        markedNodeKeysForKeep.add(lastNode.__key);
      }

      // Either move the remaining nodes of the last parent to after
      // the first child, or remove them entirely. If the last parent
      // is the same as the first parent, this logic also works.
      const lastNodeChildren = lastElement.getChildren();
      const selectedNodesSet = new Set(selectedNodes);
      const firstAndLastElementsAreEqual = firstElement.is(lastElement);

      // We choose a target to insert all nodes after. In the case of having
      // and inline starting parent element with a starting node that has no
      // siblings, we should insert after the starting parent element, otherwise
      // we will incorrectly merge into the starting parent element.
      // TODO: should we keep on traversing parents if we're inside another
      // nested inline element?
      const insertionTarget =
        firstElement.isInline() && firstNode.getNextSibling() === null ? firstElement : firstNode;

      for (let i = lastNodeChildren.length - 1; i >= 0; i--) {
        const lastNodeChild = lastNodeChildren[i];

        if (
          lastNodeChild.is(firstNode) ||
          ($isElementNode(lastNodeChild) && lastNodeChild.isParentOf(firstNode))
        ) {
          break;
        }

        if (lastNodeChild.isAttached()) {
          if (!selectedNodesSet.has(lastNodeChild) || lastNodeChild.is(lastElementChild)) {
            if (!firstAndLastElementsAreEqual) {
              insertionTarget.insertAfter(lastNodeChild, false);
            }
          } else {
            lastNodeChild.remove();
          }
        }
      }

      if (!firstAndLastElementsAreEqual) {
        // Check if we have already moved out all the nodes of the
        // last parent, and if so, traverse the parent tree and mark
        // them all as being able to deleted too.
        let parent: ElementNode | null = lastElement;
        let lastRemovedParent = null;

        while (parent !== null) {
          const children = parent.getChildren();
          const childrenLength = children.length;
          if (childrenLength === 0 || children[childrenLength - 1].is(lastRemovedParent)) {
            markedNodeKeysForKeep.delete(parent.__key);
            lastRemovedParent = parent;
          }
          parent = parent.getParent();
        }
      }

      // Ensure we do splicing after moving of nodes, as splicing
      // can have side-effects (in the case of hashtags).
      if (!$isTokenOrTab(firstNode)) {
        firstNode = firstNode.spliceText(
          startOffset,
          firstNodeTextLength - startOffset,
          text,
          true,
        );
        if (firstNode.getTextContent() === '') {
          firstNode.remove();
        } else if (firstNode.isComposing() && this.anchor.type === 'text') {
          // When composing, we need to adjust the anchor offset so that
          // we correctly replace that right range.
          this.anchor.offset -= text.length;
        }
      } else if (startOffset === firstNodeTextLength) {
        firstNode.select();
      } else {
        const textNode = $createTextNode(text);
        textNode.select();
        firstNode.replace(textNode);
      }

      // Remove all selected nodes that haven't already been removed.
      for (let i = 1; i < selectedNodesLength; i++) {
        const selectedNode = selectedNodes[i];
        const key = selectedNode.__key;
        if (!markedNodeKeysForKeep.has(key)) {
          selectedNode.remove();
        }
      }
    }
  }

  /**
   * Removes the text in the Selection, adjusting the EditorState accordingly.
   */
  removeText(): void {
    const isCurrentSelection = $getSelection() === this;
    const newRange = $removeTextFromCaretRange($caretRangeFromSelection(this));
    $updateRangeSelectionFromCaretRange(this, newRange);
    if (isCurrentSelection && $getSelection() !== this) {
      $setSelection(this);
    }
  }

  // TO-DO: Migrate this method to the new utility function $forEachSelectedTextNode (share similar logic)
  /**
   * Applies the provided format to the TextNodes in the Selection, splitting or
   * merging nodes as necessary.
   *
   * @param formatType the format type to apply to the nodes in the Selection.
   * @param alignWithFormat a 32-bit integer representing formatting flags to align with.
   */
  formatText(formatType: TextFormatType, alignWithFormat: number | null = null): void {
    if (this.isCollapsed()) {
      this.toggleFormat(formatType);
      // When changing format, we should stop composition
      $setCompositionKey(null);
      return;
    }

    const selectedNodes = this.getNodes();
    const selectedTextNodes: Array<TextNode> = [];
    for (const selectedNode of selectedNodes) {
      if ($isTextNode(selectedNode)) {
        selectedTextNodes.push(selectedNode);
      }
    }
    const applyFormatToElements = (alignWith: number | null) => {
      selectedNodes.forEach((node) => {
        if ($isElementNode(node)) {
          const newFormat = node.getFormatFlags(formatType, alignWith);
          node.setTextFormat(newFormat);
        }
      });
    };

    const selectedTextNodesLength = selectedTextNodes.length;
    if (selectedTextNodesLength === 0) {
      this.toggleFormat(formatType);
      // When changing format, we should stop composition
      $setCompositionKey(null);
      applyFormatToElements(alignWithFormat);
      return;
    }

    const anchor = this.anchor;
    const focus = this.focus;
    const isBackward = this.isBackward();
    const startPoint = isBackward ? focus : anchor;
    const endPoint = isBackward ? anchor : focus;

    let firstIndex = 0;
    let firstNode = selectedTextNodes[0];
    let startOffset = startPoint.type === 'element' ? 0 : startPoint.offset;

    // In case selection started at the end of text node use next text node
    if (startPoint.type === 'text' && startOffset === firstNode.getTextContentSize()) {
      firstIndex = 1;
      firstNode = selectedTextNodes[1];
      startOffset = 0;
    }

    if (firstNode == null) {
      return;
    }

    const firstNextFormat = firstNode.getFormatFlags(formatType, alignWithFormat);
    applyFormatToElements(firstNextFormat);

    const lastIndex = selectedTextNodesLength - 1;
    let lastNode = selectedTextNodes[lastIndex];
    const endOffset = endPoint.type === 'text' ? endPoint.offset : lastNode.getTextContentSize();

    // Single node selected
    if (firstNode.is(lastNode)) {
      // No actual text is selected, so do nothing.
      if (startOffset === endOffset) {
        return;
      }
      // The entire node is selected or it is token, so just format it
      if (
        $isTokenOrSegmented(firstNode) ||
        (startOffset === 0 && endOffset === firstNode.getTextContentSize())
      ) {
        firstNode.setFormat(firstNextFormat);
      } else {
        // Node is partially selected, so split it into two nodes
        // add style the selected one.
        const splitNodes = firstNode.splitText(startOffset, endOffset);
        const replacement = startOffset === 0 ? splitNodes[0] : splitNodes[1];
        replacement.setFormat(firstNextFormat);

        // Update selection only if starts/ends on text node
        if (startPoint.type === 'text') {
          startPoint.set(replacement.__key, 0, 'text');
        }
        if (endPoint.type === 'text') {
          endPoint.set(replacement.__key, endOffset - startOffset, 'text');
        }
      }

      this.format = firstNextFormat;

      return;
    }
    // Multiple nodes selected
    // The entire first node isn't selected, so split it
    if (startOffset !== 0 && !$isTokenOrSegmented(firstNode)) {
      [, firstNode] = firstNode.splitText(startOffset);
      startOffset = 0;
    }
    firstNode.setFormat(firstNextFormat);

    const lastNextFormat = lastNode.getFormatFlags(formatType, firstNextFormat);
    // If the offset is 0, it means no actual characters are selected,
    // so we skip formatting the last node altogether.
    if (endOffset > 0) {
      if (endOffset !== lastNode.getTextContentSize() && !$isTokenOrSegmented(lastNode)) {
        [lastNode] = lastNode.splitText(endOffset);
      }
      lastNode.setFormat(lastNextFormat);
    }

    // Process all text nodes in between
    for (let i = firstIndex + 1; i < lastIndex; i++) {
      const textNode = selectedTextNodes[i];
      const nextFormat = textNode.getFormatFlags(formatType, lastNextFormat);
      textNode.setFormat(nextFormat);
    }

    // Update selection only if starts/ends on text node
    if (startPoint.type === 'text') {
      startPoint.set(firstNode.__key, startOffset, 'text');
    }
    if (endPoint.type === 'text') {
      endPoint.set(lastNode.__key, endOffset, 'text');
    }

    this.format = firstNextFormat | lastNextFormat;
  }

  /**
   * Attempts to "intelligently" insert an arbitrary list of Lexical nodes into the EditorState at the
   * current Selection according to a set of heuristics that determine how surrounding nodes
   * should be changed, replaced, or moved to accommodate the incoming ones.
   *
   * @param nodes - the nodes to insert
   */
  insertNodes(nodes: Array<LexicalNode>): void {
    if (nodes.length === 0) {
      return;
    }
    if (!this.isCollapsed()) {
      this.removeText();
    }
    if (this.anchor.key === 'root') {
      this.insertParagraph();
      const selection = $getSelection();
      invariant($isRangeSelection(selection), 'Expected RangeSelection after insertParagraph');
      return selection.insertNodes(nodes);
    }

    const firstPoint = this.isBackward() ? this.focus : this.anchor;
    const firstNode = firstPoint.getNode();
    const firstBlock = $getAncestor(firstNode, INTERNAL_$isBlock);

    const last = nodes[nodes.length - 1]!;

    // CASE 1: insert inside a code block
    if ($isElementNode(firstBlock) && '__language' in firstBlock) {
      if ('__language' in nodes[0]) {
        this.insertText(nodes[0].getTextContent());
      } else {
        const index = $removeTextAndSplitBlock(this);
        firstBlock.splice(index, 0, nodes);
        last.selectEnd();
      }
      return;
    }

    // CASE 2: All elements of the array are inline
    const notInline = (node: LexicalNode) =>
      ($isElementNode(node) || $isDecoratorNode(node)) && !node.isInline();

    if (!nodes.some(notInline)) {
      invariant(
        $isElementNode(firstBlock),
        'Expected node %s of type %s to have a block ElementNode ancestor',
        firstNode.constructor.name,
        firstNode.getType(),
      );
      const index = $removeTextAndSplitBlock(this);
      firstBlock.splice(index, 0, nodes);
      last.selectEnd();
      return;
    }

    // CASE 3: At least 1 element of the array is not inline
    const blocksParent = $wrapInlineNodes(nodes);
    const nodeToSelect = blocksParent.getLastDescendant()!;
    const blocks = blocksParent.getChildren();
    const isMergeable = (node: LexicalNode): node is ElementNode =>
      $isElementNode(node) &&
      INTERNAL_$isBlock(node) &&
      !node.isEmpty() &&
      $isElementNode(firstBlock) &&
      (!firstBlock.isEmpty() || firstBlock.canMergeWhenEmpty());

    const shouldInsert = !$isElementNode(firstBlock) || !firstBlock.isEmpty();
    const insertedParagraph = shouldInsert ? this.insertParagraph() : null;
    const lastToInsert: LexicalNode | undefined = blocks[blocks.length - 1];
    let firstToInsert: LexicalNode | undefined = blocks[0];
    if (isMergeable(firstToInsert)) {
      invariant(
        $isElementNode(firstBlock),
        'Expected node %s of type %s to have a block ElementNode ancestor',
        firstNode.constructor.name,
        firstNode.getType(),
      );
      firstBlock.append(...firstToInsert.getChildren());
      firstToInsert = blocks[1];
    }
    if (firstToInsert) {
      invariant(
        firstBlock !== null,
        'Expected node %s of type %s to have a block ancestor',
        firstNode.constructor.name,
        firstNode.getType(),
      );
      insertRangeAfter(firstBlock, firstToInsert);
    }
    const lastInsertedBlock = $getAncestor(nodeToSelect, INTERNAL_$isBlock);

    if (
      insertedParagraph &&
      $isElementNode(lastInsertedBlock) &&
      (insertedParagraph.canMergeWhenEmpty() || INTERNAL_$isBlock(lastToInsert))
    ) {
      lastInsertedBlock.append(...insertedParagraph.getChildren());
      insertedParagraph.remove();
    }
    if ($isElementNode(firstBlock) && firstBlock.isEmpty()) {
      firstBlock.remove();
    }

    nodeToSelect.selectEnd();

    // To understand this take a look at the test "can wrap post-linebreak nodes into new element"
    const lastChild = $isElementNode(firstBlock) ? firstBlock.getLastChild() : null;
    if ($isLineBreakNode(lastChild) && lastInsertedBlock !== firstBlock) {
      lastChild.remove();
    }
  }

  /**
   * Inserts a new ParagraphNode into the EditorState at the current Selection
   *
   * @returns the newly inserted node.
   */
  insertParagraph(): ElementNode | null {
    if (this.anchor.key === 'root') {
      const paragraph = $createParagraphNode();
      $getRoot().splice(this.anchor.offset, 0, [paragraph]);
      paragraph.select();
      return paragraph;
    }
    const index = $removeTextAndSplitBlock(this);
    const block = $getAncestor(this.anchor.getNode(), INTERNAL_$isBlock);
    invariant($isElementNode(block), 'Expected ancestor to be a block ElementNode');
    const firstToAppend = block.getChildAtIndex(index);
    const nodesToInsert = firstToAppend ? [firstToAppend, ...firstToAppend.getNextSiblings()] : [];
    const newBlock = block.insertNewAfter(this, false) as ElementNode | null;
    if (newBlock) {
      newBlock.append(...nodesToInsert);
      newBlock.selectStart();
      return newBlock;
    }
    // if newBlock is null, it means that block is of type CodeNode.
    return null;
  }

  /**
   * Inserts a logical linebreak, which may be a new LineBreakNode or a new ParagraphNode, into the EditorState at the
   * current Selection.
   */
  insertLineBreak(selectStart?: boolean): void {
    const lineBreak = $createLineBreakNode();
    this.insertNodes([lineBreak]);
    // this is used in MacOS with the command 'ctrl-O' (openLineBreak)
    if (selectStart) {
      const parent = lineBreak.getParentOrThrow();
      const index = lineBreak.getIndexWithinParent();
      parent.select(index, index);
    }
  }

  /**
   * Extracts the nodes in the Selection, splitting nodes where necessary
   * to get offset-level precision.
   *
   * @returns The nodes in the Selection
   */
  extract(): Array<LexicalNode> {
    const selectedNodes = this.getNodes();
    const selectedNodesLength = selectedNodes.length;
    const lastIndex = selectedNodesLength - 1;
    const anchor = this.anchor;
    const focus = this.focus;
    let firstNode = selectedNodes[0];
    let lastNode = selectedNodes[lastIndex];
    const [anchorOffset, focusOffset] = $getCharacterOffsets(this);

    if (selectedNodesLength === 0) {
      return [];
    } else if (selectedNodesLength === 1) {
      if ($isTextNode(firstNode) && !this.isCollapsed()) {
        const startOffset = anchorOffset > focusOffset ? focusOffset : anchorOffset;
        const endOffset = anchorOffset > focusOffset ? anchorOffset : focusOffset;
        const splitNodes = firstNode.splitText(startOffset, endOffset);
        const node = startOffset === 0 ? splitNodes[0] : splitNodes[1];
        return node != null ? [node] : [];
      }
      return [firstNode];
    }
    const isBefore = anchor.isBefore(focus);

    if ($isTextNode(firstNode)) {
      const startOffset = isBefore ? anchorOffset : focusOffset;
      if (startOffset === firstNode.getTextContentSize()) {
        selectedNodes.shift();
      } else if (startOffset !== 0) {
        [, firstNode] = firstNode.splitText(startOffset);
        selectedNodes[0] = firstNode;
      }
    }
    if ($isTextNode(lastNode)) {
      const lastNodeText = lastNode.getTextContent();
      const lastNodeTextLength = lastNodeText.length;
      const endOffset = isBefore ? focusOffset : anchorOffset;
      if (endOffset === 0) {
        selectedNodes.pop();
      } else if (endOffset !== lastNodeTextLength) {
        [lastNode] = lastNode.splitText(endOffset);
        selectedNodes[lastIndex] = lastNode;
      }
    }
    return selectedNodes;
  }

  /**
   * Modifies the Selection according to the parameters and a set of heuristics that account for
   * various node types. Can be used to safely move or extend selection by one logical "unit" without
   * dealing explicitly with all the possible node types.
   *
   * @param alter the type of modification to perform
   * @param isBackward whether or not selection is backwards
   * @param granularity the granularity at which to apply the modification
   */
  modify(
    alter: 'move' | 'extend',
    isBackward: boolean,
    granularity: 'character' | 'word' | 'lineboundary',
  ): void {
    if ($modifySelectionAroundDecoratorsAndBlocks(this, alter, isBackward, granularity)) {
      return;
    }
    const collapse = alter === 'move';

    const editor = getActiveEditor();
    const domSelection = getDOMSelection(getWindow(editor));

    if (!domSelection) {
      return;
    }
    const blockCursorElement = editor._blockCursorElement;
    const rootElement = editor._rootElement;
    const focusNode = this.focus.getNode();
    // Remove the block cursor element if it exists. This will ensure selection
    // works as intended. If we leave it in the DOM all sorts of strange bugs
    // occur. :/
    if (
      rootElement !== null &&
      blockCursorElement !== null &&
      $isElementNode(focusNode) &&
      !focusNode.isInline() &&
      !focusNode.canBeEmpty()
    ) {
      removeDOMBlockCursorElement(blockCursorElement, editor, rootElement);
    }
    if (this.dirty) {
      let nextAnchorDOM: HTMLElement | Text | null = getElementByKeyOrThrow(
        editor,
        this.anchor.key,
      );
      let nextFocusDOM: HTMLElement | Text | null = getElementByKeyOrThrow(editor, this.focus.key);
      if (this.anchor.type === 'text') {
        nextAnchorDOM = getDOMTextNode(nextAnchorDOM);
      }
      if (this.focus.type === 'text') {
        nextFocusDOM = getDOMTextNode(nextFocusDOM);
      }
      if (nextAnchorDOM && nextFocusDOM) {
        setDOMSelectionBaseAndExtent(
          domSelection,
          nextAnchorDOM,
          this.anchor.offset,
          nextFocusDOM,
          this.focus.offset,
        );
      }
    }
    // We use the DOM selection.modify API here to "tell" us what the selection
    // will be. We then use it to update the Lexical selection accordingly. This
    // is much more reliable than waiting for a beforeinput and using the ranges
    // from getTargetRanges(), and is also better than trying to do it ourselves
    // using Intl.Segmenter or other workarounds that struggle with word segments
    // and line segments (especially with word wrapping and non-Roman languages).
    moveNativeSelection(domSelection, alter, isBackward ? 'backward' : 'forward', granularity);
    // Guard against no ranges
    if (domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      // Apply the DOM selection to our Lexical selection.
      const anchorNode = this.anchor.getNode();
      const root = $isRootNode(anchorNode) ? anchorNode : $getNearestRootOrShadowRoot(anchorNode);
      this.applyDOMRange(range);
      this.dirty = true;
      if (!collapse) {
        // Validate selection; make sure that the new extended selection respects shadow roots
        const nodes = this.getNodes();
        const validNodes = [];
        let shrinkSelection = false;
        for (let i = 0; i < nodes.length; i++) {
          const nextNode = nodes[i];
          if ($hasAncestor(nextNode, root)) {
            validNodes.push(nextNode);
          } else {
            shrinkSelection = true;
          }
        }
        if (shrinkSelection && validNodes.length > 0) {
          // validNodes length check is a safeguard against an invalid selection; as getNodes()
          // will return an empty array in this case
          if (isBackward) {
            const firstValidNode = validNodes[0];
            if ($isElementNode(firstValidNode)) {
              firstValidNode.selectStart();
            } else {
              firstValidNode.getParentOrThrow().selectStart();
            }
          } else {
            const lastValidNode = validNodes[validNodes.length - 1];
            if ($isElementNode(lastValidNode)) {
              lastValidNode.selectEnd();
            } else {
              lastValidNode.getParentOrThrow().selectEnd();
            }
          }
        }

        // Because a range works on start and end, we might need to flip
        // the anchor and focus points to match what the DOM has, not what
        // the range has specifically.
        if (
          domSelection.anchorNode !== range.startContainer ||
          domSelection.anchorOffset !== range.startOffset
        ) {
          $swapPoints(this);
        }
      }
    }
    if (granularity === 'lineboundary') {
      $modifySelectionAroundDecoratorsAndBlocks(this, alter, isBackward, granularity, 'decorators');
    }
  }
  /**
   * Helper for handling forward character and word deletion that prevents element nodes
   * like a table, columns layout being destroyed
   *
   * @param anchor the anchor
   * @param anchorNode the anchor node in the selection
   * @param isBackward whether or not selection is backwards
   */
  forwardDeletion(
    anchor: PointType,
    anchorNode: TextNode | ElementNode,
    isBackward: boolean,
  ): boolean {
    if (
      !isBackward &&
      // Delete forward handle case
      ((anchor.type === 'element' &&
        $isElementNode(anchorNode) &&
        anchor.offset === anchorNode.getChildrenSize()) ||
        (anchor.type === 'text' && anchor.offset === anchorNode.getTextContentSize()))
    ) {
      const parent = anchorNode.getParent();
      const nextSibling =
        anchorNode.getNextSibling() || (parent === null ? null : parent.getNextSibling());

      if ($isElementNode(nextSibling) && nextSibling.isShadowRoot()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Performs one logical character deletion operation on the EditorState based on the current Selection.
   * Handles different node types.
   *
   * @param isBackward whether or not the selection is backwards.
   */
  deleteCharacter(isBackward: boolean): void {
    const wasCollapsed = this.isCollapsed();
    if (this.isCollapsed()) {
      const anchor = this.anchor;
      let anchorNode: TextNode | ElementNode | null = anchor.getNode();
      if (this.forwardDeletion(anchor, anchorNode, isBackward)) {
        return;
      }
      const direction = isBackward ? 'previous' : 'next';
      const initialCaret = $caretFromPoint(anchor, direction);
      const initialRange = $extendCaretToRange(initialCaret);
      if (initialRange.getTextSlices().every((slice) => slice === null || slice.distance === 0)) {
        // There's no text in the direction of the deletion so we can explore our options
        let state:
          | { type: 'initial' }
          | {
              type: 'merge-next-block';
              block: ElementNode;
            }
          | {
              type: 'merge-block';
              caret: ChildCaret<ElementNode, typeof direction>;
              block: ElementNode;
            } = { type: 'initial' };
        for (const caret of initialRange.iterNodeCarets('shadowRoot')) {
          if ($isChildCaret(caret)) {
            if (caret.origin.isInline()) {
              // fall through when descending an inline
            } else if (caret.origin.isShadowRoot()) {
              if (state.type === 'merge-block') {
                break;
              }
              // Don't merge with a shadow root block
              if (
                $isElementNode(initialRange.anchor.origin) &&
                initialRange.anchor.origin.isEmpty()
              ) {
                // delete an empty paragraph like the DecoratorNode case
                const normCaret = $normalizeCaret(caret);
                $updateRangeSelectionFromCaretRange(this, $getCaretRange(normCaret, normCaret));
                initialRange.anchor.origin.remove();
              }
              return;
            } else if (state.type === 'merge-next-block' || state.type === 'merge-block') {
              // Keep descending ChildCaret to find which block to merge with
              state = { block: state.block, caret, type: 'merge-block' };
            }
          } else if (state.type === 'merge-block') {
            break;
          } else if ($isSiblingCaret(caret)) {
            if ($isElementNode(caret.origin)) {
              if (!caret.origin.isInline()) {
                state = { block: caret.origin, type: 'merge-next-block' };
              } else if (!caret.origin.isParentOf(initialRange.anchor.origin)) {
                break;
              }
              continue;
            } else if ($isDecoratorNode(caret.origin)) {
              if (caret.origin.isIsolated()) {
                // do nothing, shouldn't delete an isolated decorator
              } else if (
                state.type === 'merge-next-block' &&
                (caret.origin.isKeyboardSelectable() || !caret.origin.isInline()) &&
                $isElementNode(initialRange.anchor.origin) &&
                initialRange.anchor.origin.isEmpty()
              ) {
                // If the anchor is an empty element that is adjacent to a
                // decorator then we remove the paragraph and select the
                // decorator
                initialRange.anchor.origin.remove();
                const nodeSelection = $createNodeSelection();
                nodeSelection.add(caret.origin.getKey());
                $setSelection(nodeSelection);
              } else {
                // When the anchor is not an empty element then the
                // adjacent decorator is removed
                caret.origin.remove();
              }
              // always stop when a decorator is encountered
              return;
            }
            break;
          }
        }
        if (state.type === 'merge-block') {
          const { caret, block } = state;
          $updateRangeSelectionFromCaretRange(
            this,
            $getCaretRange(
              !caret.origin.isEmpty() && block.isEmpty()
                ? $rewindSiblingCaret($getSiblingCaret(block, caret.direction))
                : initialRange.anchor,
              caret,
            ),
          );
          return this.removeText();
        }
      }

      // Handle the deletion around decorators.
      const focus = this.focus;
      this.modify('extend', isBackward, 'character');

      if (!this.isCollapsed()) {
        const focusNode = focus.type === 'text' ? focus.getNode() : null;
        anchorNode = anchor.type === 'text' ? anchor.getNode() : null;

        if (focusNode !== null && focusNode.isSegmented()) {
          const offset = focus.offset;
          const textContentSize = focusNode.getTextContentSize();
          if (
            focusNode.is(anchorNode) ||
            (isBackward && offset !== textContentSize) ||
            (!isBackward && offset !== 0)
          ) {
            $removeSegment(focusNode, isBackward, offset);
            return;
          }
        } else if (anchorNode !== null && anchorNode.isSegmented()) {
          const offset = anchor.offset;
          const textContentSize = anchorNode.getTextContentSize();
          if (
            anchorNode.is(focusNode) ||
            (isBackward && offset !== 0) ||
            (!isBackward && offset !== textContentSize)
          ) {
            $removeSegment(anchorNode, isBackward, offset);
            return;
          }
        }
        $updateCaretSelectionForUnicodeCharacter(this, isBackward);
      } else if (isBackward && anchor.offset === 0) {
        // Special handling around rich text nodes
        if ($collapseAtStart(this, anchor.getNode())) {
          return;
        }
      }
    }
    this.removeText();
    if (
      isBackward &&
      !wasCollapsed &&
      this.isCollapsed() &&
      this.anchor.type === 'element' &&
      this.anchor.offset === 0
    ) {
      const anchorNode = this.anchor.getNode();
      if (
        anchorNode.isEmpty() &&
        $isRootNode(anchorNode.getParent()) &&
        anchorNode.getPreviousSibling() === null
      ) {
        $collapseAtStart(this, anchorNode);
      }
    }
  }

  /**
   * Performs one logical line deletion operation on the EditorState based on the current Selection.
   * Handles different node types.
   *
   * @param isBackward whether or not the selection is backwards.
   */
  deleteLine(isBackward: boolean): void {
    if (this.isCollapsed()) {
      this.modify('extend', isBackward, 'lineboundary');
    }
    if (this.isCollapsed()) {
      // If the selection was already collapsed at the lineboundary,
      // use the deleteCharacter operation to handle all of the logic associated
      // with navigating through the parent element
      this.deleteCharacter(isBackward);
    } else {
      this.removeText();
    }
  }

  /**
   * Performs one logical word deletion operation on the EditorState based on the current Selection.
   * Handles different node types.
   *
   * @param isBackward whether or not the selection is backwards.
   */
  deleteWord(isBackward: boolean): void {
    if (this.isCollapsed()) {
      const anchor = this.anchor;
      const anchorNode: TextNode | ElementNode | null = anchor.getNode();
      if (this.forwardDeletion(anchor, anchorNode, isBackward)) {
        return;
      }
      this.modify('extend', isBackward, 'word');
    }
    this.removeText();
  }

  /**
   * Returns whether the Selection is "backwards", meaning the focus
   * logically precedes the anchor in the EditorState.
   * @returns true if the Selection is backwards, false otherwise.
   */
  isBackward(): boolean {
    return this.focus.isBefore(this.anchor);
  }

  getStartEndPoints(): null | [PointType, PointType] {
    return [this.anchor, this.focus];
  }
}

export function $isNodeSelection(x: unknown): x is NodeSelection {
  return x instanceof NodeSelection;
}

function getCharacterOffset(point: PointType): number {
  const offset = point.offset;
  if (point.type === 'text') {
    return offset;
  }

  const parent = point.getNode();
  return offset === parent.getChildrenSize() ? parent.getTextContent().length : 0;
}

export function $getCharacterOffsets(selection: BaseSelection): [number, number] {
  const anchorAndFocus = selection.getStartEndPoints();
  if (anchorAndFocus === null) {
    return [0, 0];
  }
  const [anchor, focus] = anchorAndFocus;
  if (
    anchor.type === 'element' &&
    focus.type === 'element' &&
    anchor.key === focus.key &&
    anchor.offset === focus.offset
  ) {
    return [0, 0];
  }
  return [getCharacterOffset(anchor), getCharacterOffset(focus)];
}

function $collapseAtStart(selection: RangeSelection, startNode: LexicalNode): boolean {
  for (let node: null | LexicalNode = startNode; node; node = node.getParent()) {
    if ($isElementNode(node)) {
      if (node.collapseAtStart(selection)) {
        return true;
      }
      if ($isRootOrShadowRoot(node)) {
        break;
      }
    }
    if (node.getPreviousSibling()) {
      break;
    }
  }
  return false;
}

function $swapPoints(selection: RangeSelection): void {
  const focus = selection.focus;
  const anchor = selection.anchor;
  const anchorKey = anchor.key;
  const anchorOffset = anchor.offset;
  const anchorType = anchor.type;

  anchor.set(focus.key, focus.offset, focus.type, true);
  focus.set(anchorKey, anchorOffset, anchorType, true);
}

function moveNativeSelection(
  domSelection: Selection,
  alter: 'move' | 'extend',
  direction: 'backward' | 'forward' | 'left' | 'right',
  granularity: 'character' | 'word' | 'lineboundary',
): void {
  // Selection.modify() method applies a change to the current selection or cursor position,
  // but is still non-standard in some browsers.
  domSelection.modify(alter, direction, granularity);
}

/**
 * Called by `RangeSelection.deleteCharacter` to determine if
 * `this.modify('extend', isBackward, 'character')` extended the selection
 * further than a user would expect for that operation.
 *
 * A short(?) JavaScript string vs. Unicode primer:
 *
 * Strings in JavaScript use an UTF-16 encoding, and the offsets into a
 * string are based on those UTF-16 *code units*. This is basically a
 * historical mistake (though logical at that time, decades ago), but
 * can never really be fixed for compatibility reasons.
 *
 * In Unicode, a *code point* is the combination of one or more *code units*.
 * and the range of a *code point* can fit into 21 bits.
 *
 * Every valid *code point* can be represented with one or two
 * *UTF-16 code units*. One unit is used when the code point is in the
 * Basic Multilingual Plane (BMP) and is `< 0xFFFF`. Anything outside
 * of that plane is encoded with a *surrogate pair* of *code units* and
 * `/[\uD800-\uDBFF][\uDC00-\uDFFF]/` is a regex that you could use to
 * find any valid *surrogate pair*. As far as Unicode is concerned, these
 * pairs represent a single *code point*, but in JavaScript, these pairs
 * have a length of 2 (`pair.charCodeAt(n)` is really returning a
 * UTF-16 *code unit*, not a unicode *code point*). It is possible to request
 * a *code point* with `pair.codePointAt(0)` and enumerate code points
 * in a string with `[...string]` but the offsets we work with, and
 * the string length, are based in *code units* so that functionality
 * is unfortunately not very useful here.
 *
 * This only gets us as far as *code points*. We now know that we must
 * consider that each *code point* can have a length of 1 or 2 in JavaScript
 * string distance. It gets even trickier because the visual representation
 * of a character is a *grapheme* (approximately what the user thinks of
 * as a character). A *grapheme* is one or more *code points*, and can
 * essentially be arbitrarily long, as there are many ways to combine
 * them.
 *
 * The `this.modify(…)` call has already extended our selection by one
 * *grapheme* in the direction we want to delete. Sounds great, it's done
 * a lot of awfully tricky work for us because this functionality has only
 * recently become available in JavaScript via `Intl.Segmenter`. The
 * problem is that in many cases the expected behavior of backspace or
 * delete is *not always to delete a whole grapheme*. In some languages
 * it's always expected that backspace ought to delete one code point, not the
 * whole grapheme. In other situations such as emoji that use variation
 * selectors you *do* want to delete the whole *grapheme*.
 *
 * In a few situations the behavior is even application dependent, such as
 * with latin languages where you have multiple ways to represent the same
 * character visually (e.g. a letter with an accent in one code point, or a
 * letter followed by a combining mark in a second code point); some apps will
 * delete the whole grapheme and others will delete only the combining mark,
 * probably based on whether they perform some sort of *normalization* on their
 * input to ensure that only one form is used when two sequences of code points
 * can represent the same visual character. Lexical currently chooses not
 * to perform any normalization so this type of combining marks will be
 * deleted as a *code point* without deleting the whole *grapheme*.
 *
 * See also:
 * https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-2/#G25564
 * https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-3/#G30602
 * https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-3/#G49537
 * https://mathiasbynens.be/notes/javascript-unicode
 */
function $updateCaretSelectionForUnicodeCharacter(
  selection: RangeSelection,
  isBackward: boolean,
): void {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = anchor.getNode();
  const focusNode = focus.getNode();

  if (anchorNode === focusNode && anchor.type === 'text' && focus.type === 'text') {
    // Handling of multibyte characters
    const anchorOffset = anchor.offset;
    const focusOffset = focus.offset;
    const isBefore = anchorOffset < focusOffset;
    const startOffset = isBefore ? anchorOffset : focusOffset;
    const endOffset = isBefore ? focusOffset : anchorOffset;
    const characterOffset = endOffset - 1;

    if (startOffset !== characterOffset) {
      const text = anchorNode.getTextContent().slice(startOffset, endOffset);
      if (shouldDeleteExactlyOneCodeUnit(text)) {
        if (isBackward) {
          focus.set(focus.key, characterOffset, focus.type);
        } else {
          anchor.set(anchor.key, characterOffset, anchor.type);
        }
      }
    }
  }
}

function shouldDeleteExactlyOneCodeUnit(text: string) {
  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    invariant(
      text.length > 1,
      'shouldDeleteExactlyOneCodeUnit: expecting to be called only with sequences of two or more code units',
    );
  }
  return !(doesContainSurrogatePair(text) || doesContainEmoji(text));
}

/**
 * Given the wall of text in $updateCaretSelectionForUnicodeCharacter, you'd
 * think that the solution might be complex, but the only currently known
 * cases given the above constraints where we want to delete a whole grapheme
 * are when emoji is involved. Since ES6 we can use unicode character classes
 * in regexp which makes this simple.
 *
 * It may make sense to add to this heuristic in the future if other
 * edge cases are discovered, which is why detailed notes remain.
 *
 * This is implemented with runtime feature detection and will always
 * return false on pre-2020 platforms that do not have unicode character
 * class support.
 */
const doesContainEmoji: (text: string) => boolean = (() => {
  try {
    const re = new RegExp('\\p{Emoji}', 'u');
    const test = re.test.bind(re);
    // Sanity check a few emoji to make sure the regexp was parsed
    // and works correctly. Any one of these should be sufficient,
    // but they're cheap and it only runs once.
    if (
      // Emoji in the BMP (heart) with variation selector
      test('\u2764\ufe0f') &&
      // Emoji in the BMP (#) with variation selector
      test('#\ufe0f\u20e3') &&
      // Emoji outside the BMP (thumbs up) that is encoded with a surrogate pair
      test('\ud83d\udc4d')
    ) {
      return test;
    }
  } catch (error) {
    // SyntaxError
  }
  // fallback, surrogate pair already checked
  return () => false;
})();

function $removeSegment(node: TextNode, isBackward: boolean, offset: number): void {
  const textNode = node;
  const textContent = textNode.getTextContent();
  const split = textContent.split(/(?=\s)/g);
  const splitLength = split.length;
  let segmentOffset = 0;
  let restoreOffset: number | undefined = 0;

  for (let i = 0; i < splitLength; i++) {
    const text = split[i];
    const isLast = i === splitLength - 1;
    restoreOffset = segmentOffset;
    segmentOffset += text.length;

    if ((isBackward && segmentOffset === offset) || segmentOffset > offset || isLast) {
      split.splice(i, 1);
      if (isLast) {
        restoreOffset = undefined;
      }
      break;
    }
  }
  const nextTextContent = split.join('').trim();

  if (nextTextContent === '') {
    textNode.remove();
  } else {
    textNode.setTextContent(nextTextContent);
    textNode.select(restoreOffset, restoreOffset);
  }
}

function shouldResolveAncestor(
  resolvedElement: ElementNode,
  resolvedOffset: number,
  lastPoint: null | PointType,
): boolean {
  const parent = resolvedElement.getParent();
  return (
    lastPoint === null || parent === null || !parent.canBeEmpty() || parent !== lastPoint.getNode()
  );
}

function $internalResolveSelectionPoint(
  dom: Node,
  offset: number,
  lastPoint: null | PointType,
  editor: LexicalEditor,
): null | PointType {
  let resolvedOffset = offset;
  let resolvedNode: TextNode | LexicalNode | null;
  // If we have selection on an element, we will
  // need to figure out (using the offset) what text
  // node should be selected.

  if (isHTMLElement(dom)) {
    // Resolve element to a ElementNode, or TextNode, or null
    let moveSelectionToEnd = false;
    // Given we're moving selection to another node, selection is
    // definitely dirty.
    // We use the anchor to find which child node to select
    const childNodes = dom.childNodes;
    const childNodesLength = childNodes.length;
    const blockCursorElement = editor._blockCursorElement;
    // If the anchor is the same as length, then this means we
    // need to select the very last text node.
    if (resolvedOffset === childNodesLength) {
      moveSelectionToEnd = true;
      resolvedOffset = childNodesLength - 1;
    }
    let childDOM = childNodes[resolvedOffset];
    let hasBlockCursor = false;
    if (childDOM === blockCursorElement) {
      childDOM = childNodes[resolvedOffset + 1];
      hasBlockCursor = true;
    } else if (blockCursorElement !== null) {
      const blockCursorElementParent = blockCursorElement.parentNode;
      if (dom === blockCursorElementParent) {
        const blockCursorOffset = Array.prototype.indexOf.call(
          blockCursorElementParent.children,
          blockCursorElement,
        );
        if (offset > blockCursorOffset) {
          resolvedOffset--;
        }
      }
    }
    resolvedNode = $getNodeFromDOM(childDOM);

    if ($isTextNode(resolvedNode)) {
      resolvedOffset = $getTextNodeOffset(resolvedNode, moveSelectionToEnd ? 'next' : 'previous');
    } else {
      let resolvedElement = $getNodeFromDOM(dom);
      // Ensure resolvedElement is actually a element.
      if (resolvedElement === null) {
        return null;
      }
      if ($isElementNode(resolvedElement)) {
        const elementDOM = editor.getElementByKey(resolvedElement.getKey());
        invariant(
          elementDOM !== null,
          '$internalResolveSelectionPoint: node in DOM but not keyToDOMMap',
        );
        const slot = resolvedElement.getDOMSlot(elementDOM);
        [resolvedElement, resolvedOffset] = slot.resolveChildIndex(
          resolvedElement,
          elementDOM,
          dom,
          offset,
        );
        // This is just a typescript workaround, it is true but lost due to mutability
        invariant(
          $isElementNode(resolvedElement),
          '$internalResolveSelectionPoint: resolvedElement is not an ElementNode',
        );
        if (moveSelectionToEnd && resolvedOffset >= resolvedElement.getChildrenSize()) {
          resolvedOffset = Math.max(0, resolvedElement.getChildrenSize() - 1);
        }
        let child = resolvedElement.getChildAtIndex(resolvedOffset);
        if ($isElementNode(child) && shouldResolveAncestor(child, resolvedOffset, lastPoint)) {
          const descendant = moveSelectionToEnd
            ? child.getLastDescendant()
            : child.getFirstDescendant();
          if (descendant === null) {
            resolvedElement = child;
          } else {
            child = descendant;
            resolvedElement = $isElementNode(child) ? child : child.getParentOrThrow();
          }
          resolvedOffset = 0;
        }
        if ($isTextNode(child)) {
          resolvedNode = child;
          resolvedElement = null;
          resolvedOffset = $getTextNodeOffset(child, moveSelectionToEnd ? 'next' : 'previous');
        } else if (child !== resolvedElement && moveSelectionToEnd && !hasBlockCursor) {
          invariant($isElementNode(resolvedElement), 'invariant');
          resolvedOffset = Math.min(resolvedElement.getChildrenSize(), resolvedOffset + 1);
        }
      } else {
        const index = resolvedElement.getIndexWithinParent();
        // When selecting decorators, there can be some selection issues when using resolvedOffset,
        // and instead we should be checking if we're using the offset
        if (
          offset === 0 &&
          $isDecoratorNode(resolvedElement) &&
          $getNodeFromDOM(dom) === resolvedElement
        ) {
          resolvedOffset = index;
        } else {
          resolvedOffset = index + 1;
        }
        resolvedElement = resolvedElement.getParentOrThrow();
      }
      if ($isElementNode(resolvedElement)) {
        return $createPoint(resolvedElement.__key, resolvedOffset, 'element');
      }
    }
  } else {
    // TextNode or null
    resolvedNode = $getNodeFromDOM(dom);
  }
  if (!$isTextNode(resolvedNode)) {
    return null;
  }
  return $createPoint(
    resolvedNode.__key,
    $getTextNodeOffset(resolvedNode, resolvedOffset, 'clamp'),
    'text',
  );
}

function resolveSelectionPointOnBoundary(
  point: TextPointType,
  isBackward: boolean,
  isCollapsed: boolean,
): void {
  const offset = point.offset;
  const node = point.getNode();

  if (offset === 0) {
    const prevSibling = node.getPreviousSibling();
    const parent = node.getParent();

    if (!isBackward) {
      if ($isElementNode(prevSibling) && !isCollapsed && prevSibling.isInline()) {
        point.set(prevSibling.__key, prevSibling.getChildrenSize(), 'element');
      } else if ($isTextNode(prevSibling)) {
        point.set(prevSibling.__key, prevSibling.getTextContent().length, 'text');
      }
    } else if (
      (isCollapsed || !isBackward) &&
      prevSibling === null &&
      $isElementNode(parent) &&
      parent.isInline()
    ) {
      const parentSibling = parent.getPreviousSibling();
      if ($isTextNode(parentSibling)) {
        point.set(parentSibling.__key, parentSibling.getTextContent().length, 'text');
      }
    }
  } else if (offset === node.getTextContent().length) {
    const nextSibling = node.getNextSibling();
    const parent = node.getParent();

    if (isBackward && $isElementNode(nextSibling) && nextSibling.isInline()) {
      point.set(nextSibling.__key, 0, 'element');
    } else if (
      (isCollapsed || isBackward) &&
      nextSibling === null &&
      $isElementNode(parent) &&
      parent.isInline() &&
      !parent.canInsertTextAfter()
    ) {
      const parentSibling = parent.getNextSibling();
      if ($isTextNode(parentSibling)) {
        point.set(parentSibling.__key, 0, 'text');
      }
    }
  }
}

function $normalizeSelectionPointsForBoundaries(
  anchor: PointType,
  focus: PointType,
  lastSelection: null | BaseSelection,
): void {
  if (anchor.type === 'text' && focus.type === 'text') {
    const isBackward = anchor.isBefore(focus);
    const isCollapsed = anchor.is(focus);

    // Attempt to normalize the offset to the previous sibling if we're at the
    // start of a text node and the sibling is a text node or inline element.
    resolveSelectionPointOnBoundary(anchor, isBackward, isCollapsed);
    resolveSelectionPointOnBoundary(focus, !isBackward, isCollapsed);

    if (isCollapsed) {
      focus.set(anchor.key, anchor.offset, anchor.type);
    }
    const editor = getActiveEditor();

    if (
      editor.isComposing() &&
      editor._compositionKey !== anchor.key &&
      $isRangeSelection(lastSelection)
    ) {
      const lastAnchor = lastSelection.anchor;
      const lastFocus = lastSelection.focus;
      anchor.set(lastAnchor.key, lastAnchor.offset, lastAnchor.type, true);
      focus.set(lastFocus.key, lastFocus.offset, lastFocus.type, true);
    }
  }
}

function $internalResolveSelectionPoints(
  anchorDOM: null | Node,
  anchorOffset: number,
  focusDOM: null | Node,
  focusOffset: number,
  editor: LexicalEditor,
  lastSelection: null | BaseSelection,
): null | [PointType, PointType] {
  if (
    anchorDOM === null ||
    focusDOM === null ||
    !isSelectionWithinEditor(editor, anchorDOM, focusDOM)
  ) {
    return null;
  }
  const resolvedAnchorPoint = $internalResolveSelectionPoint(
    anchorDOM,
    anchorOffset,
    $isRangeSelection(lastSelection) ? lastSelection.anchor : null,
    editor,
  );
  if (resolvedAnchorPoint === null) {
    return null;
  }
  const resolvedFocusPoint = $internalResolveSelectionPoint(
    focusDOM,
    focusOffset,
    $isRangeSelection(lastSelection) ? lastSelection.focus : null,
    editor,
  );
  if (resolvedFocusPoint === null) {
    return null;
  }
  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    $validatePoint('anchor', resolvedAnchorPoint);
    $validatePoint('focus', resolvedFocusPoint);
  }
  if (resolvedAnchorPoint.type === 'element' && resolvedFocusPoint.type === 'element') {
    const anchorNode = $getNodeFromDOM(anchorDOM);
    const focusNode = $getNodeFromDOM(focusDOM);
    // Ensure if we're selecting the content of a decorator that we
    // return null for this point, as it's not in the controlled scope
    // of Lexical.
    if ($isDecoratorNode(anchorNode) && $isDecoratorNode(focusNode)) {
      return null;
    }
  }

  // Handle normalization of selection when it is at the boundaries.
  $normalizeSelectionPointsForBoundaries(resolvedAnchorPoint, resolvedFocusPoint, lastSelection);

  return [resolvedAnchorPoint, resolvedFocusPoint];
}

export function $isBlockElementNode(node: LexicalNode | null | undefined): node is ElementNode {
  return $isElementNode(node) && !node.isInline();
}

// This is used to make a selection when the existing
// selection is null, i.e. forcing selection on the editor
// when it current exists outside the editor.

export function $internalMakeRangeSelection(
  anchorKey: NodeKey,
  anchorOffset: number,
  focusKey: NodeKey,
  focusOffset: number,
  anchorType: 'text' | 'element',
  focusType: 'text' | 'element',
): RangeSelection {
  const editorState = getActiveEditorState();
  const selection = new RangeSelection(
    $createPoint(anchorKey, anchorOffset, anchorType),
    $createPoint(focusKey, focusOffset, focusType),
    0,
    '',
  );
  selection.dirty = true;
  editorState._selection = selection;
  return selection;
}

export function $createRangeSelection(): RangeSelection {
  const anchor = $createPoint('root', 0, 'element');
  const focus = $createPoint('root', 0, 'element');
  return new RangeSelection(anchor, focus, 0, '');
}

export function $createNodeSelection(): NodeSelection {
  return new NodeSelection(new Set());
}

export function $internalCreateSelection(
  editor: LexicalEditor,
  event: UIEvent | Event | null,
): null | BaseSelection {
  const currentEditorState = editor.getEditorState();
  const lastSelection = currentEditorState._selection;
  const domSelection = getDOMSelection(getWindow(editor));

  if ($isRangeSelection(lastSelection) || lastSelection == null) {
    return $internalCreateRangeSelection(lastSelection, domSelection, editor, event);
  }
  return lastSelection.clone();
}

export function $createRangeSelectionFromDom(
  domSelection: Selection | null,
  editor: LexicalEditor,
): null | RangeSelection {
  return $internalCreateRangeSelection(null, domSelection, editor, null);
}

export function $internalCreateRangeSelection(
  lastSelection: null | BaseSelection,
  domSelection: Selection | null,
  editor: LexicalEditor,
  event: UIEvent | Event | null,
): null | RangeSelection {
  const windowObj = editor._window;
  if (windowObj === null) {
    return null;
  }
  // When we create a selection, we try to use the previous
  // selection where possible, unless an actual user selection
  // change has occurred. When we do need to create a new selection
  // we validate we can have text nodes for both anchor and focus
  // nodes. If that holds true, we then return that selection
  // as a mutable object that we use for the editor state for this
  // update cycle. If a selection gets changed, and requires a
  // update to native DOM selection, it gets marked as "dirty".
  // If the selection changes, but matches with the existing
  // DOM selection, then we only need to sync it. Otherwise,
  // we generally bail out of doing an update to selection during
  // reconciliation unless there are dirty nodes that need
  // reconciling.

  const windowEvent = event || windowObj.event;
  const eventType = windowEvent ? windowEvent.type : undefined;
  const isSelectionChange = eventType === 'selectionchange';
  const useDOMSelection =
    !getIsProcessingMutations() &&
    (isSelectionChange ||
      eventType === 'beforeinput' ||
      eventType === 'compositionstart' ||
      eventType === 'compositionend' ||
      (eventType === 'click' && windowEvent && (windowEvent as InputEvent).detail === 3) ||
      eventType === 'drop' ||
      eventType === undefined);
  let anchorDOM, focusDOM, anchorOffset, focusOffset;

  if (!$isRangeSelection(lastSelection) || useDOMSelection) {
    if (domSelection === null) {
      return null;
    }
    anchorDOM = domSelection.anchorNode;
    focusDOM = domSelection.focusNode;
    anchorOffset = domSelection.anchorOffset;
    focusOffset = domSelection.focusOffset;
    if (
      isSelectionChange &&
      $isRangeSelection(lastSelection) &&
      !isSelectionWithinEditor(editor, anchorDOM, focusDOM)
    ) {
      return lastSelection.clone();
    }
  } else {
    return lastSelection.clone();
  }
  // Let's resolve the text nodes from the offsets and DOM nodes we have from
  // native selection.
  const resolvedSelectionPoints = $internalResolveSelectionPoints(
    anchorDOM,
    anchorOffset,
    focusDOM,
    focusOffset,
    editor,
    lastSelection,
  );
  if (resolvedSelectionPoints === null) {
    return null;
  }
  const [resolvedAnchorPoint, resolvedFocusPoint] = resolvedSelectionPoints;
  return new RangeSelection(
    resolvedAnchorPoint,
    resolvedFocusPoint,
    !$isRangeSelection(lastSelection) ? 0 : lastSelection.format,
    !$isRangeSelection(lastSelection) ? '' : lastSelection.style,
  );
}

function $validatePoint(name: 'anchor' | 'focus', point: PointType): void {
  const node = $getNodeByKey(point.key);
  invariant(
    node !== undefined,
    '$validatePoint: %s key %s not found in current editorState',
    name,
    point.key,
  );
  if (point.type === 'text') {
    invariant($isTextNode(node), '$validatePoint: %s key %s is not a TextNode', name, point.key);
    const size = node.getTextContentSize();
    invariant(
      point.offset <= size,
      '$validatePoint: %s point.offset > node.getTextContentSize() (%s > %s)',
      name,
      String(point.offset),
      String(size),
    );
  } else {
    invariant(
      $isElementNode(node),
      '$validatePoint: %s key %s is not an ElementNode',
      name,
      point.key,
    );
    const size = node.getChildrenSize();
    invariant(
      point.offset <= size,
      '$validatePoint: %s point.offset > node.getChildrenSize() (%s > %s)',
      name,
      String(point.offset),
      String(size),
    );
  }
}

export function $getSelection(): null | BaseSelection {
  const editorState = getActiveEditorState();
  return editorState._selection;
}

export function $getPreviousSelection(): null | BaseSelection {
  const editor = getActiveEditor();
  return editor._editorState._selection;
}

export function $updateElementSelectionOnCreateDeleteNode(
  selection: RangeSelection,
  parentNode: LexicalNode,
  nodeOffset: number,
  times = 1,
): void {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = anchor.getNode();
  const focusNode = focus.getNode();
  if (!parentNode.is(anchorNode) && !parentNode.is(focusNode)) {
    return;
  }
  const parentKey = parentNode.__key;
  // Single node. We shift selection but never redimension it
  if (selection.isCollapsed()) {
    const selectionOffset = anchor.offset;
    if (
      (nodeOffset <= selectionOffset && times > 0) ||
      (nodeOffset < selectionOffset && times < 0)
    ) {
      const newSelectionOffset = Math.max(0, selectionOffset + times);
      anchor.set(parentKey, newSelectionOffset, 'element');
      focus.set(parentKey, newSelectionOffset, 'element');
      // The new selection might point to text nodes, try to resolve them
      $updateSelectionResolveTextNodes(selection);
    }
  } else {
    // Multiple nodes selected. We shift or redimension selection
    const isBackward = selection.isBackward();
    const firstPoint = isBackward ? focus : anchor;
    const firstPointNode = firstPoint.getNode();
    const lastPoint = isBackward ? anchor : focus;
    const lastPointNode = lastPoint.getNode();
    if (parentNode.is(firstPointNode)) {
      const firstPointOffset = firstPoint.offset;
      if (
        (nodeOffset <= firstPointOffset && times > 0) ||
        (nodeOffset < firstPointOffset && times < 0)
      ) {
        firstPoint.set(parentKey, Math.max(0, firstPointOffset + times), 'element');
      }
    }
    if (parentNode.is(lastPointNode)) {
      const lastPointOffset = lastPoint.offset;
      if (
        (nodeOffset <= lastPointOffset && times > 0) ||
        (nodeOffset < lastPointOffset && times < 0)
      ) {
        lastPoint.set(parentKey, Math.max(0, lastPointOffset + times), 'element');
      }
    }
  }
  // The new selection might point to text nodes, try to resolve them
  $updateSelectionResolveTextNodes(selection);
}

function $updateSelectionResolveTextNodes(selection: RangeSelection): void {
  const anchor = selection.anchor;
  const anchorOffset = anchor.offset;
  const focus = selection.focus;
  const focusOffset = focus.offset;
  const anchorNode = anchor.getNode();
  const focusNode = focus.getNode();
  if (selection.isCollapsed()) {
    if (!$isElementNode(anchorNode)) {
      return;
    }
    const childSize = anchorNode.getChildrenSize();
    const anchorOffsetAtEnd = anchorOffset >= childSize;
    const child = anchorOffsetAtEnd
      ? anchorNode.getChildAtIndex(childSize - 1)
      : anchorNode.getChildAtIndex(anchorOffset);
    if ($isTextNode(child)) {
      let newOffset = 0;
      if (anchorOffsetAtEnd) {
        newOffset = child.getTextContentSize();
      }
      anchor.set(child.__key, newOffset, 'text');
      focus.set(child.__key, newOffset, 'text');
    }
    return;
  }
  if ($isElementNode(anchorNode)) {
    const childSize = anchorNode.getChildrenSize();
    const anchorOffsetAtEnd = anchorOffset >= childSize;
    const child = anchorOffsetAtEnd
      ? anchorNode.getChildAtIndex(childSize - 1)
      : anchorNode.getChildAtIndex(anchorOffset);
    if ($isTextNode(child)) {
      let newOffset = 0;
      if (anchorOffsetAtEnd) {
        newOffset = child.getTextContentSize();
      }
      anchor.set(child.__key, newOffset, 'text');
    }
  }
  if ($isElementNode(focusNode)) {
    const childSize = focusNode.getChildrenSize();
    const focusOffsetAtEnd = focusOffset >= childSize;
    const child = focusOffsetAtEnd
      ? focusNode.getChildAtIndex(childSize - 1)
      : focusNode.getChildAtIndex(focusOffset);
    if ($isTextNode(child)) {
      let newOffset = 0;
      if (focusOffsetAtEnd) {
        newOffset = child.getTextContentSize();
      }
      focus.set(child.__key, newOffset, 'text');
    }
  }
}

export function applySelectionTransforms(
  nextEditorState: EditorState,
  editor: LexicalEditor,
): void {
  const prevEditorState = editor.getEditorState();
  const prevSelection = prevEditorState._selection;
  const nextSelection = nextEditorState._selection;
  if ($isRangeSelection(nextSelection)) {
    const anchor = nextSelection.anchor;
    const focus = nextSelection.focus;
    let anchorNode;

    if (anchor.type === 'text') {
      anchorNode = anchor.getNode();
      anchorNode.selectionTransform(prevSelection, nextSelection);
    }
    if (focus.type === 'text') {
      const focusNode = focus.getNode();
      if (anchorNode !== focusNode) {
        focusNode.selectionTransform(prevSelection, nextSelection);
      }
    }
  }
}

export function moveSelectionPointToSibling(
  point: PointType,
  node: LexicalNode,
  parent: ElementNode,
  prevSibling: LexicalNode | null,
  nextSibling: LexicalNode | null,
): void {
  let siblingKey = null;
  let offset = 0;
  let type: 'text' | 'element' | null = null;
  if (prevSibling !== null) {
    siblingKey = prevSibling.__key;
    if ($isTextNode(prevSibling)) {
      offset = prevSibling.getTextContentSize();
      type = 'text';
    } else if ($isElementNode(prevSibling)) {
      offset = prevSibling.getChildrenSize();
      type = 'element';
    }
  } else {
    if (nextSibling !== null) {
      siblingKey = nextSibling.__key;
      if ($isTextNode(nextSibling)) {
        type = 'text';
      } else if ($isElementNode(nextSibling)) {
        type = 'element';
      }
    }
  }
  if (siblingKey !== null && type !== null) {
    point.set(siblingKey, offset, type);
  } else {
    offset = node.getIndexWithinParent();
    if (offset === -1) {
      // Move selection to end of parent
      offset = parent.getChildrenSize();
    }
    point.set(parent.__key, offset, 'element');
  }
}

export function adjustPointOffsetForMergedSibling(
  point: PointType,
  isBefore: boolean,
  key: NodeKey,
  target: TextNode,
  textLength: number,
): void {
  if (point.type === 'text') {
    point.set(key, point.offset + (isBefore ? 0 : textLength), 'text');
  } else if (point.offset > target.getIndexWithinParent()) {
    point.set(point.key, point.offset - 1, 'element');
  }
}

function setDOMSelectionBaseAndExtent(
  domSelection: Selection,
  nextAnchorDOM: HTMLElement | Text,
  nextAnchorOffset: number,
  nextFocusDOM: HTMLElement | Text,
  nextFocusOffset: number,
): void {
  // Apply the updated selection to the DOM. Note: this will trigger
  // a "selectionchange" event, although it will be asynchronous.
  try {
    domSelection.setBaseAndExtent(nextAnchorDOM, nextAnchorOffset, nextFocusDOM, nextFocusOffset);
  } catch (error) {
    // If we encounter an error, continue. This can sometimes
    // occur with FF and there's no good reason as to why it
    // should happen.
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      console.warn(error);
    }
  }
}

export function updateDOMSelection(
  prevSelection: BaseSelection | null,
  nextSelection: BaseSelection | null,
  editor: LexicalEditor,
  domSelection: Selection,
  tags: Set<string>,
  rootElement: HTMLElement,
  nodeCount: number,
): void {
  const anchorDOMNode = domSelection.anchorNode;
  const focusDOMNode = domSelection.focusNode;
  const anchorOffset = domSelection.anchorOffset;
  const focusOffset = domSelection.focusOffset;
  const activeElement = document.activeElement;

  // TODO: make this not hard-coded, and add another config option
  // that makes this configurable.
  if (
    (tags.has(COLLABORATION_TAG) && activeElement !== rootElement) ||
    (activeElement !== null && isSelectionCapturedInDecoratorInput(activeElement))
  ) {
    return;
  }

  if (!$isRangeSelection(nextSelection)) {
    // We don't remove selection if the prevSelection is null because
    // of editor.setRootElement(). If this occurs on init when the
    // editor is already focused, then this can cause the editor to
    // lose focus.
    if (prevSelection !== null && isSelectionWithinEditor(editor, anchorDOMNode, focusDOMNode)) {
      domSelection.removeAllRanges();
    }

    return;
  }

  const anchor = nextSelection.anchor;
  const focus = nextSelection.focus;
  const anchorKey = anchor.key;
  const focusKey = focus.key;
  const anchorDOM = getElementByKeyOrThrow(editor, anchorKey);
  const focusDOM = getElementByKeyOrThrow(editor, focusKey);
  const nextAnchorOffset = anchor.offset;
  const nextFocusOffset = focus.offset;
  const nextFormat = nextSelection.format;
  const nextStyle = nextSelection.style;
  const isCollapsed = nextSelection.isCollapsed();
  let nextAnchorNode: HTMLElement | Text | null = anchorDOM;
  let nextFocusNode: HTMLElement | Text | null = focusDOM;
  let anchorFormatOrStyleChanged = false;

  if (anchor.type === 'text') {
    nextAnchorNode = getDOMTextNode(anchorDOM);
    const anchorNode = anchor.getNode();
    anchorFormatOrStyleChanged =
      anchorNode.getFormat() !== nextFormat || anchorNode.getStyle() !== nextStyle;
  } else if ($isRangeSelection(prevSelection) && prevSelection.anchor.type === 'text') {
    anchorFormatOrStyleChanged = true;
  }

  if (focus.type === 'text') {
    nextFocusNode = getDOMTextNode(focusDOM);
  }

  // If we can't get an underlying text node for selection, then
  // we should avoid setting selection to something incorrect.
  if (nextAnchorNode === null || nextFocusNode === null) {
    return;
  }

  if (
    isCollapsed &&
    (prevSelection === null ||
      anchorFormatOrStyleChanged ||
      ($isRangeSelection(prevSelection) &&
        (prevSelection.format !== nextFormat || prevSelection.style !== nextStyle)))
  ) {
    markCollapsedSelectionFormat(
      nextFormat,
      nextStyle,
      nextAnchorOffset,
      anchorKey,
      performance.now(),
    );
  }

  // Diff against the native DOM selection to ensure we don't do
  // an unnecessary selection update. We also skip this check if
  // we're moving selection to within an element, as this can
  // sometimes be problematic around scrolling.
  if (
    anchorOffset === nextAnchorOffset &&
    focusOffset === nextFocusOffset &&
    anchorDOMNode === nextAnchorNode &&
    focusDOMNode === nextFocusNode && // Badly interpreted range selection when collapsed - #1482
    !(domSelection.type === 'Range' && isCollapsed)
  ) {
    // If the root element does not have focus, ensure it has focus
    if (activeElement === null || !rootElement.contains(activeElement)) {
      rootElement.focus({
        preventScroll: true,
      });
    }
    if (anchor.type !== 'element') {
      return;
    }
  }

  // Apply the updated selection to the DOM. Note: this will trigger
  // a "selectionchange" event, although it will be asynchronous.
  setDOMSelectionBaseAndExtent(
    domSelection,
    nextAnchorNode,
    nextAnchorOffset,
    nextFocusNode,
    nextFocusOffset,
  );
  if (
    !tags.has(SKIP_SCROLL_INTO_VIEW_TAG) &&
    nextSelection.isCollapsed() &&
    rootElement !== null &&
    rootElement === document.activeElement
  ) {
    const selectionTarget: null | Range | HTMLElement | Text =
      $isRangeSelection(nextSelection) && nextSelection.anchor.type === 'element'
        ? (nextAnchorNode.childNodes[nextAnchorOffset] as HTMLElement | Text) || null
        : domSelection.rangeCount > 0
          ? domSelection.getRangeAt(0)
          : null;
    if (selectionTarget !== null) {
      let selectionRect: DOMRect;
      if (selectionTarget instanceof Text) {
        const range = document.createRange();
        range.selectNode(selectionTarget);
        selectionRect = range.getBoundingClientRect();
      } else {
        selectionRect = selectionTarget.getBoundingClientRect();
      }
      scrollIntoViewIfNeeded(editor, selectionRect, rootElement);
    }
  }

  markSelectionChangeFromDOMUpdate();
}

export function $insertNodes(nodes: Array<LexicalNode>) {
  let selection = $getSelection() || $getPreviousSelection();

  if (selection === null) {
    selection = $getRoot().selectEnd();
  }
  selection.insertNodes(nodes);
}

export function $getTextContent(): string {
  const selection = $getSelection();
  if (selection === null) {
    return '';
  }
  return selection.getTextContent();
}

function $removeTextAndSplitBlock(selection: RangeSelection): number {
  let selection_ = selection;
  if (!selection.isCollapsed()) {
    selection_.removeText();
  }
  // A new selection can originate as a result of node replacement, in which case is registered via
  // $setSelection
  const newSelection = $getSelection();
  if ($isRangeSelection(newSelection)) {
    selection_ = newSelection;
  }

  invariant($isRangeSelection(selection_), 'Unexpected dirty selection to be null');

  const anchor = selection_.anchor;
  let node = anchor.getNode();
  let offset = anchor.offset;

  while (!INTERNAL_$isBlock(node)) {
    const prevNode = node;
    [node, offset] = $splitNodeAtPoint(node, offset);
    if (prevNode.is(node)) {
      break;
    }
  }

  return offset;
}

function $splitNodeAtPoint(
  node: LexicalNode,
  offset: number,
): [parent: ElementNode, offset: number] {
  const parent = node.getParent();
  if (!parent) {
    const paragraph = $createParagraphNode();
    $getRoot().append(paragraph);
    paragraph.select();
    return [$getRoot(), 0];
  }

  if ($isTextNode(node)) {
    const split = node.splitText(offset);
    if (split.length === 0) {
      return [parent, node.getIndexWithinParent()];
    }
    const x = offset === 0 ? 0 : 1;
    const index = split[0].getIndexWithinParent() + x;

    return [parent, index];
  }

  if (!$isElementNode(node) || offset === 0) {
    return [parent, node.getIndexWithinParent()];
  }

  const firstToAppend = node.getChildAtIndex(offset);
  if (firstToAppend) {
    const insertPoint = new RangeSelection(
      $createPoint(node.__key, offset, 'element'),
      $createPoint(node.__key, offset, 'element'),
      0,
      '',
    );
    const newElement = node.insertNewAfter(insertPoint) as ElementNode | null;
    if (newElement) {
      newElement.append(firstToAppend, ...firstToAppend.getNextSiblings());
    }
  }
  return [parent, node.getIndexWithinParent() + 1];
}

function $wrapInlineNodes(nodes: LexicalNode[]) {
  // We temporarily insert the topLevelNodes into an arbitrary ElementNode,
  // since insertAfter does not work on nodes that have no parent (TO-DO: fix that).
  const virtualRoot = $createParagraphNode();

  let currentBlock = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    const isLineBreakNode = $isLineBreakNode(node);

    if (
      isLineBreakNode ||
      ($isDecoratorNode(node) && node.isInline()) ||
      ($isElementNode(node) && node.isInline()) ||
      $isTextNode(node) ||
      node.isParentRequired()
    ) {
      if (currentBlock === null) {
        currentBlock = node.createParentElementNode();
        virtualRoot.append(currentBlock);
        // In the case of LineBreakNode, we just need to
        // add an empty ParagraphNode to the topLevelBlocks.
        if (isLineBreakNode) {
          continue;
        }
      }

      if (currentBlock !== null) {
        currentBlock.append(node);
      }
    } else {
      virtualRoot.append(node);
      currentBlock = null;
    }
  }

  return virtualRoot;
}

/**
 * Get all nodes in a CaretRange in a way that complies with all of the
 * quirks of the original RangeSelection.getNodes().
 *
 * @param range The CaretRange
 */
function $getNodesFromCaretRangeCompat(
  // getNodes returned nodes in document order
  range: CaretRange<'next'>,
): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  const [beforeSlice, afterSlice] = range.getTextSlices();
  if (beforeSlice) {
    nodes.push(beforeSlice.caret.origin);
  }
  const seenAncestors = new Set<ElementNode>();
  const seenElements = new Set<ElementNode>();
  for (const caret of range) {
    if ($isChildCaret(caret)) {
      // Emulate the leading under-selection behavior of getNodes by
      // ignoring the 'enter' of any ElementNode until we've seen a
      // SiblingCaret
      const { origin } = caret;
      if (nodes.length === 0) {
        seenAncestors.add(origin);
      } else {
        seenElements.add(origin);
        nodes.push(origin);
      }
    } else {
      const { origin } = caret;
      if (!$isElementNode(origin) || !seenElements.has(origin)) {
        nodes.push(origin);
      }
    }
  }
  if (afterSlice) {
    nodes.push(afterSlice.caret.origin);
  }
  // Emulate the trailing underselection behavior when the last offset of
  // an element is selected
  if (
    $isSiblingCaret(range.focus) &&
    $isElementNode(range.focus.origin) &&
    range.focus.getNodeAtCaret() === null
  ) {
    for (
      let reverseCaret: null | NodeCaret<'previous'> = $getChildCaret(
        range.focus.origin,
        'previous',
      );
      $isChildCaret(reverseCaret) &&
      seenAncestors.has(reverseCaret.origin) &&
      !reverseCaret.origin.isEmpty() &&
      reverseCaret.origin.is(nodes[nodes.length - 1]);
      reverseCaret = $getAdjacentChildCaret(reverseCaret)
    ) {
      seenAncestors.delete(reverseCaret.origin);
      nodes.pop();
    }
  }
  while (nodes.length > 1) {
    const lastIncludedNode = nodes[nodes.length - 1];
    if ($isElementNode(lastIncludedNode)) {
      if (
        seenElements.has(lastIncludedNode) ||
        lastIncludedNode.isEmpty() ||
        seenAncestors.has(lastIncludedNode)
      ) {
        // fall through to break
      } else {
        nodes.pop();
        continue;
      }
    }
    break;
  }
  if (nodes.length === 0 && range.isCollapsed()) {
    // Emulate the collapsed behavior of getNodes by returning the descendant
    const normCaret = $normalizeCaret(range.anchor);
    const flippedNormCaret = $normalizeCaret(range.anchor.getFlipped());
    const $getCandidate = (caret: PointCaret): LexicalNode | null =>
      $isTextPointCaret(caret) ? caret.origin : caret.getNodeAtCaret();
    const node =
      $getCandidate(normCaret) ||
      $getCandidate(flippedNormCaret) ||
      (range.anchor.getNodeAtCaret() ? normCaret.origin : flippedNormCaret.origin);
    nodes.push(node);
  }
  return nodes;
}

/**
 * @internal
 *
 * Modify the focus of the focus around possible decorators and blocks and return true
 * if the movement is done.
 */
function $modifySelectionAroundDecoratorsAndBlocks(
  selection: RangeSelection,
  alter: 'move' | 'extend',
  isBackward: boolean,
  granularity: 'character' | 'word' | 'lineboundary',
  mode: 'decorators-and-blocks' | 'decorators' = 'decorators-and-blocks',
): boolean {
  if (alter === 'move' && granularity === 'character' && !selection.isCollapsed()) {
    // moving left or right when the selection isn't collapsed will
    // just set the anchor to the focus or vice versa depending on
    // direction
    const [src, dst] =
      isBackward === selection.isBackward()
        ? [selection.focus, selection.anchor]
        : [selection.anchor, selection.focus];
    dst.set(src.key, src.offset, src.type);
    return true;
  }
  const initialFocus = $caretFromPoint(selection.focus, isBackward ? 'previous' : 'next');
  const isLineBoundary = granularity === 'lineboundary';
  const collapse = alter === 'move';
  let focus = initialFocus;
  let checkForBlock = mode === 'decorators-and-blocks';
  if (!$isExtendableTextPointCaret(focus)) {
    for (const siblingCaret of focus) {
      checkForBlock = false;
      const { origin } = siblingCaret;
      if ($isDecoratorNode(origin) && !origin.isIsolated()) {
        focus = siblingCaret;
        if (isLineBoundary && origin.isInline()) {
          continue;
        }
      }
      break;
    }
    if (checkForBlock) {
      for (const nextCaret of $extendCaretToRange(initialFocus).iterNodeCarets(
        alter === 'extend' ? 'shadowRoot' : 'root',
      )) {
        if ($isChildCaret(nextCaret)) {
          if (!nextCaret.origin.isInline()) {
            focus = nextCaret;
          }
        } else if ($isElementNode(nextCaret.origin)) {
          continue;
        } else if ($isDecoratorNode(nextCaret.origin) && !nextCaret.origin.isInline()) {
          focus = nextCaret;
        }
        break;
      }
    }
  }
  if (focus === initialFocus) {
    return false;
  }
  // After this point checkForBlock is true if and only if we moved to a
  // different block, so we should stop regardless of the granularity
  if (
    collapse &&
    !isLineBoundary &&
    $isDecoratorNode(focus.origin) &&
    focus.origin.isKeyboardSelectable()
  ) {
    // Make it possible to move selection from range selection to
    // node selection on the node.
    const nodeSelection = $createNodeSelection();
    nodeSelection.add(focus.origin.getKey());
    $setSelection(nodeSelection);
    return true;
  }
  focus = $normalizeCaret(focus);
  if (collapse) {
    $setPointFromCaret(selection.anchor, focus);
  }
  $setPointFromCaret(selection.focus, focus);
  return checkForBlock || !isLineBoundary;
}

let subTreeTextContent = '';
let subTreeTextFormat: number | null = null;
let subTreeTextStyle: string = '';
let editorTextContent = '';
let activeEditorConfig: EditorConfig;
let notModifyActiveEditor: LexicalEditor;
let activeEditorNodes: RegisteredNodes;
let treatAllNodesAsDirty = false;
let activeEditorStateReadOnly = false;
let activeMutationListeners: MutationListeners;
let activeDirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>;
let activeDirtyLeaves: Set<NodeKey>;
let activePrevNodeMap: NodeMap;
let activeNextNodeMap: NodeMap;
let activePrevKeyToDOMMap: Map<NodeKey, HTMLElement>;
let mutatedNodes: MutatedNodes;

function destroyNode(key: NodeKey, parentDOM: null | HTMLElement): void {
  const node = activePrevNodeMap.get(key);

  if (parentDOM !== null) {
    const dom = getPrevElementByKeyOrThrow(key);
    if (dom.parentNode === parentDOM) {
      parentDOM.removeChild(dom);
    }
  }

  // This logic is really important, otherwise we will leak DOM nodes
  // when their corresponding LexicalNodes are removed from the editor state.
  if (!activeNextNodeMap.has(key)) {
    notModifyActiveEditor._keyToDOMMap.delete(key);
  }

  if ($isElementNode(node)) {
    const children = createChildrenArray(node, activePrevNodeMap);
    destroyChildren(children, 0, children.length - 1, null);
  }

  if (node !== undefined) {
    setMutatedNode(mutatedNodes, activeEditorNodes, activeMutationListeners, node, 'destroyed');
  }
}

function destroyChildren(
  children: Array<NodeKey>,
  _startIndex: number,
  endIndex: number,
  dom: null | HTMLElement,
): void {
  let startIndex = _startIndex;

  for (; startIndex <= endIndex; ++startIndex) {
    const child = children[startIndex];

    if (child !== undefined) {
      destroyNode(child, dom);
    }
  }
}

function setTextAlign(domStyle: CSSStyleDeclaration, value: string): void {
  domStyle.setProperty('text-align', value);
}

const DEFAULT_INDENT_VALUE = '40px';

function setElementIndent(dom: HTMLElement, indent: number): void {
  const indentClassName = activeEditorConfig.theme.indent;

  if (typeof indentClassName === 'string') {
    const elementHasClassName = dom.classList.contains(indentClassName);

    if (indent > 0 && !elementHasClassName) {
      dom.classList.add(indentClassName);
    } else if (indent < 1 && elementHasClassName) {
      dom.classList.remove(indentClassName);
    }
  }

  const indentationBaseValue =
    getComputedStyle(dom).getPropertyValue('--lexical-indent-base-value') || DEFAULT_INDENT_VALUE;

  dom.style.setProperty(
    'padding-inline-start',
    indent === 0 ? '' : `calc(${indent} * ${indentationBaseValue})`,
  );
}

function setElementFormat(dom: HTMLElement, format: number): void {
  const domStyle = dom.style;

  if (format === 0) {
    setTextAlign(domStyle, '');
  } else if (format === IS_ALIGN_LEFT) {
    setTextAlign(domStyle, 'left');
  } else if (format === IS_ALIGN_CENTER) {
    setTextAlign(domStyle, 'center');
  } else if (format === IS_ALIGN_RIGHT) {
    setTextAlign(domStyle, 'right');
  } else if (format === IS_ALIGN_JUSTIFY) {
    setTextAlign(domStyle, 'justify');
  } else if (format === IS_ALIGN_START) {
    setTextAlign(domStyle, 'start');
  } else if (format === IS_ALIGN_END) {
    setTextAlign(domStyle, 'end');
  }
}

export function $getReconciledDirection(node: ElementNode): 'ltr' | 'rtl' | 'auto' | null {
  const direction = node.__dir;
  if (direction !== null) {
    return direction;
  }
  if ($isRootNode(node)) {
    return null;
  }
  const parent = node.getParentOrThrow();
  if (!$isRootNode(parent) || parent.__dir !== null) {
    return null;
  }
  return 'auto';
}

function $setElementDirection(dom: HTMLElement, node: ElementNode): void {
  const direction = $getReconciledDirection(node);
  if (direction !== null) {
    dom.dir = direction;
  } else {
    dom.removeAttribute('dir');
  }
}

function $createNode(key: NodeKey, slot: ElementDOMSlot | null): HTMLElement {
  const node = activeNextNodeMap.get(key);

  if (node === undefined) {
    invariant(false, 'createNode: node does not exist in nodeMap');
  }
  const dom = node.createDOM(activeEditorConfig, notModifyActiveEditor);
  storeDOMWithKey(key, dom, notModifyActiveEditor);

  // This helps preserve the text, and stops spell check tools from
  // merging or break the spans (which happens if they are missing
  // this attribute).
  if ($isTextNode(node)) {
    dom.setAttribute('data-lexical-text', 'true');
  } else if ($isDecoratorNode(node)) {
    dom.setAttribute('data-lexical-decorator', 'true');
  }

  if ($isElementNode(node)) {
    const indent = node.__indent;
    const childrenSize = node.__size;
    $setElementDirection(dom, node);
    if (indent !== 0) {
      setElementIndent(dom, indent);
    }
    if (childrenSize !== 0) {
      const endIndex = childrenSize - 1;
      const children = createChildrenArray(node, activeNextNodeMap);
      $createChildren(children, node, 0, endIndex, node.getDOMSlot(dom));
    }
    const format = node.__format;

    if (format !== 0) {
      setElementFormat(dom, format);
    }
    if (!node.isInline()) {
      reconcileElementTerminatingLineBreak(null, node, dom);
    }
    if ($textContentRequiresDoubleLinebreakAtEnd(node)) {
      subTreeTextContent += DOUBLE_LINE_BREAK;
      editorTextContent += DOUBLE_LINE_BREAK;
    }
  } else {
    const text = node.getTextContent();

    if ($isDecoratorNode(node)) {
      const decorator = node.decorate(notModifyActiveEditor, activeEditorConfig);

      if (decorator !== null) {
        reconcileDecorator(key, decorator);
      }
      // Decorators are always non editable
      dom.contentEditable = 'false';
    }
    subTreeTextContent += text;
    editorTextContent += text;
  }

  if (slot !== null) {
    slot.insertChild(dom);
  }

  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    // Freeze the node in DEV to prevent accidental mutations
    Object.freeze(node);
  }

  setMutatedNode(mutatedNodes, activeEditorNodes, activeMutationListeners, node, 'created');
  return dom;
}

function $createChildren(
  children: Array<NodeKey>,
  element: ElementNode & LexicalPrivateDOM,
  _startIndex: number,
  endIndex: number,
  slot: ElementDOMSlot,
): void {
  const previousSubTreeTextContent = subTreeTextContent;
  subTreeTextContent = '';
  let startIndex = _startIndex;

  for (; startIndex <= endIndex; ++startIndex) {
    $createNode(children[startIndex], slot);
    const node = activeNextNodeMap.get(children[startIndex]);
    if (node !== null && $isTextNode(node)) {
      if (subTreeTextFormat === null) {
        subTreeTextFormat = node.getFormat();
      }
      if (subTreeTextStyle === '') {
        subTreeTextStyle = node.getStyle();
      }
    }
  }
  if ($textContentRequiresDoubleLinebreakAtEnd(element)) {
    subTreeTextContent += DOUBLE_LINE_BREAK;
  }
  const dom: HTMLElement & LexicalPrivateDOM = slot.element;
  dom.__lexicalTextContent = subTreeTextContent;
  subTreeTextContent = previousSubTreeTextContent + subTreeTextContent;
}

type LastChildState = 'line-break' | 'decorator' | 'empty';
function isLastChildLineBreakOrDecorator(
  element: null | ElementNode,
  nodeMap: NodeMap,
): null | LastChildState {
  if (element) {
    const lastKey = element.__last;
    if (lastKey) {
      const node = nodeMap.get(lastKey);
      if (node) {
        return $isLineBreakNode(node)
          ? 'line-break'
          : $isDecoratorNode(node) && node.isInline()
            ? 'decorator'
            : null;
      }
    }
    return 'empty';
  }
  return null;
}

// If we end an element with a LineBreakNode, then we need to add an additional <br>
function reconcileElementTerminatingLineBreak(
  prevElement: null | ElementNode,
  nextElement: ElementNode,
  dom: HTMLElement & LexicalPrivateDOM,
): void {
  const prevLineBreak = isLastChildLineBreakOrDecorator(prevElement, activePrevNodeMap);
  const nextLineBreak = isLastChildLineBreakOrDecorator(nextElement, activeNextNodeMap);
  if (prevLineBreak !== nextLineBreak) {
    nextElement.getDOMSlot(dom).setManagedLineBreak(nextLineBreak);
  }
}

function reconcileTextFormat(element: ElementNode): void {
  if (
    subTreeTextFormat != null &&
    subTreeTextFormat !== element.__textFormat &&
    !activeEditorStateReadOnly
  ) {
    element.setTextFormat(subTreeTextFormat);
  }
}

function reconcileTextStyle(element: ElementNode): void {
  if (
    subTreeTextStyle !== '' &&
    subTreeTextStyle !== element.__textStyle &&
    !activeEditorStateReadOnly
  ) {
    element.setTextStyle(subTreeTextStyle);
  }
}

function $reconcileChildrenWithDirection(
  prevElement: ElementNode,
  nextElement: ElementNode,
  dom: HTMLElement,
): void {
  subTreeTextFormat = null;
  subTreeTextStyle = '';
  $reconcileChildren(prevElement, nextElement, nextElement.getDOMSlot(dom));
  reconcileTextFormat(nextElement);
  reconcileTextStyle(nextElement);
}

function createChildrenArray(element: ElementNode, nodeMap: NodeMap): Array<NodeKey> {
  const children = [];
  let nodeKey = element.__first;
  while (nodeKey !== null) {
    const node = nodeMap.get(nodeKey);
    if (node === undefined) {
      invariant(false, 'createChildrenArray: node does not exist in nodeMap');
    }
    children.push(nodeKey);
    nodeKey = node.__next;
  }
  return children;
}

function $reconcileChildren(
  prevElement: ElementNode,
  nextElement: ElementNode,
  slot: ElementDOMSlot,
): void {
  const previousSubTreeTextContent = subTreeTextContent;
  const prevChildrenSize = prevElement.__size;
  const nextChildrenSize = nextElement.__size;
  subTreeTextContent = '';
  const dom: HTMLElement & LexicalPrivateDOM = slot.element;

  if (prevChildrenSize === 1 && nextChildrenSize === 1) {
    const prevFirstChildKey: NodeKey = prevElement.__first!;
    const nextFirstChildKey: NodeKey = nextElement.__first!;
    if (prevFirstChildKey === nextFirstChildKey) {
      $reconcileNode(prevFirstChildKey, dom);
    } else {
      const lastDOM = getPrevElementByKeyOrThrow(prevFirstChildKey);
      const replacementDOM = $createNode(nextFirstChildKey, null);
      try {
        dom.replaceChild(replacementDOM, lastDOM);
      } catch (error) {
        if (typeof error === 'object' && error != null) {
          const msg = `${error.toString()} Parent: ${dom.tagName}, new child: {tag: ${
            replacementDOM.tagName
          } key: ${nextFirstChildKey}}, old child: {tag: ${
            lastDOM.tagName
          }, key: ${prevFirstChildKey}}.`;
          throw new Error(msg);
        } else {
          throw error;
        }
      }
      destroyNode(prevFirstChildKey, null);
    }
    const nextChildNode = activeNextNodeMap.get(nextFirstChildKey);
    if ($isTextNode(nextChildNode)) {
      if (subTreeTextFormat === null) {
        subTreeTextFormat = nextChildNode.getFormat();
      }
      if (subTreeTextStyle === '') {
        subTreeTextStyle = nextChildNode.getStyle();
      }
    }
  } else {
    const prevChildren = createChildrenArray(prevElement, activePrevNodeMap);
    const nextChildren = createChildrenArray(nextElement, activeNextNodeMap);
    invariant(
      prevChildren.length === prevChildrenSize,
      '$reconcileChildren: prevChildren.length !== prevChildrenSize',
    );
    invariant(
      nextChildren.length === nextChildrenSize,
      '$reconcileChildren: nextChildren.length !== nextChildrenSize',
    );

    if (prevChildrenSize === 0) {
      if (nextChildrenSize !== 0) {
        $createChildren(nextChildren, nextElement, 0, nextChildrenSize - 1, slot);
      }
    } else if (nextChildrenSize === 0) {
      if (prevChildrenSize !== 0) {
        const canUseFastPath =
          slot.after == null &&
          slot.before == null &&
          (slot.element as HTMLElement & LexicalPrivateDOM).__lexicalLineBreak == null;
        destroyChildren(prevChildren, 0, prevChildrenSize - 1, canUseFastPath ? null : dom);

        if (canUseFastPath) {
          // Fast path for removing DOM nodes
          dom.textContent = '';
        }
      }
    } else {
      $reconcileNodeChildren(
        nextElement,
        prevChildren,
        nextChildren,
        prevChildrenSize,
        nextChildrenSize,
        slot,
      );
    }
  }

  if ($textContentRequiresDoubleLinebreakAtEnd(nextElement)) {
    subTreeTextContent += DOUBLE_LINE_BREAK;
  }

  dom.__lexicalTextContent = subTreeTextContent;
  subTreeTextContent = previousSubTreeTextContent + subTreeTextContent;
}

function $reconcileNode(key: NodeKey, parentDOM: HTMLElement | null): HTMLElement {
  const prevNode = activePrevNodeMap.get(key);
  let nextNode = activeNextNodeMap.get(key);

  if (prevNode === undefined || nextNode === undefined) {
    invariant(false, 'reconcileNode: prevNode or nextNode does not exist in nodeMap');
  }

  const isDirty =
    treatAllNodesAsDirty || activeDirtyLeaves.has(key) || activeDirtyElements.has(key);
  const dom: HTMLElement & LexicalPrivateDOM = getElementByKeyOrThrow(notModifyActiveEditor, key);

  // If the node key points to the same instance in both states
  // and isn't dirty, we just update the text content cache
  // and return the existing DOM Node.
  if (prevNode === nextNode && !isDirty) {
    if ($isElementNode(prevNode)) {
      const previousSubTreeTextContent = dom.__lexicalTextContent;

      if (previousSubTreeTextContent !== undefined) {
        subTreeTextContent += previousSubTreeTextContent;
        editorTextContent += previousSubTreeTextContent;
      }
    } else {
      const text = prevNode.getTextContent();
      editorTextContent += text;
      subTreeTextContent += text;
    }

    return dom;
  }
  // If the node key doesn't point to the same instance in both maps,
  // it was cloned. If it's also dirty, we mark it as mutated.
  if (prevNode !== nextNode && isDirty) {
    setMutatedNode(mutatedNodes, activeEditorNodes, activeMutationListeners, nextNode, 'updated');
  }

  // Update node. If it returns true, we need to unmount and re-create the node
  if (nextNode.updateDOM(prevNode, dom, activeEditorConfig)) {
    const replacementDOM = $createNode(key, null);

    if (parentDOM === null) {
      invariant(false, 'reconcileNode: parentDOM is null');
    }

    parentDOM.replaceChild(replacementDOM, dom);
    destroyNode(key, null);
    return replacementDOM;
  }

  if ($isElementNode(prevNode) && $isElementNode(nextNode)) {
    const nextIndent = nextNode.__indent;

    if (treatAllNodesAsDirty || nextIndent !== prevNode.__indent) {
      setElementIndent(dom, nextIndent);
    }

    const nextFormat = nextNode.__format;

    if (treatAllNodesAsDirty || nextFormat !== prevNode.__format) {
      setElementFormat(dom, nextFormat);
    }
    if (isDirty) {
      $reconcileChildrenWithDirection(prevNode, nextNode, dom);
      if (!$isRootNode(nextNode) && !nextNode.isInline()) {
        reconcileElementTerminatingLineBreak(prevNode, nextNode, dom);
      }
    }

    if ($textContentRequiresDoubleLinebreakAtEnd(nextNode)) {
      subTreeTextContent += DOUBLE_LINE_BREAK;
      editorTextContent += DOUBLE_LINE_BREAK;
    }

    if (treatAllNodesAsDirty || nextNode.__dir !== prevNode.__dir) {
      $setElementDirection(dom, nextNode);
      if (
        // Root node direction changing from set to unset (or vice versa)
        // changes how children's direction is calculated.
        $isRootNode(nextNode) &&
        // Can skip if all children already reconciled.
        !treatAllNodesAsDirty
      ) {
        for (const child of nextNode.getChildren()) {
          if ($isElementNode(child)) {
            const childDom = getElementByKeyOrThrow(notModifyActiveEditor, child.getKey());
            $setElementDirection(childDom, child);
          }
        }
      }
    }
  } else {
    const text = nextNode.getTextContent();

    if ($isDecoratorNode(nextNode)) {
      const decorator = nextNode.decorate(notModifyActiveEditor, activeEditorConfig);

      if (decorator !== null) {
        reconcileDecorator(key, decorator);
      }
    }

    subTreeTextContent += text;
    editorTextContent += text;
  }

  if (
    !activeEditorStateReadOnly &&
    $isRootNode(nextNode) &&
    nextNode.__cachedText !== editorTextContent
  ) {
    // Cache the latest text content.
    const nextRootNode = nextNode.getWritable();
    nextRootNode.__cachedText = editorTextContent;
    nextNode = nextRootNode;
  }

  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    // Freeze the node in DEV to prevent accidental mutations
    Object.freeze(nextNode);
  }

  return dom;
}

function reconcileDecorator(key: NodeKey, decorator: unknown): void {
  let pendingDecorators = notModifyActiveEditor._pendingDecorators;
  const currentDecorators = notModifyActiveEditor._decorators;

  if (pendingDecorators === null) {
    if (currentDecorators[key] === decorator) {
      return;
    }

    pendingDecorators = cloneDecorators(notModifyActiveEditor);
  }

  pendingDecorators[key] = decorator;
}

function getNextSibling(element: HTMLElement): Node | null {
  let nextSibling = element.nextSibling;
  if (nextSibling !== null && nextSibling === notModifyActiveEditor._blockCursorElement) {
    nextSibling = nextSibling.nextSibling;
  }
  return nextSibling;
}

function $reconcileNodeChildren(
  nextElement: ElementNode,
  prevChildren: Array<NodeKey>,
  nextChildren: Array<NodeKey>,
  prevChildrenLength: number,
  nextChildrenLength: number,
  slot: ElementDOMSlot,
): void {
  const prevEndIndex = prevChildrenLength - 1;
  const nextEndIndex = nextChildrenLength - 1;
  let prevChildrenSet: Set<NodeKey> | undefined;
  let nextChildrenSet: Set<NodeKey> | undefined;
  let siblingDOM: null | Node = slot.getFirstChild();
  let prevIndex = 0;
  let nextIndex = 0;

  while (prevIndex <= prevEndIndex && nextIndex <= nextEndIndex) {
    const prevKey = prevChildren[prevIndex];
    const nextKey = nextChildren[nextIndex];

    if (prevKey === nextKey) {
      siblingDOM = getNextSibling($reconcileNode(nextKey, slot.element));
      prevIndex++;
      nextIndex++;
    } else {
      if (prevChildrenSet === undefined) {
        prevChildrenSet = new Set(prevChildren);
      }

      if (nextChildrenSet === undefined) {
        nextChildrenSet = new Set(nextChildren);
      }

      const nextHasPrevKey = nextChildrenSet.has(prevKey);
      const prevHasNextKey = prevChildrenSet.has(nextKey);

      if (!nextHasPrevKey) {
        // Remove prev
        siblingDOM = getNextSibling(getPrevElementByKeyOrThrow(prevKey));
        destroyNode(prevKey, slot.element);
        prevIndex++;
      } else if (!prevHasNextKey) {
        // Create next
        $createNode(nextKey, slot.withBefore(siblingDOM));
        nextIndex++;
      } else {
        // Move next
        const childDOM = getElementByKeyOrThrow(notModifyActiveEditor, nextKey);

        if (childDOM === siblingDOM) {
          siblingDOM = getNextSibling($reconcileNode(nextKey, slot.element));
        } else {
          slot.withBefore(siblingDOM).insertChild(childDOM);
          $reconcileNode(nextKey, slot.element);
        }

        prevIndex++;
        nextIndex++;
      }
    }

    const node = activeNextNodeMap.get(nextKey);
    if (node !== null && $isTextNode(node)) {
      if (subTreeTextFormat === null) {
        subTreeTextFormat = node.getFormat();
      }
      if (subTreeTextStyle === '') {
        subTreeTextStyle = node.getStyle();
      }
    }
  }

  const appendNewChildren = prevIndex > prevEndIndex;
  const removeOldChildren = nextIndex > nextEndIndex;

  if (appendNewChildren && !removeOldChildren) {
    const previousNode = nextChildren[nextEndIndex + 1];
    const insertDOM =
      previousNode === undefined ? null : notModifyActiveEditor.getElementByKey(previousNode);
    $createChildren(nextChildren, nextElement, nextIndex, nextEndIndex, slot.withBefore(insertDOM));
  } else if (removeOldChildren && !appendNewChildren) {
    destroyChildren(prevChildren, prevIndex, prevEndIndex, slot.element);
  }
}

export function $reconcileRoot(
  prevEditorState: EditorState,
  nextEditorState: EditorState,
  editor: LexicalEditor,
  dirtyType: 0 | 1 | 2,
  dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>,
  dirtyLeaves: Set<NodeKey>,
): MutatedNodes {
  // We cache text content to make retrieval more efficient.
  // The cache must be rebuilt during reconciliation to account for any changes.
  subTreeTextContent = '';
  editorTextContent = '';
  // Rather than pass around a load of arguments through the stack recursively
  // we instead set them as bindings within the scope of the module.
  treatAllNodesAsDirty = dirtyType === FULL_RECONCILE;
  notModifyActiveEditor = editor;
  activeEditorConfig = editor._config;
  activeEditorNodes = editor._nodes;
  activeMutationListeners = notModifyActiveEditor._listeners.mutation;
  activeDirtyElements = dirtyElements;
  activeDirtyLeaves = dirtyLeaves;
  activePrevNodeMap = prevEditorState._nodeMap;
  activeNextNodeMap = nextEditorState._nodeMap;
  activeEditorStateReadOnly = nextEditorState._readOnly;
  activePrevKeyToDOMMap = new Map(editor._keyToDOMMap);
  // We keep track of mutated nodes so we can trigger mutation
  // listeners later in the update cycle.
  const currentMutatedNodes = new Map();
  mutatedNodes = currentMutatedNodes;
  $reconcileNode('root', null);
  // We don't want a bunch of void checks throughout the scope
  // so instead we make it seem that these values are always set.
  // We also want to make sure we clear them down, otherwise we
  // can leak memory.
  // @ts-ignore
  notModifyActiveEditor = undefined;
  // @ts-ignore
  activeEditorNodes = undefined;
  // @ts-ignore
  activeDirtyElements = undefined;
  // @ts-ignore
  activeDirtyLeaves = undefined;
  // @ts-ignore
  activePrevNodeMap = undefined;
  // @ts-ignore
  activeNextNodeMap = undefined;
  // @ts-ignore
  activeEditorConfig = undefined;
  // @ts-ignore
  activePrevKeyToDOMMap = undefined;
  // @ts-ignore
  mutatedNodes = undefined;

  return currentMutatedNodes;
}

export function storeDOMWithKey(key: NodeKey, dom: HTMLElement, editor: LexicalEditor): void {
  const keyToDOMMap = editor._keyToDOMMap;
  setNodeKeyOnDOMNode(dom, editor, key);
  keyToDOMMap.set(key, dom);
}

function getPrevElementByKeyOrThrow(key: NodeKey): HTMLElement {
  const element = activePrevKeyToDOMMap.get(key);

  if (element === undefined) {
    invariant(false, 'Reconciliation: could not find DOM element for node key %s', key);
  }

  return element;
}

let activeEditorState: null | EditorState = null;
let activeEditor: null | LexicalEditor = null;
let isReadOnlyMode = false;
let isAttemptingToRecoverFromReconcilerError = false;
let infiniteTransformCount = 0;

const observerOptions = {
  characterData: true,
  childList: true,
  subtree: true,
};

export function isCurrentlyReadOnlyMode(): boolean {
  return isReadOnlyMode || (activeEditorState !== null && activeEditorState._readOnly);
}

export function errorOnReadOnly(): void {
  if (isReadOnlyMode) {
    invariant(false, 'Cannot use method in read-only mode.');
  }
}

export function errorOnInfiniteTransforms(): void {
  if (infiniteTransformCount > 99) {
    invariant(
      false,
      'One or more transforms are endlessly triggering additional transforms. May have encountered infinite recursion caused by transforms that have their preconditions too lose and/or conflict with each other.',
    );
  }
}

export function getActiveEditorState(): EditorState {
  if (activeEditorState === null) {
    invariant(
      false,
      'Unable to find an active editor state. ' +
        'State helpers or node methods can only be used ' +
        'synchronously during the callback of ' +
        'editor.update(), editor.read(), or editorState.read().%s',
      collectBuildInformation(),
    );
  }

  return activeEditorState;
}

export function getActiveEditor(): LexicalEditor {
  if (activeEditor === null) {
    invariant(
      false,
      'Unable to find an active editor. ' +
        'This method can only be used ' +
        'synchronously during the callback of ' +
        'editor.update() or editor.read().%s',
      collectBuildInformation(),
    );
  }
  return activeEditor;
}

function collectBuildInformation(): string {
  let compatibleEditors = 0;
  const incompatibleEditors = new Set<string>();
  const thisVersion = LexicalEditor.version;
  if (typeof window !== 'undefined') {
    for (const node of document.querySelectorAll('[contenteditable]')) {
      const editor = getEditorPropertyFromDOMNode(node);
      if (isLexicalEditor(editor)) {
        compatibleEditors++;
      } else if (editor) {
        let version = String(
          (editor.constructor as (typeof editor)['constructor'] & Record<string, unknown>)
            .version || '<0.17.1',
        );
        if (version === thisVersion) {
          version += ' (separately built, likely a bundler configuration issue)';
        }
        incompatibleEditors.add(version);
      }
    }
  }
  let output = ` Detected on the page: ${compatibleEditors} compatible editor(s) with version ${thisVersion}`;
  if (incompatibleEditors.size) {
    output += ` and incompatible editors with versions ${Array.from(incompatibleEditors).join(
      ', ',
    )}`;
  }
  return output;
}

export function internalGetActiveEditor(): LexicalEditor | null {
  return activeEditor;
}

export function internalGetActiveEditorState(): EditorState | null {
  return activeEditorState;
}

export function $applyTransforms(
  editor: LexicalEditor,
  node: LexicalNode,
  transformsCache: Map<string, Array<Transform<LexicalNode>>>,
) {
  const type = node.__type;
  const registeredNode = getRegisteredNodeOrThrow(editor, type);
  let transformsArr = transformsCache.get(type);

  if (transformsArr === undefined) {
    transformsArr = Array.from(registeredNode.transforms);
    transformsCache.set(type, transformsArr);
  }

  const transformsArrLength = transformsArr.length;

  for (let i = 0; i < transformsArrLength; i++) {
    transformsArr[i](node);

    if (!node.isAttached()) {
      break;
    }
  }
}

function $isNodeValidForTransform(node: LexicalNode, compositionKey: null | string): boolean {
  return (
    node !== undefined &&
    // We don't want to transform nodes being composed
    node.__key !== compositionKey &&
    node.isAttached()
  );
}

function $normalizeAllDirtyTextNodes(editorState: EditorState, editor: LexicalEditor): void {
  const dirtyLeaves = editor._dirtyLeaves;
  const nodeMap = editorState._nodeMap;

  for (const nodeKey of dirtyLeaves) {
    const node = nodeMap.get(nodeKey);

    if ($isTextNode(node) && node.isAttached() && node.isSimpleText() && !node.isUnmergeable()) {
      $normalizeTextNode(node);
    }
  }
}

function addTags(editor: LexicalEditor, tags: undefined | string | string[]) {
  if (!tags) {
    return;
  }
  const updateTags = editor._updateTags;
  let tags_ = tags;
  if (!Array.isArray(tags)) {
    tags_ = [tags];
  }
  for (const tag of tags_) {
    updateTags.add(tag);
  }
}

/**
 * Transform heuristic:
 * 1. We transform leaves first. If transforms generate additional dirty nodes we repeat step 1.
 * The reasoning behind this is that marking a leaf as dirty marks all its parent elements as dirty too.
 * 2. We transform elements. If element transforms generate additional dirty nodes we repeat step 1.
 * If element transforms only generate additional dirty elements we only repeat step 2.
 *
 * Note that to keep track of newly dirty nodes and subtrees we leverage the editor._dirtyNodes and
 * editor._subtrees which we reset in every loop.
 */
function $applyAllTransforms(editorState: EditorState, editor: LexicalEditor): void {
  const dirtyLeaves = editor._dirtyLeaves;
  const dirtyElements = editor._dirtyElements;
  const nodeMap = editorState._nodeMap;
  const compositionKey = $getCompositionKey();
  const transformsCache = new Map();

  let untransformedDirtyLeaves = dirtyLeaves;
  let untransformedDirtyLeavesLength = untransformedDirtyLeaves.size;
  let untransformedDirtyElements = dirtyElements;
  let untransformedDirtyElementsLength = untransformedDirtyElements.size;

  while (untransformedDirtyLeavesLength > 0 || untransformedDirtyElementsLength > 0) {
    if (untransformedDirtyLeavesLength > 0) {
      // We leverage editor._dirtyLeaves to track the new dirty leaves after the transforms
      editor._dirtyLeaves = new Set();

      for (const nodeKey of untransformedDirtyLeaves) {
        const node = nodeMap.get(nodeKey);

        if (
          $isTextNode(node) &&
          node.isAttached() &&
          node.isSimpleText() &&
          !node.isUnmergeable()
        ) {
          $normalizeTextNode(node);
        }

        if (node !== undefined && $isNodeValidForTransform(node, compositionKey)) {
          $applyTransforms(editor, node, transformsCache);
        }

        dirtyLeaves.add(nodeKey);
      }

      untransformedDirtyLeaves = editor._dirtyLeaves;
      untransformedDirtyLeavesLength = untransformedDirtyLeaves.size;

      // We want to prioritize node transforms over element transforms
      if (untransformedDirtyLeavesLength > 0) {
        infiniteTransformCount++;
        continue;
      }
    }

    // All dirty leaves have been processed. Let's do elements!
    // We have previously processed dirty leaves, so let's restart the editor leaves Set to track
    // new ones caused by element transforms
    editor._dirtyLeaves = new Set();
    editor._dirtyElements = new Map();

    // The root is always considered intentionally dirty if any attached node
    // is dirty and by deleting and re-inserting we will apply its transforms
    // last (e.g. its transform can be used as a sort of "update finalizer")
    const rootDirty = untransformedDirtyElements.delete('root');
    if (rootDirty) {
      untransformedDirtyElements.set('root', true);
    }
    for (const currentUntransformedDirtyElement of untransformedDirtyElements) {
      const nodeKey = currentUntransformedDirtyElement[0];
      const intentionallyMarkedAsDirty = currentUntransformedDirtyElement[1];
      dirtyElements.set(nodeKey, intentionallyMarkedAsDirty);
      if (!intentionallyMarkedAsDirty) {
        continue;
      }

      const node = nodeMap.get(nodeKey);

      if (node !== undefined && $isNodeValidForTransform(node, compositionKey)) {
        $applyTransforms(editor, node, transformsCache);
      }
    }

    untransformedDirtyLeaves = editor._dirtyLeaves;
    untransformedDirtyLeavesLength = untransformedDirtyLeaves.size;
    untransformedDirtyElements = editor._dirtyElements;
    untransformedDirtyElementsLength = untransformedDirtyElements.size;
    infiniteTransformCount++;
  }

  editor._dirtyLeaves = dirtyLeaves;
  editor._dirtyElements = dirtyElements;
}

type InternalSerializedNode = {
  children?: Array<InternalSerializedNode>;
  type: string;
  version: number;
};

export function $parseSerializedNode(serializedNode: SerializedLexicalNode): LexicalNode {
  const internalSerializedNode: InternalSerializedNode = serializedNode;
  return $parseSerializedNodeImpl(internalSerializedNode, getActiveEditor()._nodes);
}

function $parseSerializedNodeImpl<SerializedNode extends InternalSerializedNode>(
  serializedNode: SerializedNode,
  registeredNodes: RegisteredNodes,
): LexicalNode {
  const type = serializedNode.type;
  const registeredNode = registeredNodes.get(type);

  if (registeredNode === undefined) {
    invariant(false, 'parseEditorState: type "%s" + not found', type);
  }

  const nodeClass = registeredNode.klass;

  // @ts-expect-error not error
  if (serializedNode.type !== nodeClass.getType()) {
    invariant(false, 'LexicalNode: Node %s does not implement .importJSON().', nodeClass.name);
  }

  // @ts-expect-error not error
  const node = nodeClass.importJSON(serializedNode);
  const children = serializedNode.children;

  if ($isElementNode(node) && Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const serializedJSONChildNode = children[i];
      const childNode = $parseSerializedNodeImpl(serializedJSONChildNode, registeredNodes);
      node.append(childNode);
    }
  }

  return node;
}

export function parseEditorState(
  serializedEditorState: SerializedEditorState,
  editor: LexicalEditor,
  updateFn: void | (() => void),
): EditorState {
  const editorState = createEmptyEditorState();
  const previousActiveEditorState = activeEditorState;
  const previousReadOnlyMode = isReadOnlyMode;
  const previousActiveEditor = activeEditor;
  const previousDirtyElements = editor._dirtyElements;
  const previousDirtyLeaves = editor._dirtyLeaves;
  const previousCloneNotNeeded = editor._cloneNotNeeded;
  const previousDirtyType = editor._dirtyType;
  editor._dirtyElements = new Map();
  editor._dirtyLeaves = new Set();
  editor._cloneNotNeeded = new Set();
  editor._dirtyType = 0;
  activeEditorState = editorState;
  isReadOnlyMode = false;
  activeEditor = editor;
  setPendingNodeToClone(null);

  try {
    const registeredNodes = editor._nodes;
    const serializedNode = serializedEditorState.root;
    $parseSerializedNodeImpl(serializedNode, registeredNodes);
    if (updateFn) {
      updateFn();
    }

    // Make the editorState immutable
    editorState._readOnly = true;

    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      handleDEVOnlyPendingUpdateGuarantees(editorState);
    }
  } catch (error) {
    if (error instanceof Error) {
      editor._onError(error);
    }
  } finally {
    editor._dirtyElements = previousDirtyElements;
    editor._dirtyLeaves = previousDirtyLeaves;
    editor._cloneNotNeeded = previousCloneNotNeeded;
    editor._dirtyType = previousDirtyType;
    activeEditorState = previousActiveEditorState;
    isReadOnlyMode = previousReadOnlyMode;
    activeEditor = previousActiveEditor;
  }

  return editorState;
}

// This technically isn't an update but given we need
// exposure to the module's active bindings, we have this
// function here

export function readEditorState<V>(
  editor: LexicalEditor | null,
  editorState: EditorState,
  callbackFn: () => V,
): V {
  const previousActiveEditorState = activeEditorState;
  const previousReadOnlyMode = isReadOnlyMode;
  const previousActiveEditor = activeEditor;

  activeEditorState = editorState;
  isReadOnlyMode = true;
  activeEditor = editor;

  try {
    return callbackFn();
  } finally {
    activeEditorState = previousActiveEditorState;
    isReadOnlyMode = previousReadOnlyMode;
    activeEditor = previousActiveEditor;
  }
}

function handleDEVOnlyPendingUpdateGuarantees(pendingEditorState: EditorState): void {
  // Given we can't Object.freeze the nodeMap as it's a Map,
  // we instead replace its set, clear and delete methods.
  const nodeMap = pendingEditorState._nodeMap;

  nodeMap.set = () => {
    throw new Error('Cannot call set() on a frozen Lexical node map');
  };

  nodeMap.clear = () => {
    throw new Error('Cannot call clear() on a frozen Lexical node map');
  };

  nodeMap.delete = () => {
    throw new Error('Cannot call delete() on a frozen Lexical node map');
  };
}

export function $commitPendingUpdates(
  editor: LexicalEditor,
  recoveryEditorState?: EditorState,
): void {
  const pendingEditorState = editor._pendingEditorState;
  const rootElement = editor._rootElement;
  const shouldSkipDOM = editor._headless || rootElement === null;

  if (pendingEditorState === null) {
    return;
  }

  // ======
  // Reconciliation has started.
  // ======

  const currentEditorState = editor._editorState;
  const currentSelection = currentEditorState._selection;
  const pendingSelection = pendingEditorState._selection;
  const needsUpdate = editor._dirtyType !== NO_DIRTY_NODES;
  const previousActiveEditorState = activeEditorState;
  const previousReadOnlyMode = isReadOnlyMode;
  const previousActiveEditor = activeEditor;
  const previouslyUpdating = editor._updating;
  const observer = editor._observer;
  let mutatedNodes = null;
  editor._pendingEditorState = null;
  editor._editorState = pendingEditorState;

  if (!shouldSkipDOM && needsUpdate && observer !== null) {
    activeEditor = editor;
    activeEditorState = pendingEditorState;
    isReadOnlyMode = false;
    // We don't want updates to sync block the reconciliation.
    editor._updating = true;
    try {
      const dirtyType = editor._dirtyType;
      const dirtyElements = editor._dirtyElements;
      const dirtyLeaves = editor._dirtyLeaves;
      observer.disconnect();

      mutatedNodes = $reconcileRoot(
        currentEditorState,
        pendingEditorState,
        editor,
        dirtyType,
        dirtyElements,
        dirtyLeaves,
      );
    } catch (error) {
      // Report errors
      if (error instanceof Error) {
        editor._onError(error);
      }

      // Reset editor and restore incoming editor state to the DOM
      if (!isAttemptingToRecoverFromReconcilerError) {
        resetEditor(editor, null, rootElement, pendingEditorState);
        initMutationObserver(editor);
        editor._dirtyType = FULL_RECONCILE;
        isAttemptingToRecoverFromReconcilerError = true;
        $commitPendingUpdates(editor, currentEditorState);
        isAttemptingToRecoverFromReconcilerError = false;
      } else {
        // To avoid a possible situation of infinite loops, lets throw
        throw error;
      }

      return;
    } finally {
      observer.observe(rootElement, observerOptions);
      editor._updating = previouslyUpdating;
      activeEditorState = previousActiveEditorState;
      isReadOnlyMode = previousReadOnlyMode;
      activeEditor = previousActiveEditor;
    }
  }

  if (!pendingEditorState._readOnly) {
    pendingEditorState._readOnly = true;
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      handleDEVOnlyPendingUpdateGuarantees(pendingEditorState);
      if ($isRangeSelection(pendingSelection)) {
        Object.freeze(pendingSelection.anchor);
        Object.freeze(pendingSelection.focus);
      }
      Object.freeze(pendingSelection);
    }
  }

  const dirtyLeaves = editor._dirtyLeaves;
  const dirtyElements = editor._dirtyElements;
  const normalizedNodes = editor._normalizedNodes;
  const tags = editor._updateTags;
  const deferred = editor._deferred;
  const nodeCount = pendingEditorState._nodeMap.size;

  if (needsUpdate) {
    editor._dirtyType = NO_DIRTY_NODES;
    editor._cloneNotNeeded.clear();
    editor._dirtyLeaves = new Set();
    editor._dirtyElements = new Map();
    editor._normalizedNodes = new Set();
    editor._updateTags = new Set();
  }
  $garbageCollectDetachedDecorators(editor, pendingEditorState);

  // ======
  // Reconciliation has finished. Now update selection and trigger listeners.
  // ======

  const domSelection = shouldSkipDOM ? null : getDOMSelection(getWindow(editor));

  // Attempt to update the DOM selection, including focusing of the root element,
  // and scroll into view if needed.
  if (
    editor._editable &&
    // domSelection will be null in headless
    domSelection !== null &&
    (needsUpdate || pendingSelection === null || pendingSelection.dirty) &&
    rootElement !== null &&
    !tags.has(SKIP_DOM_SELECTION_TAG)
  ) {
    activeEditor = editor;
    activeEditorState = pendingEditorState;
    try {
      if (observer !== null) {
        observer.disconnect();
      }
      if (needsUpdate || pendingSelection === null || pendingSelection.dirty) {
        const blockCursorElement = editor._blockCursorElement;
        if (blockCursorElement !== null) {
          removeDOMBlockCursorElement(blockCursorElement, editor, rootElement);
        }
        updateDOMSelection(
          currentSelection,
          pendingSelection,
          editor,
          domSelection,
          tags,
          rootElement,
          nodeCount,
        );
      }
      updateDOMBlockCursorElement(editor, rootElement, pendingSelection);
    } finally {
      if (observer !== null) {
        observer.observe(rootElement, observerOptions);
      }
      activeEditor = previousActiveEditor;
      activeEditorState = previousActiveEditorState;
    }
  }

  if (mutatedNodes !== null) {
    triggerMutationListeners(editor, mutatedNodes, tags, dirtyLeaves, currentEditorState);
  }
  if (
    !$isRangeSelection(pendingSelection) &&
    pendingSelection !== null &&
    (currentSelection === null || !currentSelection.is(pendingSelection))
  ) {
    editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
  }
  /**
   * Capture pendingDecorators after garbage collecting detached decorators
   */
  const pendingDecorators = editor._pendingDecorators;
  if (pendingDecorators !== null) {
    editor._decorators = pendingDecorators;
    editor._pendingDecorators = null;
    triggerListeners('decorator', editor, true, pendingDecorators);
  }

  // If reconciler fails, we reset whole editor (so current editor state becomes empty)
  // and attempt to re-render pendingEditorState. If that goes through we trigger
  // listeners, but instead use recoverEditorState which is current editor state before reset
  // This specifically important for collab that relies on prevEditorState from update
  // listener to calculate delta of changed nodes/properties
  triggerTextContentListeners(
    editor,
    recoveryEditorState || currentEditorState,
    pendingEditorState,
  );
  triggerListeners('update', editor, true, {
    dirtyElements,
    dirtyLeaves,
    editorState: pendingEditorState,
    mutatedNodes,
    normalizedNodes,
    prevEditorState: recoveryEditorState || currentEditorState,
    tags,
  });
  triggerDeferredUpdateCallbacks(editor, deferred);
  $triggerEnqueuedUpdates(editor);
}

function triggerTextContentListeners(
  editor: LexicalEditor,
  currentEditorState: EditorState,
  pendingEditorState: EditorState,
): void {
  const currentTextContent = getEditorStateTextContent(currentEditorState);
  const latestTextContent = getEditorStateTextContent(pendingEditorState);

  if (currentTextContent !== latestTextContent) {
    triggerListeners('textcontent', editor, true, latestTextContent);
  }
}

function triggerMutationListeners(
  editor: LexicalEditor,
  mutatedNodes: MutatedNodes,
  updateTags: Set<string>,
  dirtyLeaves: Set<string>,
  prevEditorState: EditorState,
): void {
  const listeners = Array.from(editor._listeners.mutation);
  const listenersLength = listeners.length;

  for (let i = 0; i < listenersLength; i++) {
    const [listener, klassSet] = listeners[i];
    for (const klass of klassSet) {
      const mutatedNodesByType = mutatedNodes.get(klass);
      if (mutatedNodesByType !== undefined) {
        listener(mutatedNodesByType, {
          dirtyLeaves,
          prevEditorState,
          updateTags,
        });
      }
    }
  }
}

export function triggerListeners<T extends keyof SetListeners>(
  type: T,
  editor: LexicalEditor,
  isCurrentlyEnqueuingUpdates: boolean,
  ...payload: SetListeners[T]
): void {
  const previouslyUpdating = editor._updating;
  editor._updating = isCurrentlyEnqueuingUpdates;

  try {
    const listeners = Array.from(
      editor._listeners[type] as Set<(...args: SetListeners[T]) => void>,
    );
    for (let i = 0; i < listeners.length; i++) {
      listeners[i].apply(null, payload);
    }
  } finally {
    editor._updating = previouslyUpdating;
  }
}

export function triggerCommandListeners<TCommand extends LexicalCommand<unknown>>(
  editor: LexicalEditor,
  type: TCommand,
  payload: CommandPayloadType<TCommand>,
): boolean {
  const editors = getEditorsToPropagate(editor);

  for (let i = 4; i >= 0; i--) {
    for (let e = 0; e < editors.length; e++) {
      const currentEditor = editors[e];
      const commandListeners = currentEditor._commands;
      const listenerInPriorityOrder = commandListeners.get(type);

      if (listenerInPriorityOrder !== undefined) {
        const listenersSet = listenerInPriorityOrder[i];

        if (listenersSet !== undefined) {
          const listeners = Array.from(listenersSet);
          const listenersLength = listeners.length;

          let returnVal = false;
          updateEditorSync(currentEditor, () => {
            for (let j = 0; j < listenersLength; j++) {
              if (listeners[j](payload, editor)) {
                returnVal = true;
                return;
              }
            }
          });
          if (returnVal) {
            return returnVal;
          }
        }
      }
    }
  }

  return false;
}

function $triggerEnqueuedUpdates(editor: LexicalEditor): void {
  const queuedUpdates = editor._updates;

  if (queuedUpdates.length !== 0) {
    const queuedUpdate = queuedUpdates.shift();
    if (queuedUpdate) {
      const [updateFn, options] = queuedUpdate;
      $beginUpdate(editor, updateFn, options);
    }
  }
}

function triggerDeferredUpdateCallbacks(editor: LexicalEditor, deferred: Array<() => void>): void {
  editor._deferred = [];

  if (deferred.length !== 0) {
    const previouslyUpdating = editor._updating;
    editor._updating = true;

    try {
      for (let i = 0; i < deferred.length; i++) {
        deferred[i]();
      }
    } finally {
      editor._updating = previouslyUpdating;
    }
  }
}

function $processNestedUpdates(editor: LexicalEditor, initialSkipTransforms?: boolean): boolean {
  const queuedUpdates = editor._updates;
  let skipTransforms = initialSkipTransforms || false;

  // Updates might grow as we process them, we so we'll need
  // to handle each update as we go until the updates array is
  // empty.
  while (queuedUpdates.length !== 0) {
    const queuedUpdate = queuedUpdates.shift();
    if (queuedUpdate) {
      const [nextUpdateFn, options] = queuedUpdate;
      const pendingEditorState = editor._pendingEditorState;

      let onUpdate;

      if (options !== undefined) {
        onUpdate = options.onUpdate;

        if (options.skipTransforms) {
          skipTransforms = true;
        }
        if (options.discrete) {
          invariant(
            pendingEditorState !== null,
            'Unexpected empty pending editor state on discrete nested update',
          );
          pendingEditorState._flushSync = true;
        }

        if (onUpdate) {
          editor._deferred.push(onUpdate);
        }

        addTags(editor, options.tag);
      }

      if (pendingEditorState == null) {
        $beginUpdate(editor, nextUpdateFn, options);
      } else {
        nextUpdateFn();
      }
    }
  }

  return skipTransforms;
}

function $beginUpdate(
  editor: LexicalEditor,
  updateFn: () => void,
  options?: EditorUpdateOptions,
): void {
  const updateTags = editor._updateTags;
  let onUpdate;
  let skipTransforms = false;
  let discrete = false;

  if (options !== undefined) {
    onUpdate = options.onUpdate;
    addTags(editor, options.tag);

    skipTransforms = options.skipTransforms || false;
    discrete = options.discrete || false;
  }

  if (onUpdate) {
    editor._deferred.push(onUpdate);
  }

  const currentEditorState = editor._editorState;
  let pendingEditorState = editor._pendingEditorState;
  let editorStateWasCloned = false;

  if (pendingEditorState === null || pendingEditorState._readOnly) {
    pendingEditorState = editor._pendingEditorState = cloneEditorState(
      pendingEditorState || currentEditorState,
    );
    editorStateWasCloned = true;
  }
  pendingEditorState._flushSync = discrete;

  const previousActiveEditorState = activeEditorState;
  const previousReadOnlyMode = isReadOnlyMode;
  const previousActiveEditor = activeEditor;
  const previouslyUpdating = editor._updating;
  activeEditorState = pendingEditorState;
  isReadOnlyMode = false;
  editor._updating = true;
  activeEditor = editor;
  const headless = editor._headless || editor.getRootElement() === null;
  setPendingNodeToClone(null);

  try {
    if (editorStateWasCloned) {
      if (headless) {
        if (currentEditorState._selection !== null) {
          pendingEditorState._selection = currentEditorState._selection.clone();
        }
      } else {
        pendingEditorState._selection = $internalCreateSelection(
          editor,
          (options && options.event) || null,
        );
      }
    }

    const startingCompositionKey = editor._compositionKey;
    updateFn();
    skipTransforms = $processNestedUpdates(editor, skipTransforms);
    applySelectionTransforms(pendingEditorState, editor);

    if (editor._dirtyType !== NO_DIRTY_NODES) {
      if (skipTransforms) {
        $normalizeAllDirtyTextNodes(pendingEditorState, editor);
      } else {
        $applyAllTransforms(pendingEditorState, editor);
      }

      $processNestedUpdates(editor);
      $garbageCollectDetachedNodes(
        currentEditorState,
        pendingEditorState,
        editor._dirtyLeaves,
        editor._dirtyElements,
      );
    }

    const endingCompositionKey = editor._compositionKey;

    if (startingCompositionKey !== endingCompositionKey) {
      pendingEditorState._flushSync = true;
    }

    const pendingSelection = pendingEditorState._selection;

    if ($isRangeSelection(pendingSelection)) {
      const pendingNodeMap = pendingEditorState._nodeMap;
      const anchorKey = pendingSelection.anchor.key;
      const focusKey = pendingSelection.focus.key;

      if (
        pendingNodeMap.get(anchorKey) === undefined ||
        pendingNodeMap.get(focusKey) === undefined
      ) {
        invariant(
          false,
          'updateEditor: selection has been lost because the previously selected nodes have been removed and ' +
            "selection wasn't moved to another node. Ensure selection changes after removing/replacing a selected node.",
        );
      }
    } else if ($isNodeSelection(pendingSelection)) {
      // TODO: we should also validate node selection?
      if (pendingSelection._nodes.size === 0) {
        pendingEditorState._selection = null;
      }
    }
  } catch (error) {
    // Report errors
    if (error instanceof Error) {
      editor._onError(error);
    }

    // Restore existing editor state to the DOM
    editor._pendingEditorState = currentEditorState;
    editor._dirtyType = FULL_RECONCILE;

    editor._cloneNotNeeded.clear();

    editor._dirtyLeaves = new Set();

    editor._dirtyElements.clear();

    $commitPendingUpdates(editor);
    return;
  } finally {
    activeEditorState = previousActiveEditorState;
    isReadOnlyMode = previousReadOnlyMode;
    activeEditor = previousActiveEditor;
    editor._updating = previouslyUpdating;
    infiniteTransformCount = 0;
  }

  const shouldUpdate =
    editor._dirtyType !== NO_DIRTY_NODES ||
    editor._deferred.length > 0 ||
    editorStateHasDirtySelection(pendingEditorState, editor);

  if (shouldUpdate) {
    if (pendingEditorState._flushSync) {
      pendingEditorState._flushSync = false;
      $commitPendingUpdates(editor);
    } else if (editorStateWasCloned) {
      scheduleMicroTask(() => {
        $commitPendingUpdates(editor);
      });
    }
  } else {
    pendingEditorState._flushSync = false;

    if (editorStateWasCloned) {
      updateTags.clear();
      editor._deferred = [];
      editor._pendingEditorState = null;
    }
  }
}

/**
 * A variant of updateEditor that will not defer if it is nested in an update
 * to the same editor, much like if it was an editor.dispatchCommand issued
 * within an update
 */
export function updateEditorSync(
  editor: LexicalEditor,
  updateFn: () => void,
  options?: EditorUpdateOptions,
): void {
  if (activeEditor === editor && options === undefined) {
    updateFn();
  } else {
    $beginUpdate(editor, updateFn, options);
  }
}

export function updateEditor(
  editor: LexicalEditor,
  updateFn: () => void,
  options?: EditorUpdateOptions,
): void {
  if (editor._updating) {
    editor._updates.push([updateFn, options]);
  } else {
    $beginUpdate(editor, updateFn, options);
  }
}

export const emptyFunction = () => {
  return;
};

let pendingNodeToClone: null | LexicalNode = null;
export function setPendingNodeToClone(pendingNode: null | LexicalNode): void {
  pendingNodeToClone = pendingNode;
}
export function getPendingNodeToClone(): null | LexicalNode {
  const node = pendingNodeToClone;
  pendingNodeToClone = null;
  return node;
}

let keyCounter = 1;

export function resetRandomKey(): void {
  keyCounter = 1;
}

export function generateRandomKey(): string {
  return '' + keyCounter++;
}

/**
 * @internal
 */
export function getRegisteredNodeOrThrow(editor: LexicalEditor, nodeType: string): RegisteredNode {
  const registeredNode = getRegisteredNode(editor, nodeType);
  if (registeredNode === undefined) {
    invariant(false, 'registeredNode: Type %s not found', nodeType);
  }
  return registeredNode;
}

/**
 * @internal
 */
export function getRegisteredNode(
  editor: LexicalEditor,
  nodeType: string,
): undefined | RegisteredNode {
  return editor._nodes.get(nodeType);
}

export const isArray = Array.isArray;

export const scheduleMicroTask: (fn: () => void) => void =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn) => {
        // No window prefix intended (#1400)
        Promise.resolve().then(fn);
      };

export function $isSelectionCapturedInDecorator(node: Node): boolean {
  return $isDecoratorNode($getNearestNodeFromDOMNode(node));
}

export function isSelectionCapturedInDecoratorInput(anchorDOM: Node): boolean {
  const activeElement = document.activeElement;

  if (!isHTMLElement(activeElement)) {
    return false;
  }
  const nodeName = activeElement.nodeName;

  return (
    $isDecoratorNode($getNearestNodeFromDOMNode(anchorDOM)) &&
    (nodeName === 'INPUT' ||
      nodeName === 'TEXTAREA' ||
      (activeElement.contentEditable === 'true' &&
        getEditorPropertyFromDOMNode(activeElement) == null))
  );
}

export function isSelectionWithinEditor(
  editor: LexicalEditor,
  anchorDOM: null | Node,
  focusDOM: null | Node,
): boolean {
  const rootElement = editor.getRootElement();
  try {
    return (
      rootElement !== null &&
      rootElement.contains(anchorDOM) &&
      rootElement.contains(focusDOM) &&
      // Ignore if selection is within nested editor
      anchorDOM !== null &&
      !isSelectionCapturedInDecoratorInput(anchorDOM) &&
      getNearestEditorFromDOMNode(anchorDOM) === editor
    );
  } catch (error) {
    return false;
  }
}

/**
 * @returns true if the given argument is a LexicalEditor instance from this build of Lexical
 */
export function isLexicalEditor(editor: unknown): editor is LexicalEditor {
  // Check instanceof to prevent issues with multiple embedded Lexical installations
  return editor instanceof LexicalEditor;
}

export function getNearestEditorFromDOMNode(node: Node | null): LexicalEditor | null {
  let currentNode = node;
  while (currentNode != null) {
    const editor = getEditorPropertyFromDOMNode(currentNode);
    if (isLexicalEditor(editor)) {
      return editor;
    }
    currentNode = getParentElement(currentNode);
  }
  return null;
}

/** @internal */
export function getEditorPropertyFromDOMNode(node: Node | null): unknown {
  // @ts-expect-error: internal field
  return node ? node.__lexicalEditor : null;
}

export function getTextDirection(text: string): 'ltr' | 'rtl' | null {
  if (RTL_REGEX.test(text)) {
    return 'rtl';
  }
  if (LTR_REGEX.test(text)) {
    return 'ltr';
  }
  return null;
}

/**
 * Return true if the TextNode is a TabNode or is in token mode.
 */
export function $isTokenOrTab(node: TextNode): boolean {
  return $isTabNode(node) || node.isToken();
}

/**
 * Return true if the TextNode is a TabNode, or is in token or segmented mode.
 */
export function $isTokenOrSegmented(node: TextNode): boolean {
  return $isTokenOrTab(node) || node.isSegmented();
}

/**
 * @param node - The element being tested
 * @returns Returns true if node is an DOM Text node, false otherwise.
 */
export function isDOMTextNode(node: unknown): node is Text {
  return isDOMNode(node) && node.nodeType === DOM_TEXT_TYPE;
}

/**
 * @param node - The element being tested
 * @returns Returns true if node is an DOM Document node, false otherwise.
 */
export function isDOMDocumentNode(node: unknown): node is Document {
  return isDOMNode(node) && node.nodeType === DOM_DOCUMENT_TYPE;
}

export function getDOMTextNode(element: Node | null): Text | null {
  let node = element;
  while (node != null) {
    if (isDOMTextNode(node)) {
      return node;
    }
    node = node.firstChild;
  }
  return null;
}

export function toggleTextFormatType(
  format: number,
  type: TextFormatType,
  alignWithFormat: null | number,
): number {
  const activeFormat = TEXT_TYPE_TO_FORMAT[type];
  if (alignWithFormat !== null && (format & activeFormat) === (alignWithFormat & activeFormat)) {
    return format;
  }
  let newFormat = format ^ activeFormat;
  if (type === 'subscript') {
    newFormat &= ~TEXT_TYPE_TO_FORMAT.superscript;
  } else if (type === 'superscript') {
    newFormat &= ~TEXT_TYPE_TO_FORMAT.subscript;
  } else if (type === 'lowercase') {
    newFormat &= ~TEXT_TYPE_TO_FORMAT.uppercase;
    newFormat &= ~TEXT_TYPE_TO_FORMAT.capitalize;
  } else if (type === 'uppercase') {
    newFormat &= ~TEXT_TYPE_TO_FORMAT.lowercase;
    newFormat &= ~TEXT_TYPE_TO_FORMAT.capitalize;
  } else if (type === 'capitalize') {
    newFormat &= ~TEXT_TYPE_TO_FORMAT.lowercase;
    newFormat &= ~TEXT_TYPE_TO_FORMAT.uppercase;
  }
  return newFormat;
}

export function $isLeafNode(
  node: LexicalNode | null | undefined,
): node is TextNode | LineBreakNode | DecoratorNode<unknown> {
  return $isTextNode(node) || $isLineBreakNode(node) || $isDecoratorNode(node);
}

export function $setNodeKey(node: LexicalNode, existingKey: NodeKey | null | undefined): void {
  const pendingNode = getPendingNodeToClone();
  existingKey = existingKey || (pendingNode && pendingNode.__key);
  if (existingKey != null) {
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      errorOnNodeKeyConstructorMismatch(node, existingKey, pendingNode);
    }
    node.__key = existingKey;
    return;
  }
  errorOnReadOnly();
  errorOnInfiniteTransforms();
  const editor = getActiveEditor();
  const editorState = getActiveEditorState();
  const key = generateRandomKey();
  editorState._nodeMap.set(key, node);
  // TODO Split this function into leaf/element
  if ($isElementNode(node)) {
    editor._dirtyElements.set(key, true);
  } else {
    editor._dirtyLeaves.add(key);
  }
  editor._cloneNotNeeded.add(key);
  editor._dirtyType = HAS_DIRTY_NODES;
  node.__key = key;
}

function errorOnNodeKeyConstructorMismatch(
  node: LexicalNode,
  existingKey: NodeKey,
  pendingNode: null | LexicalNode,
) {
  const editorState = internalGetActiveEditorState();
  if (!editorState) {
    // tests expect to be able to do this kind of clone without an active editor state
    return;
  }
  const existingNode = editorState._nodeMap.get(existingKey);
  if (pendingNode) {
    invariant(
      existingKey === pendingNode.__key,
      'Lexical node with constructor %s (type %s) has an incorrect clone implementation, got %s for nodeKey when expecting %s',
      node.constructor.name,
      node.getType(),
      String(existingKey),
      pendingNode.__key,
    );
  }
  if (existingNode && existingNode.constructor !== node.constructor) {
    // Lifted condition to if statement because the inverted logic is a bit confusing
    if (node.constructor.name !== existingNode.constructor.name) {
      invariant(
        false,
        'Lexical node with constructor %s attempted to re-use key from node in active editor state with constructor %s. Keys must not be re-used when the type is changed.',
        node.constructor.name,
        existingNode.constructor.name,
      );
    } else {
      invariant(
        false,
        'Lexical node with constructor %s attempted to re-use key from node in active editor state with different constructor with the same name (possibly due to invalid Hot Module Replacement). Keys must not be re-used when the type is changed.',
        node.constructor.name,
      );
    }
  }
}

type IntentionallyMarkedAsDirtyElement = boolean;

function internalMarkParentElementsAsDirty(
  parentKey: NodeKey,
  nodeMap: NodeMap,
  dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>,
): void {
  let nextParentKey: string | null = parentKey;
  while (nextParentKey !== null) {
    if (dirtyElements.has(nextParentKey)) {
      return;
    }
    const node = nodeMap.get(nextParentKey);
    if (node === undefined) {
      break;
    }
    dirtyElements.set(nextParentKey, false);
    nextParentKey = node.__parent;
  }
}

// TODO #6031 this function or their callers have to adjust selection (i.e. insertBefore)
/**
 * Removes a node from its parent, updating all necessary pointers and links.
 * @internal
 *
 * This function is for internal use of the library.
 * Please do not use it as it may change in the future.
 */
export function removeFromParent(node: LexicalNode): void {
  const oldParent = node.getParent();
  if (oldParent !== null) {
    const writableNode = node.getWritable();
    const writableParent = oldParent.getWritable();
    const prevSibling = node.getPreviousSibling();
    const nextSibling = node.getNextSibling();

    // Store sibling keys
    const nextSiblingKey = nextSibling !== null ? nextSibling.__key : null;
    const prevSiblingKey = prevSibling !== null ? prevSibling.__key : null;

    // Get writable siblings once
    const writablePrevSibling = prevSibling !== null ? prevSibling.getWritable() : null;
    const writableNextSibling = nextSibling !== null ? nextSibling.getWritable() : null;

    // Update parent's first/last pointers
    if (prevSibling === null) {
      writableParent.__first = nextSiblingKey;
    }
    if (nextSibling === null) {
      writableParent.__last = prevSiblingKey;
    }

    // Update sibling links
    if (writablePrevSibling !== null) {
      writablePrevSibling.__next = nextSiblingKey;
    }
    if (writableNextSibling !== null) {
      writableNextSibling.__prev = prevSiblingKey;
    }

    // Clear node's links
    writableNode.__prev = null;
    writableNode.__next = null;
    writableNode.__parent = null;

    // Update parent size
    writableParent.__size--;
  }
}

// Never use this function directly! It will break
// the cloning heuristic. Instead use node.getWritable().
export function internalMarkNodeAsDirty(node: LexicalNode): void {
  errorOnInfiniteTransforms();
  const latest = node.getLatest();
  const parent = latest.__parent;
  const editorState = getActiveEditorState();
  const editor = getActiveEditor();
  const nodeMap = editorState._nodeMap;
  const dirtyElements = editor._dirtyElements;
  if (parent !== null) {
    internalMarkParentElementsAsDirty(parent, nodeMap, dirtyElements);
  }
  const key = latest.__key;
  editor._dirtyType = HAS_DIRTY_NODES;
  if ($isElementNode(node)) {
    dirtyElements.set(key, true);
  } else {
    editor._dirtyLeaves.add(key);
  }
}

export function internalMarkSiblingsAsDirty(node: LexicalNode) {
  const previousNode = node.getPreviousSibling();
  const nextNode = node.getNextSibling();
  if (previousNode !== null) {
    internalMarkNodeAsDirty(previousNode);
  }
  if (nextNode !== null) {
    internalMarkNodeAsDirty(nextNode);
  }
}

export function $setCompositionKey(compositionKey: null | NodeKey): void {
  errorOnReadOnly();
  const editor = getActiveEditor();
  const previousCompositionKey = editor._compositionKey;
  if (compositionKey !== previousCompositionKey) {
    editor._compositionKey = compositionKey;
    if (previousCompositionKey !== null) {
      const node = $getNodeByKey(previousCompositionKey);
      if (node !== null) {
        node.getWritable();
      }
    }
    if (compositionKey !== null) {
      const node = $getNodeByKey(compositionKey);
      if (node !== null) {
        node.getWritable();
      }
    }
  }
}

export function $getCompositionKey(): null | NodeKey {
  if (isCurrentlyReadOnlyMode()) {
    return null;
  }
  const editor = getActiveEditor();
  return editor._compositionKey;
}

export function $getNodeByKey<T extends LexicalNode>(
  key: NodeKey,
  _editorState?: EditorState,
): T | null {
  const editorState = _editorState || getActiveEditorState();
  const node = editorState._nodeMap.get(key) as T;
  if (node === undefined) {
    return null;
  }
  return node;
}

export function $getNodeFromDOMNode(dom: Node, editorState?: EditorState): LexicalNode | null {
  const editor = getActiveEditor();
  const key = getNodeKeyFromDOMNode(dom, editor);
  if (key !== undefined) {
    return $getNodeByKey(key, editorState);
  }
  return null;
}

export function setNodeKeyOnDOMNode(dom: Node, editor: LexicalEditor, key: NodeKey) {
  const prop = `__lexicalKey_${editor._key}`;
  (dom as Node & Record<typeof prop, NodeKey | undefined>)[prop] = key;
}

export function getNodeKeyFromDOMNode(dom: Node, editor: LexicalEditor): NodeKey | undefined {
  const prop = `__lexicalKey_${editor._key}`;
  return (dom as Node & Record<typeof prop, NodeKey | undefined>)[prop];
}

export function $getNearestNodeFromDOMNode(
  startingDOM: Node,
  editorState?: EditorState,
): LexicalNode | null {
  let dom: Node | null = startingDOM;
  while (dom != null) {
    const node = $getNodeFromDOMNode(dom, editorState);
    if (node !== null) {
      return node;
    }
    dom = getParentElement(dom);
  }
  return null;
}

export function cloneDecorators(editor: LexicalEditor): Record<NodeKey, unknown> {
  const currentDecorators = editor._decorators;
  const pendingDecorators = Object.assign({}, currentDecorators);
  editor._pendingDecorators = pendingDecorators;
  return pendingDecorators;
}

export function getEditorStateTextContent(editorState: EditorState): string {
  return editorState.read(() => $getRoot().getTextContent());
}

export function markNodesWithTypesAsDirty(editor: LexicalEditor, types: string[]): void {
  // We only need to mark nodes dirty if they were in the previous state.
  // If they aren't, then they are by definition dirty already.
  const cachedMap = getCachedTypeToNodeMap(editor.getEditorState());
  const dirtyNodeMaps: NodeMap[] = [];
  for (const type of types) {
    const nodeMap = cachedMap.get(type);
    if (nodeMap) {
      // By construction these are non-empty
      dirtyNodeMaps.push(nodeMap);
    }
  }
  // Nothing to mark dirty, no update necessary
  if (dirtyNodeMaps.length === 0) {
    return;
  }
  editor.update(
    () => {
      for (const nodeMap of dirtyNodeMaps) {
        for (const nodeKey of nodeMap.keys()) {
          // We are only concerned with nodes that are still in the latest NodeMap,
          // if they no longer exist then markDirty would raise an exception
          const latest = $getNodeByKey(nodeKey);
          if (latest) {
            latest.markDirty();
          }
        }
      }
    },
    editor._pendingEditorState === null
      ? {
          tag: HISTORY_MERGE_TAG,
        }
      : undefined,
  );
}

export function $setSelection(selection: null | BaseSelection): void {
  errorOnReadOnly();
  const editorState = getActiveEditorState();
  if (selection !== null) {
    // @ts-expect-error not error
    if (globalThis.__DEV__) {
      if (Object.isFrozen(selection)) {
        invariant(
          false,
          '$setSelection called on frozen selection object. Ensure selection is cloned before passing in.',
        );
      }
    }
    selection.dirty = true;
    selection.setCachedNodes(null);
  }
  editorState._selection = selection;
}

export function $flushMutations(): void {
  errorOnReadOnly();
  const editor = getActiveEditor();
  flushRootMutations(editor);
}

export function $getNodeFromDOM(dom: Node): null | LexicalNode {
  const editor = getActiveEditor();
  const nodeKey = getNodeKeyFromDOMTree(dom, editor);
  if (nodeKey === null) {
    const rootElement = editor.getRootElement();
    if (dom === rootElement) {
      return $getNodeByKey('root');
    }
    return null;
  }
  return $getNodeByKey(nodeKey);
}

function getNodeKeyFromDOMTree(
  // Note that node here refers to a DOM Node, not an Lexical Node
  dom: Node,
  editor: LexicalEditor,
): NodeKey | null {
  let node: Node | null = dom;
  while (node != null) {
    const key = getNodeKeyFromDOMNode(node, editor);
    if (key !== undefined) {
      return key;
    }
    node = getParentElement(node);
  }
  return null;
}

/**
 * Return true if `str` contains any valid surrogate pair.
 *
 * See also $updateCaretSelectionForUnicodeCharacter for
 * a discussion on when and why this is useful.
 */
export function doesContainSurrogatePair(str: string): boolean {
  return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(str);
}

export function getEditorsToPropagate(editor: LexicalEditor): Array<LexicalEditor> {
  const editorsToPropagate = [];
  let currentEditor: LexicalEditor | null = editor;
  while (currentEditor !== null) {
    editorsToPropagate.push(currentEditor);
    currentEditor = currentEditor._parentEditor;
  }
  return editorsToPropagate;
}

export function createUID(): string {
  return Math.random()
    .toString(36)
    .replaceAll(/[^a-z]+/g, '')
    .substring(0, 5);
}

export function getAnchorTextFromDOM(anchorNode: Node): null | string {
  return isDOMTextNode(anchorNode) ? anchorNode.nodeValue : null;
}

export function $updateSelectedTextFromDOM(
  isCompositionEnd: boolean,
  editor: LexicalEditor,
  data?: string,
): void {
  // Update the text content with the latest composition text
  const domSelection = getDOMSelection(getWindow(editor));
  if (domSelection === null) {
    return;
  }
  const anchorNode = domSelection.anchorNode;
  let { anchorOffset, focusOffset } = domSelection;
  if (anchorNode !== null) {
    let textContent = getAnchorTextFromDOM(anchorNode);
    const node = $getNearestNodeFromDOMNode(anchorNode);
    if (textContent !== null && $isTextNode(node)) {
      // Data is intentionally truthy, as we check for boolean, null and empty string.
      if (textContent === COMPOSITION_SUFFIX && data) {
        const offset = data.length;
        textContent = data;
        anchorOffset = offset;
        focusOffset = offset;
      }

      if (textContent !== null) {
        $updateTextNodeFromDOMContent(
          node,
          textContent,
          anchorOffset,
          focusOffset,
          isCompositionEnd,
        );
      }
    }
  }
}

export function $updateTextNodeFromDOMContent(
  textNode: TextNode,
  textContent: string,
  anchorOffset: null | number,
  focusOffset: null | number,
  compositionEnd: boolean,
): void {
  let node = textNode;

  if (node.isAttached() && (compositionEnd || !node.isDirty())) {
    const isComposing = node.isComposing();
    let normalizedTextContent = textContent;

    if (
      (isComposing || compositionEnd) &&
      textContent[textContent.length - 1] === COMPOSITION_SUFFIX
    ) {
      normalizedTextContent = textContent.slice(0, -1);
    }
    const prevTextContent = node.getTextContent();

    if (compositionEnd || normalizedTextContent !== prevTextContent) {
      if (normalizedTextContent === '') {
        $setCompositionKey(null);
        if (!IS_SAFARI && !IS_IOS && !IS_APPLE_WEBKIT) {
          // For composition (mainly Android), we have to remove the node on a later update
          const editor = getActiveEditor();
          setTimeout(() => {
            editor.update(() => {
              if (node.isAttached()) {
                node.remove();
              }
            });
          }, 20);
        } else {
          node.remove();
        }
        return;
      }
      const parent = node.getParent();
      const prevSelection = $getPreviousSelection();
      const prevTextContentSize = node.getTextContentSize();
      const compositionKey = $getCompositionKey();
      const nodeKey = node.getKey();

      if (
        node.isToken() ||
        (compositionKey !== null && nodeKey === compositionKey && !isComposing) ||
        // Check if character was added at the start or boundaries when not insertable, and we need
        // to clear this input from occurring as that action wasn't permitted.
        ($isRangeSelection(prevSelection) &&
          ((parent !== null &&
            !parent.canInsertTextBefore() &&
            prevSelection.anchor.offset === 0) ||
            (prevSelection.anchor.key === textNode.__key &&
              prevSelection.anchor.offset === 0 &&
              !node.canInsertTextBefore() &&
              !isComposing) ||
            (prevSelection.focus.key === textNode.__key &&
              prevSelection.focus.offset === prevTextContentSize &&
              !node.canInsertTextAfter() &&
              !isComposing)))
      ) {
        node.markDirty();
        return;
      }
      const selection = $getSelection();

      if (!$isRangeSelection(selection) || anchorOffset === null || focusOffset === null) {
        $setTextContentWithSelection(node, normalizedTextContent, selection);
        return;
      }
      selection.setTextNodeRange(node, anchorOffset, node, focusOffset);

      if (node.isSegmented()) {
        const originalTextContent = node.getTextContent();
        const replacement = $createTextNode(originalTextContent);
        node.replace(replacement);
        node = replacement;
      }
      $setTextContentWithSelection(node, normalizedTextContent, selection);
    }
  }
}

function $setTextContentWithSelection(
  node: TextNode,
  textContent: string,
  selection: BaseSelection | null,
) {
  node.setTextContent(textContent);
  if ($isRangeSelection(selection)) {
    const key = node.getKey();
    for (const k of ['anchor', 'focus'] as const) {
      const pt = selection[k];
      if (pt.type === 'text' && pt.key === key) {
        pt.offset = $getTextNodeOffset(node, pt.offset, 'clamp');
      }
    }
  }
}

function $previousSiblingDoesNotAcceptText(node: TextNode): boolean {
  const previousSibling = node.getPreviousSibling();

  return (
    ($isTextNode(previousSibling) ||
      ($isElementNode(previousSibling) && previousSibling.isInline())) &&
    !previousSibling.canInsertTextAfter()
  );
}

// This function is connected to $shouldPreventDefaultAndInsertText and determines whether the
// TextNode boundaries are writable or we should use the previous/next sibling instead. For example,
// in the case of a LinkNode, boundaries are not writable.
export function $shouldInsertTextAfterOrBeforeTextNode(
  selection: RangeSelection,
  node: TextNode,
): boolean {
  if (node.isSegmented()) {
    return true;
  }
  if (!selection.isCollapsed()) {
    return false;
  }
  const offset = selection.anchor.offset;
  const parent = node.getParentOrThrow();
  const isToken = $isTokenOrTab(node);
  if (offset === 0) {
    return (
      !node.canInsertTextBefore() ||
      (!parent.canInsertTextBefore() && !node.isComposing()) ||
      isToken ||
      $previousSiblingDoesNotAcceptText(node)
    );
  } else if (offset === node.getTextContentSize()) {
    return (
      !node.canInsertTextAfter() || (!parent.canInsertTextAfter() && !node.isComposing()) || isToken
    );
  } else {
    return false;
  }
}

/**
 * A KeyboardEvent or structurally similar object with a string `key` as well
 * as `altKey`, `ctrlKey`, `metaKey`, and `shiftKey` boolean properties.
 */
export type KeyboardEventModifiers = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'
>;

/**
 * A record of keyboard modifiers that must be enabled.
 * If the value is `'any'` then the modifier key's state is ignored.
 * If the value is `true` then the modifier key must be pressed.
 * If the value is `false` or the property is omitted then the modifier key must
 * not be pressed.
 */
export type KeyboardEventModifierMask = {
  [K in Exclude<keyof KeyboardEventModifiers, 'key'>]?: boolean | undefined | 'any';
};

function matchModifier(
  event: KeyboardEventModifiers,
  mask: KeyboardEventModifierMask,
  prop: keyof KeyboardEventModifierMask,
): boolean {
  const expected = mask[prop] || false;
  return expected === 'any' || expected === event[prop];
}

/**
 * Match a KeyboardEvent with its expected modifier state
 *
 * @param event A KeyboardEvent, or structurally similar object
 * @param mask An object specifying the expected state of the modifiers
 * @returns true if the event matches
 */
export function isModifierMatch(
  event: KeyboardEventModifiers,
  mask: KeyboardEventModifierMask,
): boolean {
  return (
    matchModifier(event, mask, 'altKey') &&
    matchModifier(event, mask, 'ctrlKey') &&
    matchModifier(event, mask, 'shiftKey') &&
    matchModifier(event, mask, 'metaKey')
  );
}

/**
 * Match a KeyboardEvent with its expected state
 *
 * @param event A KeyboardEvent, or structurally similar object
 * @param expectedKey The string to compare with event.key (case insensitive)
 * @param mask An object specifying the expected state of the modifiers
 * @returns true if the event matches
 */
export function isExactShortcutMatch(
  event: KeyboardEventModifiers,
  expectedKey: string,
  mask: KeyboardEventModifierMask,
): boolean {
  return isModifierMatch(event, mask) && event.key.toLowerCase() === expectedKey.toLowerCase();
}

const CONTROL_OR_META = { ctrlKey: !IS_APPLE, metaKey: IS_APPLE };
const CONTROL_OR_ALT = { altKey: IS_APPLE, ctrlKey: !IS_APPLE };

export function isTab(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'Tab', {
    shiftKey: 'any',
  });
}

export function isBold(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'b', CONTROL_OR_META);
}

export function isItalic(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'i', CONTROL_OR_META);
}

export function isUnderline(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'u', CONTROL_OR_META);
}

export function isParagraph(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'Enter', {
    altKey: 'any',
    ctrlKey: 'any',
    metaKey: 'any',
  });
}

export function isLineBreak(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'Enter', {
    altKey: 'any',
    ctrlKey: 'any',
    metaKey: 'any',
    shiftKey: true,
  });
}

// Inserts a new line after the selection

export function isOpenLineBreak(event: KeyboardEventModifiers): boolean {
  // 79 = KeyO
  return IS_APPLE && isExactShortcutMatch(event, 'o', { ctrlKey: true });
}

export function isDeleteWordBackward(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'Backspace', CONTROL_OR_ALT);
}

export function isDeleteWordForward(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'Delete', CONTROL_OR_ALT);
}

export function isDeleteLineBackward(event: KeyboardEventModifiers): boolean {
  return IS_APPLE && isExactShortcutMatch(event, 'Backspace', { metaKey: true });
}

export function isDeleteLineForward(event: KeyboardEventModifiers): boolean {
  return (
    IS_APPLE &&
    (isExactShortcutMatch(event, 'Delete', { metaKey: true }) ||
      isExactShortcutMatch(event, 'k', { ctrlKey: true }))
  );
}

export function isDeleteBackward(event: KeyboardEventModifiers): boolean {
  return (
    isExactShortcutMatch(event, 'Backspace', { shiftKey: 'any' }) ||
    (IS_APPLE && isExactShortcutMatch(event, 'h', { ctrlKey: true }))
  );
}

export function isDeleteForward(event: KeyboardEventModifiers): boolean {
  return (
    isExactShortcutMatch(event, 'Delete', {}) ||
    (IS_APPLE && isExactShortcutMatch(event, 'd', { ctrlKey: true }))
  );
}

export function isUndo(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'z', CONTROL_OR_META);
}

export function isRedo(event: KeyboardEventModifiers): boolean {
  if (IS_APPLE) {
    return isExactShortcutMatch(event, 'z', { metaKey: true, shiftKey: true });
  }
  return (
    isExactShortcutMatch(event, 'y', { ctrlKey: true }) ||
    isExactShortcutMatch(event, 'z', { ctrlKey: true, shiftKey: true })
  );
}

export function isCopy(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'c', CONTROL_OR_META);
}

export function isCut(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'x', CONTROL_OR_META);
}

export function isMoveBackward(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowLeft', {
    shiftKey: 'any',
  });
}

export function isMoveToStart(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowLeft', CONTROL_OR_META);
}

export function isMoveForward(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowRight', {
    shiftKey: 'any',
  });
}

export function isMoveToEnd(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowRight', CONTROL_OR_META);
}

export function isMoveUp(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowUp', {
    altKey: 'any',
    shiftKey: 'any',
  });
}

export function isMoveDown(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'ArrowDown', {
    altKey: 'any',
    shiftKey: 'any',
  });
}

export function isModifier(event: KeyboardEventModifiers): boolean {
  return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
}

export function isSpace(event: KeyboardEventModifiers): boolean {
  return event.key === ' ';
}

export function controlOrMeta(metaKey: boolean, ctrlKey: boolean): boolean {
  if (IS_APPLE) {
    return metaKey;
  }
  return ctrlKey;
}

export function isBackspace(event: KeyboardEventModifiers): boolean {
  return event.key === 'Backspace';
}

export function isEscape(event: KeyboardEventModifiers): boolean {
  return event.key === 'Escape';
}

export function isDelete(event: KeyboardEventModifiers): boolean {
  return event.key === 'Delete';
}

export function isSelectAll(event: KeyboardEventModifiers): boolean {
  return isExactShortcutMatch(event, 'a', CONTROL_OR_META);
}

export function $selectAll(selection?: RangeSelection | null): RangeSelection {
  const root = $getRoot();

  if ($isRangeSelection(selection)) {
    const anchor = selection.anchor;
    const focus = selection.focus;
    const anchorNode = anchor.getNode();
    const topParent = anchorNode.getTopLevelElementOrThrow();
    const rootNode = topParent.getParentOrThrow();
    anchor.set(rootNode.getKey(), 0, 'element');
    focus.set(rootNode.getKey(), rootNode.getChildrenSize(), 'element');
    $normalizeSelection(selection);
    return selection;
  } else {
    // Create a new RangeSelection
    const newSelection = root.select(0, root.getChildrenSize());
    $setSelection($normalizeSelection(newSelection));
    return newSelection;
  }
}

export function getCachedClassNameArray(
  classNamesTheme: EditorThemeClasses,
  classNameThemeType: string,
): Array<string> {
  if (classNamesTheme.__lexicalClassNameCache === undefined) {
    classNamesTheme.__lexicalClassNameCache = {};
  }
  const classNamesCache = classNamesTheme.__lexicalClassNameCache;
  const cachedClassNames = classNamesCache[classNameThemeType];
  if (cachedClassNames !== undefined) {
    return cachedClassNames;
  }
  const classNames = classNamesTheme[classNameThemeType];
  // As we're using classList, we need
  // to handle className tokens that have spaces.
  // The easiest way to do this to convert the
  // className tokens to an array that can be
  // applied to classList.add()/remove().
  if (typeof classNames === 'string') {
    const classNamesArr = normalizeClassNames(classNames);
    classNamesCache[classNameThemeType] = classNamesArr;
    return classNamesArr;
  }
  return classNames;
}

export function setMutatedNode(
  mutatedNodes: MutatedNodes,
  registeredNodes: RegisteredNodes,
  mutationListeners: MutationListeners,
  node: LexicalNode,
  mutation: NodeMutation,
) {
  if (mutationListeners.size === 0) {
    return;
  }
  const nodeType = node.__type;
  const nodeKey = node.__key;
  const registeredNode = registeredNodes.get(nodeType);
  if (registeredNode === undefined) {
    invariant(false, 'Type %s not in registeredNodes', nodeType);
  }
  const klass = registeredNode.klass;
  let mutatedNodesByType = mutatedNodes.get(klass);
  if (mutatedNodesByType === undefined) {
    mutatedNodesByType = new Map();
    mutatedNodes.set(klass, mutatedNodesByType);
  }
  const prevMutation = mutatedNodesByType.get(nodeKey);
  // If the node has already been "destroyed", yet we are
  // re-making it, then this means a move likely happened.
  // We should change the mutation to be that of "updated"
  // instead.
  const isMove = prevMutation === 'destroyed' && mutation === 'created';
  if (prevMutation === undefined || isMove) {
    mutatedNodesByType.set(nodeKey, isMove ? 'updated' : mutation);
  }
}
/**
 * @deprecated Use {@link LexicalEditor.registerMutationListener} with `skipInitialization: false` instead.
 */
export function $nodesOfType<T extends LexicalNode>(klass: Klass<T>): Array<T> {
  // @ts-expect-error not error
  const klassType = klass.getType();
  const editorState = getActiveEditorState();
  if (editorState._readOnly) {
    const nodes = getCachedTypeToNodeMap(editorState).get(klassType) as undefined | Map<string, T>;
    return nodes ? Array.from(nodes.values()) : [];
  }
  const nodes = editorState._nodeMap;
  const nodesOfType: Array<T> = [];
  for (const [, node] of nodes) {
    if (node instanceof klass && node.__type === klassType && node.isAttached()) {
      nodesOfType.push(node as T);
    }
  }
  return nodesOfType;
}

function resolveElement(
  element: ElementNode,
  isBackward: boolean,
  focusOffset: number,
): LexicalNode | null {
  const parent = element.getParent();
  let offset = focusOffset;
  let block = element;
  if (parent !== null) {
    if (isBackward && focusOffset === 0) {
      offset = block.getIndexWithinParent();
      block = parent;
    } else if (!isBackward && focusOffset === block.getChildrenSize()) {
      offset = block.getIndexWithinParent() + 1;
      block = parent;
    }
  }
  return block.getChildAtIndex(isBackward ? offset - 1 : offset);
}

export function $getAdjacentNode(focus: PointType, isBackward: boolean): null | LexicalNode {
  const focusOffset = focus.offset;
  if (focus.type === 'element') {
    const block = focus.getNode();
    return resolveElement(block, isBackward, focusOffset);
  } else {
    const focusNode = focus.getNode();
    if (
      (isBackward && focusOffset === 0) ||
      (!isBackward && focusOffset === focusNode.getTextContentSize())
    ) {
      const possibleNode = isBackward ? focusNode.getPreviousSibling() : focusNode.getNextSibling();
      if (possibleNode === null) {
        return resolveElement(
          focusNode.getParentOrThrow(),
          isBackward,
          focusNode.getIndexWithinParent() + (isBackward ? 0 : 1),
        );
      }
      return possibleNode;
    }
  }
  return null;
}

export function isFirefoxClipboardEvents(editor: LexicalEditor): boolean {
  const event = getWindow(editor).event;
  const inputType = event && (event as InputEvent).inputType;
  return inputType === 'insertFromPaste' || inputType === 'insertFromPasteAsQuotation';
}

export function dispatchCommand<TCommand extends LexicalCommand<unknown>>(
  editor: LexicalEditor,
  command: TCommand,
  payload: CommandPayloadType<TCommand>,
): boolean {
  return triggerCommandListeners(editor, command, payload);
}

export function $textContentRequiresDoubleLinebreakAtEnd(node: ElementNode): boolean {
  return !$isRootNode(node) && !node.isLastChild() && !node.isInline();
}

export function getElementByKeyOrThrow(editor: LexicalEditor, key: NodeKey): HTMLElement {
  const element = editor._keyToDOMMap.get(key);

  if (element === undefined) {
    invariant(false, 'Reconciliation: could not find DOM element for node key %s', key);
  }

  return element;
}

export function getParentElement(node: Node): HTMLElement | null {
  const parentElement = (node as HTMLSlotElement).assignedSlot || node.parentElement;
  return isDocumentFragment(parentElement)
    ? ((parentElement as unknown as ShadowRoot).host as HTMLElement)
    : parentElement;
}

export function getDOMOwnerDocument(target: EventTarget | null): Document | null {
  return isDOMDocumentNode(target) ? target : isHTMLElement(target) ? target.ownerDocument : null;
}

export function scrollIntoViewIfNeeded(
  editor: LexicalEditor,
  selectionRect: DOMRect,
  rootElement: HTMLElement,
): void {
  const doc = getDOMOwnerDocument(rootElement);
  const defaultView = getDefaultView(doc);

  if (doc === null || defaultView === null) {
    return;
  }
  let { top: currentTop, bottom: currentBottom } = selectionRect;
  let targetTop = 0;
  let targetBottom = 0;
  let element: HTMLElement | null = rootElement;

  while (element !== null) {
    const isBodyElement = element === doc.body;
    if (isBodyElement) {
      targetTop = 0;
      targetBottom = getWindow(editor).innerHeight;
    } else {
      const targetRect = element.getBoundingClientRect();
      targetTop = targetRect.top;
      targetBottom = targetRect.bottom;
    }
    let diff = 0;

    if (currentTop < targetTop) {
      diff = -(targetTop - currentTop);
    } else if (currentBottom > targetBottom) {
      diff = currentBottom - targetBottom;
    }

    if (diff !== 0) {
      if (isBodyElement) {
        // Only handles scrolling of Y axis
        defaultView.scrollBy(0, diff);
      } else {
        const scrollTop = element.scrollTop;
        element.scrollTop += diff;
        const yOffset = element.scrollTop - scrollTop;
        currentTop -= yOffset;
        currentBottom -= yOffset;
      }
    }
    if (isBodyElement) {
      break;
    }
    element = getParentElement(element);
  }
}

export function $hasUpdateTag(tag: UpdateTag): boolean {
  const editor = getActiveEditor();
  return editor._updateTags.has(tag);
}

export function $addUpdateTag(tag: UpdateTag): void {
  errorOnReadOnly();
  const editor = getActiveEditor();
  editor._updateTags.add(tag);
}

/**
 * Add a function to run after the current update. This will run after any
 * `onUpdate` function already supplied to `editor.update()`, as well as any
 * functions added with previous calls to `$onUpdate`.
 *
 * @param updateFn The function to run after the current update.
 */
export function $onUpdate(updateFn: () => void): void {
  errorOnReadOnly();
  const editor = getActiveEditor();
  editor._deferred.push(updateFn);
}

export function $maybeMoveChildrenSelectionToParent(parentNode: LexicalNode): BaseSelection | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !$isElementNode(parentNode)) {
    return selection;
  }
  const { anchor, focus } = selection;
  const anchorNode = anchor.getNode();
  const focusNode = focus.getNode();
  if ($hasAncestor(anchorNode, parentNode)) {
    anchor.set(parentNode.__key, 0, 'element');
  }
  if ($hasAncestor(focusNode, parentNode)) {
    focus.set(parentNode.__key, 0, 'element');
  }
  return selection;
}

export function $hasAncestor(child: LexicalNode, targetNode: LexicalNode): boolean {
  let parent = child.getParent();
  while (parent !== null) {
    if (parent.is(targetNode)) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

export function getDefaultView(domElem: EventTarget | null): Window | null {
  const ownerDoc = getDOMOwnerDocument(domElem);
  return ownerDoc ? ownerDoc.defaultView : null;
}

export function getWindow(editor: LexicalEditor): Window {
  const windowObj = editor._window;
  if (windowObj === null) {
    invariant(false, 'window object not found');
  }
  return windowObj;
}

export function $isInlineElementOrDecoratorNode(node: LexicalNode): boolean {
  return ($isElementNode(node) && node.isInline()) || ($isDecoratorNode(node) && node.isInline());
}

export function $getNearestRootOrShadowRoot(node: LexicalNode): RootNode | ElementNode {
  let parent = node.getParentOrThrow();
  while (parent !== null) {
    if ($isRootOrShadowRoot(parent)) {
      return parent;
    }
    parent = parent.getParentOrThrow();
  }
  return parent;
}

/**
 * Returns a shallow clone of node with a new key. All properties of the node
 * will be copied to the new node (by `clone` and then `afterCloneFrom`),
 * except those related to parent/sibling/child
 * relationships in the `EditorState`. This means that the copy must be
 * separately added to the document, and it will not have any children.
 *
 * @param node - The node to be copied.
 * @returns The copy of the node.
 */
export function $copyNode<T extends LexicalNode>(node: T): T {
  // @ts-expect-error not error
  const copy = node.constructor.clone(node) as T;
  $setNodeKey(copy, null);
  copy.afterCloneFrom(node);
  return copy;
}

export function $applyNodeReplacement<N extends LexicalNode>(node: N): N {
  const editor = getActiveEditor();
  const nodeType = node.getType();
  const registeredNode = getRegisteredNode(editor, nodeType);
  invariant(
    registeredNode !== undefined,
    '$applyNodeReplacement node %s with type %s must be registered to the editor. You can do this by passing the node class via the "nodes" array in the editor config.',
    node.constructor.name,
    nodeType,
  );
  const { replace, replaceWithKlass } = registeredNode;
  if (replace !== null) {
    const replacementNode = replace(node);
    const replacementNodeKlass = replacementNode.constructor;
    if (replaceWithKlass !== null) {
      invariant(
        replacementNode instanceof replaceWithKlass,
        '$applyNodeReplacement failed. Expected replacement node to be an instance of %s with type %s but returned %s with type %s from original node %s with type %s',
        replaceWithKlass.name,
        // @ts-expect-error not error
        replaceWithKlass.getType(),
        replacementNodeKlass.name,
        // @ts-expect-error not error
        replacementNodeKlass.getType(),
        node.constructor.name,
        nodeType,
      );
    } else {
      invariant(
        replacementNode instanceof node.constructor && replacementNodeKlass !== node.constructor,
        '$applyNodeReplacement failed. Ensure replacement node %s with type %s is a subclass of the original node %s with type %s.',
        replacementNodeKlass.name,
        // @ts-expect-error not error
        replacementNodeKlass.getType(),
        node.constructor.name,
        nodeType,
      );
    }
    invariant(
      replacementNode.__key !== node.__key,
      '$applyNodeReplacement failed. Ensure that the key argument is *not* used in your replace function (from node %s with type %s to node %s with type %s), Node keys must never be re-used except by the static clone method.',
      node.constructor.name,
      nodeType,
      replacementNodeKlass.name,
      // @ts-expect-error not error
      replacementNodeKlass.getType(),
    );
    return replacementNode as N;
  }
  return node;
}

export function errorOnInsertTextNodeOnRoot(node: LexicalNode, insertNode: LexicalNode): void {
  const parentNode = node.getParent();
  if ($isRootNode(parentNode) && !$isElementNode(insertNode) && !$isDecoratorNode(insertNode)) {
    invariant(false, 'Only element or decorator nodes can be inserted in to the root node');
  }
}

export function $getNodeByKeyOrThrow<N extends LexicalNode>(key: NodeKey): N {
  const node = $getNodeByKey<N>(key);
  if (node === null) {
    invariant(false, "Expected node with key %s to exist but it's not in the nodeMap.", key);
  }
  return node;
}

function createBlockCursorElement(editorConfig: EditorConfig): HTMLDivElement {
  const theme = editorConfig.theme;
  const element = document.createElement('div');
  element.contentEditable = 'false';
  element.setAttribute('data-lexical-cursor', 'true');
  let blockCursorTheme = theme.blockCursor;
  if (blockCursorTheme !== undefined) {
    if (typeof blockCursorTheme === 'string') {
      const classNamesArr = normalizeClassNames(blockCursorTheme);
      // @ts-expect-error: intentional
      blockCursorTheme = theme.blockCursor = classNamesArr;
    }
    if (blockCursorTheme !== undefined) {
      element.classList.add(...blockCursorTheme);
    }
  }
  return element;
}

function needsBlockCursor(node: null | LexicalNode): boolean {
  return (
    ($isDecoratorNode(node) || ($isElementNode(node) && !node.canBeEmpty())) && !node.isInline()
  );
}

export function removeDOMBlockCursorElement(
  blockCursorElement: HTMLElement,
  editor: LexicalEditor,
  rootElement: HTMLElement,
) {
  rootElement.style.removeProperty('caret-color');
  editor._blockCursorElement = null;
  const parentElement = blockCursorElement.parentElement;
  if (parentElement !== null) {
    parentElement.removeChild(blockCursorElement);
  }
}

export function updateDOMBlockCursorElement(
  editor: LexicalEditor,
  rootElement: HTMLElement,
  nextSelection: null | BaseSelection,
): void {
  let blockCursorElement = editor._blockCursorElement;

  if (
    $isRangeSelection(nextSelection) &&
    nextSelection.isCollapsed() &&
    nextSelection.anchor.type === 'element' &&
    rootElement.contains(document.activeElement)
  ) {
    const anchor = nextSelection.anchor;
    const elementNode = anchor.getNode();
    const offset = anchor.offset;
    const elementNodeSize = elementNode.getChildrenSize();
    let isBlockCursor = false;
    let insertBeforeElement: null | HTMLElement = null;

    if (offset === elementNodeSize) {
      const child = elementNode.getChildAtIndex(offset - 1);
      if (needsBlockCursor(child)) {
        isBlockCursor = true;
      }
    } else {
      const child = elementNode.getChildAtIndex(offset);
      if (child !== null && needsBlockCursor(child)) {
        const sibling = child.getPreviousSibling();
        if (sibling === null || needsBlockCursor(sibling)) {
          isBlockCursor = true;
          insertBeforeElement = editor.getElementByKey(child.__key);
        }
      }
    }
    if (isBlockCursor) {
      const elementDOM = editor.getElementByKey(elementNode.__key) as HTMLElement;
      if (blockCursorElement === null) {
        editor._blockCursorElement = blockCursorElement = createBlockCursorElement(editor._config);
      }
      rootElement.style.caretColor = 'transparent';
      if (insertBeforeElement === null) {
        elementDOM.appendChild(blockCursorElement);
      } else {
        elementDOM.insertBefore(blockCursorElement, insertBeforeElement);
      }
      return;
    }
  }
  // Remove cursor
  if (blockCursorElement !== null) {
    removeDOMBlockCursorElement(blockCursorElement, editor, rootElement);
  }
}

/**
 * Returns the selection for the given window, or the global window if null.
 * Will return null if {@link CAN_USE_DOM} is false.
 *
 * @param targetWindow The window to get the selection from
 * @returns a Selection or null
 */
export function getDOMSelection(targetWindow: null | Window): null | Selection {
  return !CAN_USE_DOM ? null : (targetWindow || window).getSelection();
}

/**
 * Returns the selection for the defaultView of the ownerDocument of given EventTarget.
 *
 * @param eventTarget The node to get the selection from
 * @returns a Selection or null
 */
export function getDOMSelectionFromTarget(eventTarget: null | EventTarget): null | Selection {
  const defaultView = getDefaultView(eventTarget);
  return defaultView ? defaultView.getSelection() : null;
}

export function $splitNode(node: ElementNode, offset: number): [ElementNode | null, ElementNode] {
  let startNode = node.getChildAtIndex(offset);
  if (startNode == null) {
    startNode = node;
  }

  invariant(!$isRootOrShadowRoot(node), 'Can not call $splitNode() on root element');

  const recurse = <T extends LexicalNode>(currentNode: T): [ElementNode, ElementNode, T] => {
    const parent = currentNode.getParentOrThrow();
    const isParentRoot = $isRootOrShadowRoot(parent);
    // The node we start split from (leaf) is moved, but its recursive
    // parents are copied to create separate tree
    const nodeToMove =
      currentNode === startNode && !isParentRoot ? currentNode : $copyNode(currentNode);

    if (isParentRoot) {
      invariant(
        $isElementNode(currentNode) && $isElementNode(nodeToMove),
        'Children of a root must be ElementNode',
      );

      currentNode.insertAfter(nodeToMove);
      return [currentNode, nodeToMove, nodeToMove];
    } else {
      const [leftTree, rightTree, newParent] = recurse(parent);
      const nextSiblings = currentNode.getNextSiblings();

      newParent.append(nodeToMove, ...nextSiblings);
      return [leftTree, rightTree, nodeToMove];
    }
  };

  const [leftTree, rightTree] = recurse(startNode);

  return [leftTree, rightTree];
}

export function $findMatchingParent(
  startingNode: LexicalNode,
  findFn: (node: LexicalNode) => boolean,
): LexicalNode | null {
  let curr: ElementNode | LexicalNode | null = startingNode;

  while (curr !== $getRoot() && curr != null) {
    if (findFn(curr)) {
      return curr;
    }

    curr = curr.getParent();
  }

  return null;
}

/**
 * @param x - The element being tested
 * @returns Returns true if x is an HTML anchor tag, false otherwise
 */
export function isHTMLAnchorElement(x: unknown): x is HTMLAnchorElement {
  return isHTMLElement(x) && x.tagName === 'A';
}

/**
 * @param x - The element being tested
 * @returns Returns true if x is an HTML element, false otherwise.
 */
export function isHTMLElement(x: unknown): x is HTMLElement {
  return isDOMNode(x) && x.nodeType === DOM_ELEMENT_TYPE;
}

/**
 * @param x - The element being tested
 * @returns Returns true if x is a DOM Node, false otherwise.
 */
export function isDOMNode(x: unknown): x is Node {
  return typeof x === 'object' && x !== null && 'nodeType' in x && typeof x.nodeType === 'number';
}

/**
 * @param x - The element being testing
 * @returns Returns true if x is a document fragment, false otherwise.
 */
export function isDocumentFragment(x: unknown): x is DocumentFragment {
  return isDOMNode(x) && x.nodeType === DOM_DOCUMENT_FRAGMENT_TYPE;
}

/**
 *
 * @param node - the Dom Node to check
 * @returns if the Dom Node is an inline node
 */
export function isInlineDomNode(node: Node) {
  const inlineNodes = new RegExp(
    /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/,
    'i',
  );
  return node.nodeName.match(inlineNodes) !== null;
}

/**
 *
 * @param node - the Dom Node to check
 * @returns if the Dom Node is a block node
 */
export function isBlockDomNode(node: Node) {
  const blockNodes = new RegExp(
    /^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/,
    'i',
  );
  return node.nodeName.match(blockNodes) !== null;
}

/**
 * @internal
 *
 * This function is for internal use of the library.
 * Please do not use it as it may change in the future.
 *
 * This function returns true for a DecoratorNode that is not inline OR
 * an ElementNode that is:
 * - not a root or shadow root
 * - not inline
 * - can't be empty
 * - has no children or an inline first child
 */
export function INTERNAL_$isBlock(node: LexicalNode): node is ElementNode | DecoratorNode<unknown> {
  if ($isDecoratorNode(node) && !node.isInline()) {
    return true;
  }
  if (!$isElementNode(node) || $isRootOrShadowRoot(node)) {
    return false;
  }

  const firstChild = node.getFirstChild();
  const isLeafElement =
    firstChild === null ||
    $isLineBreakNode(firstChild) ||
    $isTextNode(firstChild) ||
    firstChild.isInline();

  return !node.isInline() && node.canBeEmpty() !== false && isLeafElement;
}

export function $getAncestor<NodeType extends LexicalNode = LexicalNode>(
  node: LexicalNode,
  predicate: (ancestor: LexicalNode) => ancestor is NodeType,
): NodeType | null {
  let parent = node;
  while (parent !== null && parent.getParent() !== null && !predicate(parent)) {
    parent = parent.getParentOrThrow();
  }
  return predicate(parent) ? parent : null;
}

/**
 * Utility function for accessing current active editor instance.
 * @returns Current active editor
 */
export function $getEditor(): LexicalEditor {
  return getActiveEditor();
}

/** @internal */
export type TypeToNodeMap = Map<string, NodeMap>;
/**
 * @internal
 * Compute a cached Map of node type to nodes for a frozen EditorState
 */
const cachedNodeMaps = new WeakMap<EditorState, TypeToNodeMap>();
const EMPTY_TYPE_TO_NODE_MAP: TypeToNodeMap = new Map();
export function getCachedTypeToNodeMap(editorState: EditorState): TypeToNodeMap {
  // If this is a new Editor it may have a writable this._editorState
  // with only a 'root' entry.
  if (!editorState._readOnly && editorState.isEmpty()) {
    return EMPTY_TYPE_TO_NODE_MAP;
  }
  invariant(editorState._readOnly, 'getCachedTypeToNodeMap called with a writable EditorState');
  let typeToNodeMap = cachedNodeMaps.get(editorState);
  if (!typeToNodeMap) {
    typeToNodeMap = computeTypeToNodeMap(editorState);
    cachedNodeMaps.set(editorState, typeToNodeMap);
  }
  return typeToNodeMap;
}

/**
 * @internal
 * Compute a Map of node type to nodes for an EditorState
 */
function computeTypeToNodeMap(editorState: EditorState): TypeToNodeMap {
  const typeToNodeMap = new Map();
  for (const [nodeKey, node] of editorState._nodeMap) {
    const nodeType = node.__type;
    let nodeMap = typeToNodeMap.get(nodeType);
    if (!nodeMap) {
      nodeMap = new Map();
      typeToNodeMap.set(nodeType, nodeMap);
    }
    nodeMap.set(nodeKey, node);
  }
  return typeToNodeMap;
}

/**
 * Returns a clone of a node using `node.constructor.clone()` followed by
 * `clone.afterCloneFrom(node)`. The resulting clone must have the same key,
 * parent/next/prev pointers, and other properties that are not set by
 * `node.constructor.clone` (format, style, etc.). This is primarily used by
 * {@link LexicalNode.getWritable} to create a writable version of an
 * existing node. The clone is the same logical node as the original node,
 * do not try and use this function to duplicate or copy an existing node.
 *
 * Does not mutate the EditorState.
 * @param latestNode - The node to be cloned.
 * @returns The clone of the node.
 */
export function $cloneWithProperties<T extends LexicalNode>(latestNode: T): T {
  const constructor = latestNode.constructor;
  // @ts-expect-error not error
  const mutableNode = constructor.clone(latestNode) as T;
  mutableNode.afterCloneFrom(latestNode);
  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    invariant(
      mutableNode.__key === latestNode.__key,
      "$cloneWithProperties: %s.clone(node) (with type '%s') did not return a node with the same key, make sure to specify node.__key as the last argument to the constructor",
      constructor.name,
      // @ts-expect-error not error
      constructor.getType(),
    );
    invariant(
      mutableNode.__parent === latestNode.__parent &&
        mutableNode.__next === latestNode.__next &&
        mutableNode.__prev === latestNode.__prev,
      "$cloneWithProperties: %s.clone(node) (with type '%s') overrode afterCloneFrom but did not call super.afterCloneFrom(prevNode)",
      constructor.name,
      // @ts-expect-error not error
      constructor.getType(),
    );
  }
  return mutableNode;
}

export function setNodeIndentFromDOM(elementDom: HTMLElement, elementNode: ElementNode) {
  const indentSize = parseInt(elementDom.style.paddingInlineStart, 10) || 0;
  const indent = Math.round(indentSize / 40);
  elementNode.setIndent(indent);
}

/**
 * @internal
 *
 * Mark this node as unmanaged by lexical's mutation observer like
 * decorator nodes
 */
export function setDOMUnmanaged(elementDom: HTMLElement): void {
  const el: HTMLElement & LexicalPrivateDOM = elementDom;
  el.__lexicalUnmanaged = true;
}

/**
 * @internal
 *
 * True if this DOM node was marked with {@link setDOMUnmanaged}
 */
export function isDOMUnmanaged(elementDom: Node): boolean {
  const el: Node & LexicalPrivateDOM = elementDom;
  return el.__lexicalUnmanaged === true;
}

/**
 * @internal
 *
 * Object.hasOwn ponyfill
 */
function hasOwn(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/**
 * @internal
 */
export function hasOwnStaticMethod(
  klass: Klass<LexicalNode>,
  k: keyof Klass<LexicalNode>,
): boolean {
  // @ts-expect-error not error
  return hasOwn(klass, k) && klass[k] !== LexicalNode[k];
}

/**
 * @internal
 */
export function hasOwnExportDOM(klass: Klass<LexicalNode>) {
  return hasOwn(klass.prototype, 'exportDOM');
}

/** @internal */
function isAbstractNodeClass(klass: Klass<LexicalNode>): boolean {
  return klass === DecoratorNode || klass === ElementNode || klass === LexicalNode;
}

/** @internal */
export function getStaticNodeConfig(klass: Klass<LexicalNode>): {
  ownNodeType: undefined | string;
  ownNodeConfig: undefined | StaticNodeConfigValue<LexicalNode, string>;
} {
  const nodeConfigRecord =
    PROTOTYPE_CONFIG_METHOD in klass.prototype
      ? klass.prototype[PROTOTYPE_CONFIG_METHOD]()
      : undefined;
  const isAbstract = isAbstractNodeClass(klass);
  const nodeType =
    // @ts-expect-error not error
    !isAbstract && hasOwnStaticMethod(klass, 'getType')
      ? // @ts-expect-error not error
        klass.getType()
      : undefined;
  let ownNodeConfig: undefined | StaticNodeConfigValue<LexicalNode, string>;
  let ownNodeType = nodeType;
  if (nodeConfigRecord) {
    if (nodeType) {
      ownNodeConfig = nodeConfigRecord[nodeType];
    } else {
      for (const [k, v] of Object.entries(nodeConfigRecord)) {
        ownNodeType = k;
        // @ts-expect-error not error
        ownNodeConfig = v;
      }
    }
  }
  if (!isAbstract && ownNodeType) {
    // @ts-expect-error not error
    if (!hasOwnStaticMethod(klass, 'getType')) {
      // @ts-expect-error not error
      klass.getType = () => ownNodeType;
    }
    // @ts-expect-error not error
    if (!hasOwnStaticMethod(klass, 'clone')) {
      // TextNode.length > 0 will only be true if the compiler output
      // is not ES6 compliant, in which case we can not provide this
      // warning
      // @ts-expect-error not error
      if (globalThis.__DEV__ && TextNode.length === 0) {
        invariant(
          klass.length === 0,
          '%s (type %s) must implement a static clone method since its constructor has %s required arguments (expecting 0). Use an explicit default in the first argument of your constructor(prop: T=X, nodeKey?: NodeKey).',
          klass.name,
          ownNodeType,
          String(klass.length),
        );
      }
      // @ts-expect-error not error
      klass.clone = (prevNode: LexicalNode) => {
        setPendingNodeToClone(prevNode);
        // @ts-expect-error not error
        return new klass();
      };
    }
    // @ts-expect-error not error
    if (!hasOwnStaticMethod(klass, 'importJSON')) {
      // @ts-expect-error not error
      if (globalThis.__DEV__ && TextNode.length === 0) {
        invariant(
          klass.length === 0,
          '%s (type %s) must implement a static importJSON method since its constructor has %s required arguments (expecting 0). Use an explicit default in the first argument of your constructor(prop: T=X, nodeKey?: NodeKey).',
          klass.name,
          ownNodeType,
          String(klass.length),
        );
      }
      // @ts-expect-error not error
      klass.importJSON =
        (ownNodeConfig && ownNodeConfig.$importJSON) ||
        // @ts-expect-error not error
        ((serializedNode) => new klass().updateFromJSON(serializedNode));
    }
    // @ts-expect-error not error
    if (!hasOwnStaticMethod(klass, 'importDOM') && ownNodeConfig) {
      const { importDOM } = ownNodeConfig;
      if (importDOM) {
        // @ts-expect-error not error
        klass.importDOM = () => importDOM;
      }
    }
  }
  return { ownNodeConfig, ownNodeType };
}

/**
 * Create an node from its class.
 *
 * Note that this will directly construct the final `withKlass` node type,
 * and will ignore the deprecated `with` functions. This allows `$create` to
 * skip any intermediate steps where the replaced node would be created and
 * then immediately discarded (once per configured replacement of that node).
 *
 * This does not support any arguments to the constructor.
 * Setters can be used to initialize your node, and they can
 * be chained. You can of course write your own mutliple-argument functions
 * to wrap that.
 *
 * @example
 * ```ts
 * function $createTokenText(text: string): TextNode {
 *   return $create(TextNode).setTextContent(text).setMode('token');
 * }
 * ```
 */
export function $create<T extends LexicalNode>(klass: Klass<T>): T {
  const editor = $getEditor();
  errorOnReadOnly();
  const registeredNode = editor.resolveRegisteredNodeAfterReplacements(
    editor.getRegisteredNode(klass),
  );
  // @ts-expect-error not error
  return new registeredNode.klass() as T;
}

export type SerializedElementNode<T extends SerializedLexicalNode = SerializedLexicalNode> = Spread<
  {
    children: Array<T>;
    direction: 'ltr' | 'rtl' | null;
    format: ElementFormatType;
    indent: number;
    textFormat?: number;
    textStyle?: string;
  },
  SerializedLexicalNode
>;

export type ElementFormatType = 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ElementNode {
  getTopLevelElement(): ElementNode | null;
  getTopLevelElementOrThrow(): ElementNode;
}

/**
 * A utility class for managing the DOM children of an ElementNode
 */
export class ElementDOMSlot<T extends HTMLElement = HTMLElement> {
  readonly element: T;
  readonly before: Node | null;
  readonly after: Node | null;
  constructor(
    /** The element returned by createDOM */
    element: T,
    /** All managed children will be inserted before this node, if defined */
    before?: Node | undefined | null,
    /** All managed children will be inserted after this node, if defined */
    after?: Node | undefined | null,
  ) {
    this.element = element;
    this.before = before || null;
    this.after = after || null;
  }
  /**
   * Return a new ElementDOMSlot where all managed children will be inserted before this node
   */
  withBefore(before: Node | undefined | null): ElementDOMSlot<T> {
    return new ElementDOMSlot(this.element, before, this.after);
  }
  /**
   * Return a new ElementDOMSlot where all managed children will be inserted after this node
   */
  withAfter(after: Node | undefined | null): ElementDOMSlot<T> {
    return new ElementDOMSlot(this.element, this.before, after);
  }
  /**
   * Return a new ElementDOMSlot with an updated root element
   */
  withElement<ElementType extends HTMLElement>(element: ElementType): ElementDOMSlot<ElementType> {
    if (this.element === (element as HTMLElement)) {
      return this as unknown as ElementDOMSlot<ElementType>;
    }
    return new ElementDOMSlot(element, this.before, this.after);
  }
  /**
   * Insert the given child before this.before and any reconciler managed line break node,
   * or append it if this.before is not defined
   */
  insertChild(dom: Node): this {
    const before = this.before || this.getManagedLineBreak();
    invariant(
      before === null || before.parentElement === this.element,
      'ElementDOMSlot.insertChild: before is not in element',
    );
    this.element.insertBefore(dom, before);
    return this;
  }
  /**
   * Remove the managed child from this container, will throw if it was not already there
   */
  removeChild(dom: Node): this {
    invariant(
      dom.parentElement === this.element,
      'ElementDOMSlot.removeChild: dom is not in element',
    );
    this.element.removeChild(dom);
    return this;
  }
  /**
   * Replace managed child prevDom with dom. Will throw if prevDom is not a child
   *
   * @param dom The new node to replace prevDom
   * @param prevDom the node that will be replaced
   */
  replaceChild(dom: Node, prevDom: Node): this {
    invariant(
      prevDom.parentElement === this.element,
      'ElementDOMSlot.replaceChild: prevDom is not in element',
    );
    this.element.replaceChild(dom, prevDom);
    return this;
  }
  /**
   * Returns the first managed child of this node,
   * which will either be this.after.nextSibling or this.element.firstChild,
   * and will never be this.before if it is defined.
   */
  getFirstChild(): ChildNode | null {
    const firstChild = this.after ? this.after.nextSibling : this.element.firstChild;
    return firstChild === this.before || firstChild === this.getManagedLineBreak()
      ? null
      : firstChild;
  }
  /**
   * @internal
   */
  getManagedLineBreak(): Exclude<LexicalPrivateDOM['__lexicalLineBreak'], undefined> {
    const element: HTMLElement & LexicalPrivateDOM = this.element;
    return element.__lexicalLineBreak || null;
  }
  /** @internal */
  setManagedLineBreak(lineBreakType: null | 'empty' | 'line-break' | 'decorator'): void {
    if (lineBreakType === null) {
      this.removeManagedLineBreak();
    } else {
      const webkitHack = lineBreakType === 'decorator' && (IS_IOS || IS_SAFARI);
      this.insertManagedLineBreak(webkitHack);
    }
  }

  /** @internal */
  removeManagedLineBreak(): void {
    const br = this.getManagedLineBreak();
    if (br) {
      const element: HTMLElement & LexicalPrivateDOM = this.element;
      const sibling = br.nodeName === 'IMG' ? br.nextSibling : null;
      if (sibling) {
        element.removeChild(sibling);
      }
      element.removeChild(br);
      element.__lexicalLineBreak = undefined;
    }
  }
  /** @internal */
  insertManagedLineBreak(webkitHack: boolean): void {
    const prevBreak = this.getManagedLineBreak();
    if (prevBreak) {
      if (webkitHack === (prevBreak.nodeName === 'IMG')) {
        return;
      }
      this.removeManagedLineBreak();
    }
    const element: HTMLElement & LexicalPrivateDOM = this.element;
    const before = this.before;
    const br = document.createElement('br');
    element.insertBefore(br, before);
    if (webkitHack) {
      const img = document.createElement('img');
      img.setAttribute('data-lexical-linebreak', 'true');
      img.style.cssText =
        'display: inline !important; border: 0px !important; margin: 0px !important;';
      img.alt = '';
      element.insertBefore(img, br);
      element.__lexicalLineBreak = img;
    } else {
      element.__lexicalLineBreak = br;
    }
  }

  /**
   * @internal
   *
   * Returns the offset of the first child
   */
  getFirstChildOffset(): number {
    let i = 0;
    for (let node = this.after; node !== null; node = node.previousSibling) {
      i++;
    }
    return i;
  }

  /**
   * @internal
   */
  resolveChildIndex(
    element: ElementNode,
    elementDOM: HTMLElement,
    initialDOM: Node,
    initialOffset: number,
  ): [node: ElementNode, idx: number] {
    if (initialDOM === this.element) {
      const firstChildOffset = this.getFirstChildOffset();
      return [
        element,
        Math.min(
          firstChildOffset + element.getChildrenSize(),
          Math.max(firstChildOffset, initialOffset),
        ),
      ];
    }
    // The resolved offset must be before or after the children
    const initialPath = indexPath(elementDOM, initialDOM);
    initialPath.push(initialOffset);
    const elementPath = indexPath(elementDOM, this.element);
    let offset = element.getIndexWithinParent();
    for (let i = 0; i < elementPath.length; i++) {
      const target = initialPath[i];
      const source = elementPath[i];
      if (target === undefined || target < source) {
        break;
      } else if (target > source) {
        offset += 1;
        break;
      }
    }
    return [element.getParentOrThrow(), offset];
  }
}

export function indexPath(root: HTMLElement, child: Node): number[] {
  const path: number[] = [];
  let node: Node | null = child;
  for (; node !== root && node !== null; node = node.parentNode) {
    let i = 0;
    for (let sibling = node.previousSibling; sibling !== null; sibling = sibling.previousSibling) {
      i++;
    }
    path.push(i);
  }
  invariant(node === root, 'indexPath: root is not a parent of child');
  return path.reverse();
}

/** @noInheritDoc */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ElementNode extends LexicalNode {
  // ['constructor']!: KlassConstructor<typeof ElementNode>;
  /** @internal */
  __first: null | NodeKey;
  /** @internal */
  __last: null | NodeKey;
  /** @internal */
  __size: number;
  /** @internal */
  __format: number;
  /** @internal */
  __style: string;
  /** @internal */
  __indent: number;
  /** @internal */
  __dir: 'ltr' | 'rtl' | null;
  /** @internal */
  __textFormat: number;
  /** @internal */
  __textStyle: string;

  constructor(key?: NodeKey) {
    super(key);
    this.__first = null;
    this.__last = null;
    this.__size = 0;
    this.__format = 0;
    this.__style = '';
    this.__indent = 0;
    this.__dir = null;
    this.__textFormat = 0;
    this.__textStyle = '';
  }

  afterCloneFrom(prevNode: this) {
    super.afterCloneFrom(prevNode);
    if (this.__key === prevNode.__key) {
      this.__first = prevNode.__first;
      this.__last = prevNode.__last;
      this.__size = prevNode.__size;
    }
    this.__indent = prevNode.__indent;
    this.__format = prevNode.__format;
    this.__style = prevNode.__style;
    this.__dir = prevNode.__dir;
    this.__textFormat = prevNode.__textFormat;
    this.__textStyle = prevNode.__textStyle;
  }

  getFormat(): number {
    const self = this.getLatest();
    return self.__format;
  }
  getFormatType(): ElementFormatType {
    const format = this.getFormat();
    return ELEMENT_FORMAT_TO_TYPE[format] || '';
  }
  getStyle(): string {
    const self = this.getLatest();
    return self.__style;
  }
  getIndent(): number {
    const self = this.getLatest();
    return self.__indent;
  }
  getChildren<T extends LexicalNode>(): Array<T> {
    const children: Array<T> = [];
    let child: T | null = this.getFirstChild();
    while (child !== null) {
      children.push(child);
      child = child.getNextSibling();
    }
    return children;
  }
  getChildrenKeys(): Array<NodeKey> {
    const children: Array<NodeKey> = [];
    let child: LexicalNode | null = this.getFirstChild();
    while (child !== null) {
      children.push(child.__key);
      child = child.getNextSibling();
    }
    return children;
  }
  getChildrenSize(): number {
    const self = this.getLatest();
    return self.__size;
  }
  isEmpty(): boolean {
    return this.getChildrenSize() === 0;
  }
  isDirty(): boolean {
    const editor = getActiveEditor();
    const dirtyElements = editor._dirtyElements;
    return dirtyElements !== null && dirtyElements.has(this.__key);
  }
  isLastChild(): boolean {
    const self = this.getLatest();
    const parentLastChild = this.getParentOrThrow().getLastChild();
    return parentLastChild !== null && parentLastChild.is(self);
  }
  getAllTextNodes(): Array<TextNode> {
    const textNodes = [];
    let child: LexicalNode | null = this.getFirstChild();
    while (child !== null) {
      if ($isTextNode(child)) {
        textNodes.push(child);
      }
      if ($isElementNode(child)) {
        const subChildrenNodes = child.getAllTextNodes();
        textNodes.push(...subChildrenNodes);
      }
      child = child.getNextSibling();
    }
    return textNodes;
  }
  getFirstDescendant<T extends LexicalNode>(): null | T {
    let node = this.getFirstChild<T>();
    while ($isElementNode(node)) {
      const child = node.getFirstChild<T>();
      if (child === null) {
        break;
      }
      node = child;
    }
    return node;
  }
  getLastDescendant<T extends LexicalNode>(): null | T {
    let node = this.getLastChild<T>();
    while ($isElementNode(node)) {
      const child = node.getLastChild<T>();
      if (child === null) {
        break;
      }
      node = child;
    }
    return node;
  }
  getDescendantByIndex<T extends LexicalNode>(index: number): null | T {
    const children = this.getChildren<T>();
    const childrenLength = children.length;
    // For non-empty element nodes, we resolve its descendant
    // (either a leaf node or the bottom-most element)
    if (index >= childrenLength) {
      const resolvedNode = children[childrenLength - 1];
      return (
        ($isElementNode(resolvedNode) && resolvedNode.getLastDescendant()) || resolvedNode || null
      );
    }
    const resolvedNode = children[index];
    return (
      ($isElementNode(resolvedNode) && resolvedNode.getFirstDescendant()) || resolvedNode || null
    );
  }
  getFirstChild<T extends LexicalNode>(): null | T {
    const self = this.getLatest();
    const firstKey = self.__first;
    return firstKey === null ? null : $getNodeByKey<T>(firstKey);
  }
  getFirstChildOrThrow<T extends LexicalNode>(): T {
    const firstChild = this.getFirstChild<T>();
    if (firstChild === null) {
      invariant(false, 'Expected node %s to have a first child.', this.__key);
    }
    return firstChild;
  }
  getLastChild<T extends LexicalNode>(): null | T {
    const self = this.getLatest();
    const lastKey = self.__last;
    return lastKey === null ? null : $getNodeByKey<T>(lastKey);
  }
  getLastChildOrThrow<T extends LexicalNode>(): T {
    const lastChild = this.getLastChild<T>();
    if (lastChild === null) {
      invariant(false, 'Expected node %s to have a last child.', this.__key);
    }
    return lastChild;
  }
  getChildAtIndex<T extends LexicalNode>(index: number): null | T {
    const size = this.getChildrenSize();
    let node: null | T;
    let i;
    if (index < size / 2) {
      node = this.getFirstChild<T>();
      i = 0;
      while (node !== null && i <= index) {
        if (i === index) {
          return node;
        }
        node = node.getNextSibling();
        i++;
      }
      return null;
    }
    node = this.getLastChild<T>();
    i = size - 1;
    while (node !== null && i >= index) {
      if (i === index) {
        return node;
      }
      node = node.getPreviousSibling();
      i--;
    }
    return null;
  }
  getTextContent(): string {
    let textContent = '';
    const children = this.getChildren();
    const childrenLength = children.length;
    for (let i = 0; i < childrenLength; i++) {
      const child = children[i];
      textContent += child.getTextContent();
      if ($isElementNode(child) && i !== childrenLength - 1 && !child.isInline()) {
        textContent += DOUBLE_LINE_BREAK;
      }
    }
    return textContent;
  }
  getTextContentSize(): number {
    let textContentSize = 0;
    const children = this.getChildren();
    const childrenLength = children.length;
    for (let i = 0; i < childrenLength; i++) {
      const child = children[i];
      textContentSize += child.getTextContentSize();
      if ($isElementNode(child) && i !== childrenLength - 1 && !child.isInline()) {
        textContentSize += DOUBLE_LINE_BREAK.length;
      }
    }
    return textContentSize;
  }
  getDirection(): 'ltr' | 'rtl' | null {
    const self = this.getLatest();
    return self.__dir;
  }
  getTextFormat(): number {
    const self = this.getLatest();
    return self.__textFormat;
  }
  hasFormat(type: ElementFormatType): boolean {
    if (type !== '') {
      const formatFlag = ELEMENT_TYPE_TO_FORMAT[type];
      return (this.getFormat() & formatFlag) !== 0;
    }
    return false;
  }
  hasTextFormat(type: TextFormatType): boolean {
    const formatFlag = TEXT_TYPE_TO_FORMAT[type];
    return (this.getTextFormat() & formatFlag) !== 0;
  }
  /**
   * Returns the format flags applied to the node as a 32-bit integer.
   *
   * @returns a number representing the TextFormatTypes applied to the node.
   */
  getFormatFlags(type: TextFormatType, alignWithFormat: null | number): number {
    const self = this.getLatest();
    const format = self.__textFormat;
    return toggleTextFormatType(format, type, alignWithFormat);
  }

  getTextStyle(): string {
    const self = this.getLatest();
    return self.__textStyle;
  }

  // Mutators

  select(_anchorOffset?: number, _focusOffset?: number): RangeSelection {
    errorOnReadOnly();
    const selection = $getSelection();
    let anchorOffset = _anchorOffset;
    let focusOffset = _focusOffset;
    const childrenCount = this.getChildrenSize();
    if (!this.canBeEmpty()) {
      if (_anchorOffset === 0 && _focusOffset === 0) {
        const firstChild = this.getFirstChild();
        if ($isTextNode(firstChild) || $isElementNode(firstChild)) {
          return firstChild.select(0, 0);
        }
      } else if (
        (_anchorOffset === undefined || _anchorOffset === childrenCount) &&
        (_focusOffset === undefined || _focusOffset === childrenCount)
      ) {
        const lastChild = this.getLastChild();
        if ($isTextNode(lastChild) || $isElementNode(lastChild)) {
          return lastChild.select();
        }
      }
    }
    if (anchorOffset === undefined) {
      anchorOffset = childrenCount;
    }
    if (focusOffset === undefined) {
      focusOffset = childrenCount;
    }
    const key = this.__key;
    if (!$isRangeSelection(selection)) {
      return $internalMakeRangeSelection(key, anchorOffset, key, focusOffset, 'element', 'element');
    } else {
      selection.anchor.set(key, anchorOffset, 'element');
      selection.focus.set(key, focusOffset, 'element');
      selection.dirty = true;
    }
    return selection;
  }
  selectStart(): RangeSelection {
    const firstNode = this.getFirstDescendant();
    return firstNode ? firstNode.selectStart() : this.select();
  }
  selectEnd(): RangeSelection {
    const lastNode = this.getLastDescendant();
    return lastNode ? lastNode.selectEnd() : this.select();
  }
  clear(): this {
    const writableSelf = this.getWritable();
    const children = this.getChildren();
    children.forEach((child) => child.remove());
    return writableSelf;
  }
  append(...nodesToAppend: LexicalNode[]): this {
    return this.splice(this.getChildrenSize(), 0, nodesToAppend);
  }
  setDirection(direction: 'ltr' | 'rtl' | null): this {
    const self = this.getWritable();
    self.__dir = direction;
    return self;
  }
  setFormat(type: ElementFormatType): this {
    const self = this.getWritable();
    self.__format = type !== '' ? ELEMENT_TYPE_TO_FORMAT[type] : 0;
    return this;
  }
  setStyle(style: string): this {
    const self = this.getWritable();
    self.__style = style || '';
    return this;
  }
  setTextFormat(type: number): this {
    const self = this.getWritable();
    self.__textFormat = type;
    return self;
  }
  setTextStyle(style: string): this {
    const self = this.getWritable();
    self.__textStyle = style;
    return self;
  }
  setIndent(indentLevel: number): this {
    const self = this.getWritable();
    self.__indent = indentLevel;
    return this;
  }
  splice(start: number, deleteCount: number, nodesToInsert: Array<LexicalNode>): this {
    const nodesToInsertLength = nodesToInsert.length;
    const oldSize = this.getChildrenSize();
    const writableSelf = this.getWritable();
    invariant(
      start + deleteCount <= oldSize,
      'ElementNode.splice: start + deleteCount > oldSize (%s + %s > %s)',
      String(start),
      String(deleteCount),
      String(oldSize),
    );
    const writableSelfKey = writableSelf.__key;
    const nodesToInsertKeys = [];
    const nodesToRemoveKeys = [];
    const nodeAfterRange = this.getChildAtIndex(start + deleteCount);
    let nodeBeforeRange = null;
    let newSize = oldSize - deleteCount + nodesToInsertLength;

    if (start !== 0) {
      if (start === oldSize) {
        nodeBeforeRange = this.getLastChild();
      } else {
        const node = this.getChildAtIndex(start);
        if (node !== null) {
          nodeBeforeRange = node.getPreviousSibling();
        }
      }
    }

    if (deleteCount > 0) {
      let nodeToDelete =
        nodeBeforeRange === null ? this.getFirstChild() : nodeBeforeRange.getNextSibling();
      for (let i = 0; i < deleteCount; i++) {
        if (nodeToDelete === null) {
          invariant(false, 'splice: sibling not found');
        }
        const nextSibling = nodeToDelete.getNextSibling();
        const nodeKeyToDelete = nodeToDelete.__key;
        const writableNodeToDelete = nodeToDelete.getWritable();
        removeFromParent(writableNodeToDelete);
        nodesToRemoveKeys.push(nodeKeyToDelete);
        nodeToDelete = nextSibling;
      }
    }

    let prevNode = nodeBeforeRange;
    for (let i = 0; i < nodesToInsertLength; i++) {
      const nodeToInsert = nodesToInsert[i];
      if (prevNode !== null && nodeToInsert.is(prevNode)) {
        nodeBeforeRange = prevNode = prevNode.getPreviousSibling();
      }
      const writableNodeToInsert = nodeToInsert.getWritable();
      if (writableNodeToInsert.__parent === writableSelfKey) {
        newSize--;
      }
      removeFromParent(writableNodeToInsert);
      const nodeKeyToInsert = nodeToInsert.__key;
      if (prevNode === null) {
        writableSelf.__first = nodeKeyToInsert;
        writableNodeToInsert.__prev = null;
      } else {
        const writablePrevNode = prevNode.getWritable();
        writablePrevNode.__next = nodeKeyToInsert;
        writableNodeToInsert.__prev = writablePrevNode.__key;
      }
      if (nodeToInsert.__key === writableSelfKey) {
        invariant(false, 'append: attempting to append self');
      }
      // Set child parent to self
      writableNodeToInsert.__parent = writableSelfKey;
      nodesToInsertKeys.push(nodeKeyToInsert);
      prevNode = nodeToInsert;
    }

    if (start + deleteCount === oldSize) {
      if (prevNode !== null) {
        const writablePrevNode = prevNode.getWritable();
        writablePrevNode.__next = null;
        writableSelf.__last = prevNode.__key;
      }
    } else if (nodeAfterRange !== null) {
      const writableNodeAfterRange = nodeAfterRange.getWritable();
      if (prevNode !== null) {
        const writablePrevNode = prevNode.getWritable();
        writableNodeAfterRange.__prev = prevNode.__key;
        writablePrevNode.__next = nodeAfterRange.__key;
      } else {
        writableNodeAfterRange.__prev = null;
      }
    }

    writableSelf.__size = newSize;

    // In case of deletion we need to adjust selection, unlink removed nodes
    // and clean up node itself if it becomes empty. None of these needed
    // for insertion-only cases
    if (nodesToRemoveKeys.length) {
      // Adjusting selection, in case node that was anchor/focus will be deleted
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodesToRemoveKeySet = new Set(nodesToRemoveKeys);
        const nodesToInsertKeySet = new Set(nodesToInsertKeys);

        const { anchor, focus } = selection;
        if (isPointRemoved(anchor, nodesToRemoveKeySet, nodesToInsertKeySet)) {
          moveSelectionPointToSibling(
            anchor,
            anchor.getNode(),
            this,
            nodeBeforeRange,
            nodeAfterRange,
          );
        }
        if (isPointRemoved(focus, nodesToRemoveKeySet, nodesToInsertKeySet)) {
          moveSelectionPointToSibling(
            focus,
            focus.getNode(),
            this,
            nodeBeforeRange,
            nodeAfterRange,
          );
        }
        // Cleanup if node can't be empty
        if (newSize === 0 && !this.canBeEmpty() && !$isRootOrShadowRoot(this)) {
          this.remove();
        }
      }
    }

    return writableSelf;
  }
  /**
   * @internal
   *
   * An experimental API that an ElementNode can override to control where its
   * children are inserted into the DOM, this is useful to add a wrapping node
   * or accessory nodes before or after the children. The root of the node returned
   * by createDOM must still be exactly one HTMLElement.
   */
  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    return new ElementDOMSlot(element);
  }
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);
    if (isHTMLElement(element)) {
      const indent = this.getIndent();
      if (indent > 0) {
        // padding-inline-start is not widely supported in email HTML
        // (see https://www.caniemail.com/features/css-padding-inline-start-end/),
        // If you want to use HTML output for email, consider overriding the serialization
        // to use `padding-right` in RTL languages, `padding-left` in `LTR` languages, or
        // `text-indent` if you are ok with first-line indents.
        // We recommend keeping multiples of 40px to maintain consistency with list-items
        // (see https://github.com/facebook/lexical/pull/4025)
        element.style.paddingInlineStart = `${indent * 40}px`;
      }
      const direction = this.getDirection();
      if (direction) {
        element.dir = direction;
      }
    }

    return { element };
  }
  // JSON serialization
  exportJSON(): SerializedElementNode {
    const json: SerializedElementNode = {
      children: [],
      direction: this.getDirection(),
      format: this.getFormatType(),
      indent: this.getIndent(),
      // As an exception here we invoke super at the end for historical reasons.
      // Namely, to preserve the order of the properties and not to break the tests
      // that use the serialized string representation.
      ...super.exportJSON(),
    };
    const textFormat = this.getTextFormat();
    const textStyle = this.getTextStyle();
    if (textFormat !== 0) {
      json.textFormat = textFormat;
    }
    if (textStyle !== '') {
      json.textStyle = textStyle;
    }
    return json;
  }
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedElementNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setFormat(serializedNode.format)
      .setIndent(serializedNode.indent)
      .setDirection(serializedNode.direction)
      .setTextFormat(serializedNode.textFormat || 0)
      .setTextStyle(serializedNode.textStyle || '');
  }
  // These are intended to be extends for specific element heuristics.
  insertNewAfter(selection: RangeSelection, restoreSelection?: boolean): null | LexicalNode {
    return null;
  }
  canIndent(): boolean {
    return true;
  }
  /*
   * This method controls the behavior of the node during backwards
   * deletion (i.e., backspace) when selection is at the beginning of
   * the node (offset 0). You may use this to have the node replace
   * itself, change its state, or do nothing. When you do make such
   * a change, you should return true.
   *
   * When true is returned, the collapse phase will stop.
   * When false is returned, and isInline() is true, and getPreviousSibling() is null,
   * then this function will be called on its parent.
   */
  collapseAtStart(selection: RangeSelection): boolean {
    return false;
  }
  excludeFromCopy(destination?: 'clone' | 'html'): boolean {
    return false;
  }
  /** @deprecated @internal */
  canReplaceWith(replacement: LexicalNode): boolean {
    return true;
  }
  /** @deprecated @internal */
  canInsertAfter(node: LexicalNode): boolean {
    return true;
  }
  canBeEmpty(): boolean {
    return true;
  }
  canInsertTextBefore(): boolean {
    return true;
  }
  canInsertTextAfter(): boolean {
    return true;
  }
  isInline(): boolean {
    return false;
  }
  // A shadow root is a Node that behaves like RootNode. The shadow root (and RootNode) mark the
  // end of the hierarchy, most implementations should treat it as there's nothing (upwards)
  // beyond this point. For example, node.getTopLevelElement(), when performed inside a TableCellNode
  // will return the immediate first child underneath TableCellNode instead of RootNode.
  isShadowRoot(): boolean {
    return false;
  }
  /** @deprecated @internal */
  canMergeWith(node: ElementNode): boolean {
    return false;
  }
  extractWithChild(
    child: LexicalNode,
    selection: BaseSelection | null,
    destination: 'clone' | 'html',
  ): boolean {
    return false;
  }

  /**
   * Determines whether this node, when empty, can merge with a first block
   * of nodes being inserted.
   *
   * This method is specifically called in {@link RangeSelection.insertNodes}
   * to determine merging behavior during nodes insertion.
   *
   * @example
   * // In a ListItemNode or QuoteNode implementation:
   * canMergeWhenEmpty(): true {
   *  return true;
   * }
   */
  canMergeWhenEmpty(): boolean {
    return false;
  }

  /** @internal */
  reconcileObservedMutation(dom: HTMLElement, editor: LexicalEditor): void {
    const slot = this.getDOMSlot(dom);
    let currentDOM = slot.getFirstChild();
    for (
      let currentNode = this.getFirstChild();
      currentNode;
      currentNode = currentNode.getNextSibling()
    ) {
      const correctDOM = editor.getElementByKey(currentNode.getKey());

      if (correctDOM === null) {
        continue;
      }

      if (currentDOM == null) {
        slot.insertChild(correctDOM);
        currentDOM = correctDOM;
      } else if (currentDOM !== correctDOM) {
        slot.replaceChild(correctDOM, currentDOM);
      }

      currentDOM = currentDOM.nextSibling;
    }
  }
}

export function $isElementNode(node: LexicalNode | null | undefined): node is ElementNode {
  return node instanceof ElementNode;
}

function isPointRemoved(
  point: PointType,
  nodesToRemoveKeySet: Set<NodeKey>,
  nodesToInsertKeySet: Set<NodeKey>,
): boolean {
  let node: ElementNode | TextNode | null = point.getNode();
  while (node) {
    const nodeKey = node.__key;
    if (nodesToRemoveKeySet.has(nodeKey) && !nodesToInsertKeySet.has(nodeKey)) {
      return true;
    }
    node = node.getParent();
  }
  return false;
}

// TODO: Cleanup ArtificialNode__DO_NOT_USE #5966
export class ArtificialNode__DO_NOT_USE extends ElementNode {
  static getType(): string {
    return 'artificial';
  }

  createDOM(config: EditorConfig): HTMLElement {
    // this isnt supposed to be used and is not used anywhere but defining it to appease the API
    const dom = document.createElement('div');
    return dom;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface DecoratorNode<T> {
  getTopLevelElement(): ElementNode | this | null;
  getTopLevelElementOrThrow(): ElementNode | this;
}

/** @noInheritDoc */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DecoratorNode<T> extends LexicalNode {
  // ['constructor']!: KlassConstructor<typeof DecoratorNode<T>>;

  /**
   * The returned value is added to the LexicalEditor._decorators
   */
  decorate(editor: LexicalEditor, config: EditorConfig): T {
    invariant(false, 'decorate: base method not extended');
  }

  isIsolated(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $isDecoratorNode<T>(
  node: LexicalNode | null | undefined,
): node is DecoratorNode<T> {
  return node instanceof DecoratorNode;
}

export type SerializedLineBreakNode = SerializedLexicalNode;

/** @noInheritDoc */
export class LineBreakNode extends LexicalNode {
  // ['constructor']!: KlassConstructor<typeof LineBreakNode>;
  static getType(): string {
    return 'linebreak';
  }

  static clone(node: LineBreakNode): LineBreakNode {
    return new LineBreakNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  getTextContent(): '\n' {
    return '\n';
  }

  createDOM(): HTMLElement {
    return document.createElement('br');
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      br: (node: Node) => {
        if (isOnlyChildInBlockNode(node) || isLastChildInBlockNode(node)) {
          return null;
        }
        return {
          conversion: $convertLineBreakElement,
          priority: 0,
        };
      },
    };
  }

  static importJSON(serializedLineBreakNode: SerializedLineBreakNode): LineBreakNode {
    return $createLineBreakNode().updateFromJSON(serializedLineBreakNode);
  }
}

function $convertLineBreakElement(node: Node): DOMConversionOutput {
  return { node: $createLineBreakNode() };
}

export function $createLineBreakNode(): LineBreakNode {
  return $applyNodeReplacement(new LineBreakNode());
}

export function $isLineBreakNode(node: LexicalNode | null | undefined): node is LineBreakNode {
  return node instanceof LineBreakNode;
}

function isOnlyChildInBlockNode(node: Node): boolean {
  const parentElement = node.parentElement;
  if (parentElement !== null && isBlockDomNode(parentElement)) {
    const firstChild = parentElement.firstChild!;
    if (
      firstChild === node ||
      (firstChild.nextSibling === node && isWhitespaceDomTextNode(firstChild))
    ) {
      const lastChild = parentElement.lastChild!;
      if (
        lastChild === node ||
        (lastChild.previousSibling === node && isWhitespaceDomTextNode(lastChild))
      ) {
        return true;
      }
    }
  }
  return false;
}

function isLastChildInBlockNode(node: Node): boolean {
  const parentElement = node.parentElement;
  if (parentElement !== null && isBlockDomNode(parentElement)) {
    // check if node is first child, because only child dont count
    const firstChild = parentElement.firstChild!;
    if (
      firstChild === node ||
      (firstChild.nextSibling === node && isWhitespaceDomTextNode(firstChild))
    ) {
      return false;
    }

    // check if its last child
    const lastChild = parentElement.lastChild!;
    if (
      lastChild === node ||
      (lastChild.previousSibling === node && isWhitespaceDomTextNode(lastChild))
    ) {
      return true;
    }
  }
  return false;
}

function isWhitespaceDomTextNode(node: Node): boolean {
  return isDOMTextNode(node) && /^( |\t|\r?\n)+$/.test(node.textContent || '');
}

export type SerializedParagraphNode = Spread<
  {
    textFormat: number;
    textStyle: string;
  },
  SerializedElementNode
>;

/** @noInheritDoc */
export class ParagraphNode extends ElementNode {
  // ['constructor']!: KlassConstructor<typeof ParagraphNode>;

  static getType(): string {
    return 'paragraph';
  }

  static clone(node: ParagraphNode): ParagraphNode {
    return new ParagraphNode(node.__key);
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement('p');
    const classNames = getCachedClassNameArray(config.theme, 'paragraph');
    if (classNames !== undefined) {
      const domClassList = dom.classList;
      domClassList.add(...classNames);
    }
    return dom;
  }
  updateDOM(prevNode: ParagraphNode, dom: HTMLElement, config: EditorConfig): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      p: (node: Node) => ({
        conversion: $convertParagraphElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);

    if (isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement('br'));
      }

      const formatType = this.getFormatType();
      if (formatType) {
        element.style.textAlign = formatType;
      }
    }

    return {
      element,
    };
  }

  static importJSON(serializedNode: SerializedParagraphNode): ParagraphNode {
    return $createParagraphNode().updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedParagraphNode {
    return {
      ...super.exportJSON(),
      // These are included explicitly for backwards compatibility
      textFormat: this.getTextFormat(),
      textStyle: this.getTextStyle(),
    };
  }

  // Mutation

  insertNewAfter(rangeSelection: RangeSelection, restoreSelection: boolean): ParagraphNode {
    const newElement = $createParagraphNode();
    newElement.setTextFormat(rangeSelection.format);
    newElement.setTextStyle(rangeSelection.style);
    const direction = this.getDirection();
    newElement.setDirection(direction);
    newElement.setFormat(this.getFormatType());
    newElement.setStyle(this.getStyle());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  collapseAtStart(): boolean {
    const children = this.getChildren();
    // If we have an empty (trimmed) first paragraph and try and remove it,
    // delete the paragraph as long as we have another sibling to go to
    if (
      children.length === 0 ||
      ($isTextNode(children[0]) && children[0].getTextContent().trim() === '')
    ) {
      const nextSibling = this.getNextSibling();
      if (nextSibling !== null) {
        this.selectNext();
        this.remove();
        return true;
      }
      const prevSibling = this.getPreviousSibling();
      if (prevSibling !== null) {
        this.selectPrevious();
        this.remove();
        return true;
      }
    }
    return false;
  }
}

function $convertParagraphElement(element: HTMLElement): DOMConversionOutput {
  const node = $createParagraphNode();
  if (element.style) {
    node.setFormat(element.style.textAlign as ElementFormatType);
    setNodeIndentFromDOM(element, node);
  }
  return { node };
}

export function $createParagraphNode(): ParagraphNode {
  return $applyNodeReplacement(new ParagraphNode());
}

export function $isParagraphNode(node: LexicalNode | null | undefined): node is ParagraphNode {
  return node instanceof ParagraphNode;
}

export type SerializedRootNode<T extends SerializedLexicalNode = SerializedLexicalNode> =
  SerializedElementNode<T>;

/** @noInheritDoc */
export class RootNode extends ElementNode {
  /** @internal */
  __cachedText: null | string;

  static getType(): string {
    return 'root';
  }

  static clone(): RootNode {
    return new RootNode();
  }

  constructor() {
    super('root');
    this.__cachedText = null;
  }

  getTopLevelElementOrThrow(): never {
    invariant(false, 'getTopLevelElementOrThrow: root nodes are not top level elements');
  }

  getTextContent(): string {
    const cachedText = this.__cachedText;
    if (isCurrentlyReadOnlyMode() || getActiveEditor()._dirtyType === NO_DIRTY_NODES) {
      if (cachedText !== null) {
        return cachedText;
      }
    }
    return super.getTextContent();
  }

  remove(): never {
    invariant(false, 'remove: cannot be called on root nodes');
  }

  replace<N = LexicalNode>(node: N): never {
    invariant(false, 'replace: cannot be called on root nodes');
  }

  insertBefore(nodeToInsert: LexicalNode): LexicalNode {
    invariant(false, 'insertBefore: cannot be called on root nodes');
  }

  insertAfter(nodeToInsert: LexicalNode): LexicalNode {
    invariant(false, 'insertAfter: cannot be called on root nodes');
  }

  // View

  updateDOM(prevNode: this, dom: HTMLElement): false {
    return false;
  }

  // Mutate
  splice(start: number, deleteCount: number, nodesToInsert: LexicalNode[]): this {
    for (const node of nodesToInsert) {
      invariant(
        $isElementNode(node) || $isDecoratorNode(node),
        'rootNode.splice: Only element or decorator nodes can be inserted to the root node',
      );
    }
    return super.splice(start, deleteCount, nodesToInsert);
  }

  static importJSON(serializedNode: SerializedRootNode): RootNode {
    // We don't create a root, and instead use the existing root.
    return $getRoot().updateFromJSON(serializedNode);
  }

  collapseAtStart(): true {
    return true;
  }
}

export function $createRootNode(): RootNode {
  return new RootNode();
}

export function $isRootNode(node: RootNode | LexicalNode | null | undefined): node is RootNode {
  return node instanceof RootNode;
}

const ShadowRootNodeBrand: unique symbol = Symbol.for('@lexical/ShadowRootNodeBrand');
type ShadowRootNode = Spread<{ [ShadowRootNodeBrand]: never; isShadowRoot(): true }, ElementNode>;
export function $isRootOrShadowRoot(node: null | LexicalNode): node is RootNode | ShadowRootNode {
  return $isRootNode(node) || ($isElementNode(node) && node.isShadowRoot());
}

export function internalGetRoot(editorState: EditorState): RootNode {
  return editorState._nodeMap.get('root') as RootNode;
}

export function $getRoot(): RootNode {
  return internalGetRoot(getActiveEditorState());
}

export type SerializedTabNode = SerializedTextNode;

export function $createTabNode(): TabNode {
  return $applyNodeReplacement(new TabNode());
}

export function $isTabNode(node: LexicalNode | null | undefined): node is TabNode {
  return node instanceof TabNode;
}

export type SerializedTextNode = Spread<
  {
    detail: number;
    format: number;
    mode: TextModeType;
    style: string;
    text: string;
  },
  SerializedLexicalNode
>;

export type TextDetailType = 'directionless' | 'unmergable';

export type TextFormatType =
  | 'bold'
  | 'underline'
  | 'strikethrough'
  | 'italic'
  | 'highlight'
  | 'code'
  | 'subscript'
  | 'superscript'
  | 'lowercase'
  | 'uppercase'
  | 'capitalize';

export type TextModeType = 'normal' | 'token' | 'segmented';

export type TextMark = { end: null | number; id: string; start: null | number };

export type TextMarks = Array<TextMark>;

function getElementOuterTag(node: TextNode, format: number): string | null {
  if (format & IS_CODE) {
    return 'code';
  }
  if (format & IS_HIGHLIGHT) {
    return 'mark';
  }
  if (format & IS_SUBSCRIPT) {
    return 'sub';
  }
  if (format & IS_SUPERSCRIPT) {
    return 'sup';
  }
  return null;
}

function getElementInnerTag(node: TextNode, format: number): string {
  if (format & IS_BOLD) {
    return 'strong';
  }
  if (format & IS_ITALIC) {
    return 'em';
  }
  return 'span';
}

function setTextThemeClassNames(
  tag: string,
  prevFormat: number,
  nextFormat: number,
  dom: HTMLElement,
  textClassNames: TextNodeThemeClasses,
): void {
  const domClassList = dom.classList;
  // Firstly we handle the base theme.
  let classNames = getCachedClassNameArray(textClassNames, 'base');
  if (classNames !== undefined) {
    domClassList.add(...classNames);
  }
  // Secondly we handle the special case: underline + strikethrough.
  // We have to do this as we need a way to compose the fact that
  // the same CSS property will need to be used: text-decoration.
  // In an ideal world we shouldn't have to do this, but there's no
  // easy workaround for many atomic CSS systems today.
  classNames = getCachedClassNameArray(textClassNames, 'underlineStrikethrough');
  let hasUnderlineStrikethrough = false;
  const prevUnderlineStrikethrough = prevFormat & IS_UNDERLINE && prevFormat & IS_STRIKETHROUGH;
  const nextUnderlineStrikethrough = nextFormat & IS_UNDERLINE && nextFormat & IS_STRIKETHROUGH;

  if (classNames !== undefined) {
    if (nextUnderlineStrikethrough) {
      hasUnderlineStrikethrough = true;
      if (!prevUnderlineStrikethrough) {
        domClassList.add(...classNames);
      }
    } else if (prevUnderlineStrikethrough) {
      domClassList.remove(...classNames);
    }
  }

  for (const key in TEXT_TYPE_TO_FORMAT) {
    const format = key;
    const flag = TEXT_TYPE_TO_FORMAT[format];
    classNames = getCachedClassNameArray(textClassNames, key);
    if (classNames !== undefined) {
      if (nextFormat & flag) {
        if (hasUnderlineStrikethrough && (key === 'underline' || key === 'strikethrough')) {
          if (prevFormat & flag) {
            domClassList.remove(...classNames);
          }
          continue;
        }
        if (
          (prevFormat & flag) === 0 ||
          (prevUnderlineStrikethrough && key === 'underline') ||
          key === 'strikethrough'
        ) {
          domClassList.add(...classNames);
        }
      } else if (prevFormat & flag) {
        domClassList.remove(...classNames);
      }
    }
  }
}

function diffComposedText(a: string, b: string): [number, number, string] {
  const aLength = a.length;
  const bLength = b.length;
  let left = 0;
  let right = 0;

  while (left < aLength && left < bLength && a[left] === b[left]) {
    left++;
  }
  while (
    right + left < aLength &&
    right + left < bLength &&
    a[aLength - right - 1] === b[bLength - right - 1]
  ) {
    right++;
  }

  return [left, aLength - left - right, b.slice(left, bLength - right)];
}

function setTextContent(nextText: string, dom: HTMLElement, node: TextNode): void {
  const firstChild = dom.firstChild;
  const isComposing = node.isComposing();
  // Always add a suffix if we're composing a node
  const suffix = isComposing ? COMPOSITION_SUFFIX : '';
  const text: string = nextText + suffix;

  if (firstChild == null) {
    dom.textContent = text;
  } else {
    const nodeValue = firstChild.nodeValue;
    if (nodeValue !== text) {
      if (isComposing || IS_FIREFOX) {
        // We also use the diff composed text for general text in FF to avoid
        // the spellcheck red line from flickering.
        const [index, remove, insert] = diffComposedText(nodeValue as string, text);
        if (remove !== 0) {
          // @ts-expect-error
          firstChild.deleteData(index, remove);
        }
        // @ts-expect-error
        firstChild.insertData(index, insert);
      } else {
        firstChild.nodeValue = text;
      }
    }
  }
}

function createTextInnerDOM(
  innerDOM: HTMLElement,
  node: TextNode,
  innerTag: string,
  format: number,
  text: string,
  config: EditorConfig,
): void {
  setTextContent(text, innerDOM, node);
  const theme = config.theme;
  // Apply theme class names
  const textClassNames = theme.text;

  if (textClassNames !== undefined) {
    setTextThemeClassNames(innerTag, 0, format, innerDOM, textClassNames);
  }
}

function wrapElementWith(element: HTMLElement | Text, tag: string): HTMLElement {
  const el = document.createElement(tag);
  el.appendChild(element);
  return el;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TextNode {
  getTopLevelElement(): ElementNode | null;
  getTopLevelElementOrThrow(): ElementNode;
}

/** @noInheritDoc */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TextNode extends LexicalNode {
  // ['constructor']!: KlassConstructor<typeof TextNode>;
  __text: string;
  /** @internal */
  __format: number;
  /** @internal */
  __style: string;
  /** @internal */
  __mode: 0 | 1 | 2 | 3;
  /** @internal */
  __detail: number;

  static getType(): string {
    return 'text';
  }

  static clone(node: TextNode): TextNode {
    return new TextNode(node.__text, node.__key);
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__text = prevNode.__text;
    this.__format = prevNode.__format;
    this.__style = prevNode.__style;
    this.__mode = prevNode.__mode;
    this.__detail = prevNode.__detail;
  }

  constructor(text: string = '', key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__format = 0;
    this.__style = '';
    this.__mode = 0;
    this.__detail = 0;
  }

  /**
   * Returns a 32-bit integer that represents the TextFormatTypes currently applied to the
   * TextNode. You probably don't want to use this method directly - consider using TextNode.hasFormat instead.
   *
   * @returns a number representing the format of the text node.
   */
  getFormat(): number {
    const self = this.getLatest();
    return self.__format;
  }

  /**
   * Returns a 32-bit integer that represents the TextDetailTypes currently applied to the
   * TextNode. You probably don't want to use this method directly - consider using TextNode.isDirectionless
   * or TextNode.isUnmergeable instead.
   *
   * @returns a number representing the detail of the text node.
   */
  getDetail(): number {
    const self = this.getLatest();
    return self.__detail;
  }

  /**
   * Returns the mode (TextModeType) of the TextNode, which may be "normal", "token", or "segmented"
   *
   * @returns TextModeType.
   */
  getMode(): TextModeType {
    const self = this.getLatest();
    return TEXT_TYPE_TO_MODE[self.__mode];
  }

  /**
   * Returns the styles currently applied to the node. This is analogous to CSSText in the DOM.
   *
   * @returns CSSText-like string of styles applied to the underlying DOM node.
   */
  getStyle(): string {
    const self = this.getLatest();
    return self.__style;
  }

  /**
   * Returns whether or not the node is in "token" mode. TextNodes in token mode can be navigated through character-by-character
   * with a RangeSelection, but are deleted as a single entity (not individually by character).
   *
   * @returns true if the node is in token mode, false otherwise.
   */
  isToken(): boolean {
    const self = this.getLatest();
    return self.__mode === IS_TOKEN;
  }

  /**
   *
   * @returns true if Lexical detects that an IME or other 3rd-party script is attempting to
   * mutate the TextNode, false otherwise.
   */
  isComposing(): boolean {
    return this.__key === $getCompositionKey();
  }

  /**
   * Returns whether or not the node is in "segmented" mode. TextNodes in segmented mode can be navigated through character-by-character
   * with a RangeSelection, but are deleted in space-delimited "segments".
   *
   * @returns true if the node is in segmented mode, false otherwise.
   */
  isSegmented(): boolean {
    const self = this.getLatest();
    return self.__mode === IS_SEGMENTED;
  }
  /**
   * Returns whether or not the node is "directionless". Directionless nodes don't respect changes between RTL and LTR modes.
   *
   * @returns true if the node is directionless, false otherwise.
   */
  isDirectionless(): boolean {
    const self = this.getLatest();
    return (self.__detail & IS_DIRECTIONLESS) !== 0;
  }
  /**
   * Returns whether or not the node is unmergeable. In some scenarios, Lexical tries to merge
   * adjacent TextNodes into a single TextNode. If a TextNode is unmergeable, this won't happen.
   *
   * @returns true if the node is unmergeable, false otherwise.
   */
  isUnmergeable(): boolean {
    const self = this.getLatest();
    return (self.__detail & IS_UNMERGEABLE) !== 0;
  }

  /**
   * Returns whether or not the node has the provided format applied. Use this with the human-readable TextFormatType
   * string values to get the format of a TextNode.
   *
   * @param type - the TextFormatType to check for.
   *
   * @returns true if the node has the provided format, false otherwise.
   */
  hasFormat(type: TextFormatType): boolean {
    const formatFlag = TEXT_TYPE_TO_FORMAT[type];
    return (this.getFormat() & formatFlag) !== 0;
  }

  /**
   * Returns whether or not the node is simple text. Simple text is defined as a TextNode that has the string type "text"
   * (i.e., not a subclass) and has no mode applied to it (i.e., not segmented or token).
   *
   * @returns true if the node is simple text, false otherwise.
   */
  isSimpleText(): boolean {
    return this.__type === 'text' && this.__mode === 0;
  }

  /**
   * Returns the text content of the node as a string.
   *
   * @returns a string representing the text content of the node.
   */
  getTextContent(): string {
    const self = this.getLatest();
    return self.__text;
  }

  /**
   * Returns the format flags applied to the node as a 32-bit integer.
   *
   * @returns a number representing the TextFormatTypes applied to the node.
   */
  getFormatFlags(type: TextFormatType, alignWithFormat: null | number): number {
    const self = this.getLatest();
    const format = self.__format;
    return toggleTextFormatType(format, type, alignWithFormat);
  }

  /**
   *
   * @returns true if the text node supports font styling, false otherwise.
   */
  canHaveFormat(): boolean {
    return true;
  }

  /**
   * @returns true if the text node is inline, false otherwise.
   */
  isInline(): true {
    return true;
  }

  // View

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const format = this.__format;
    const outerTag = getElementOuterTag(this, format);
    const innerTag = getElementInnerTag(this, format);
    const tag = outerTag === null ? innerTag : outerTag;
    const dom = document.createElement(tag);
    let innerDOM = dom;
    if (this.hasFormat('code')) {
      dom.setAttribute('spellcheck', 'false');
    }
    if (outerTag !== null) {
      innerDOM = document.createElement(innerTag);
      dom.appendChild(innerDOM);
    }
    const text = this.__text;
    createTextInnerDOM(innerDOM, this, innerTag, format, text, config);
    const style = this.__style;
    if (style !== '') {
      dom.style.cssText = style;
    }
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const nextText = this.__text;
    const prevFormat = prevNode.__format;
    const nextFormat = this.__format;
    const prevOuterTag = getElementOuterTag(this, prevFormat);
    const nextOuterTag = getElementOuterTag(this, nextFormat);
    const prevInnerTag = getElementInnerTag(this, prevFormat);
    const nextInnerTag = getElementInnerTag(this, nextFormat);
    const prevTag = prevOuterTag === null ? prevInnerTag : prevOuterTag;
    const nextTag = nextOuterTag === null ? nextInnerTag : nextOuterTag;

    if (prevTag !== nextTag) {
      return true;
    }
    if (prevOuterTag === nextOuterTag && prevInnerTag !== nextInnerTag) {
      // should always be an element
      const prevInnerDOM: HTMLElement = dom.firstChild as HTMLElement;
      if (prevInnerDOM == null) {
        invariant(false, 'updateDOM: prevInnerDOM is null or undefined');
      }
      const nextInnerDOM = document.createElement(nextInnerTag);
      createTextInnerDOM(nextInnerDOM, this, nextInnerTag, nextFormat, nextText, config);
      dom.replaceChild(nextInnerDOM, prevInnerDOM);
      return false;
    }
    let innerDOM = dom;
    if (nextOuterTag !== null) {
      if (prevOuterTag !== null) {
        innerDOM = dom.firstChild as HTMLElement;
        if (innerDOM == null) {
          invariant(false, 'updateDOM: innerDOM is null or undefined');
        }
      }
    }
    setTextContent(nextText, innerDOM, this);
    const theme = config.theme;
    // Apply theme class names
    const textClassNames = theme.text;

    if (textClassNames !== undefined && prevFormat !== nextFormat) {
      setTextThemeClassNames(nextInnerTag, prevFormat, nextFormat, innerDOM, textClassNames);
    }
    const prevStyle = prevNode.__style;
    const nextStyle = this.__style;
    if (prevStyle !== nextStyle) {
      dom.style.cssText = nextStyle;
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      '#text': () => ({
        conversion: $convertTextDOMNode,
        priority: 0,
      }),
      'b': () => ({
        conversion: convertBringAttentionToElement,
        priority: 0,
      }),
      'code': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'em': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'i': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'mark': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      's': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'span': () => ({
        conversion: convertSpanElement,
        priority: 0,
      }),
      'strong': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'sub': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'sup': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
      'u': () => ({
        conversion: convertTextFormatElement,
        priority: 0,
      }),
    };
  }

  static importJSON(serializedNode: SerializedTextNode): TextNode {
    return $createTextNode().updateFromJSON(serializedNode);
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedTextNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setTextContent(serializedNode.text)
      .setFormat(serializedNode.format)
      .setDetail(serializedNode.detail)
      .setMode(serializedNode.mode)
      .setStyle(serializedNode.style);
  }

  // This improves Lexical's basic text output in copy+paste plus
  // for headless mode where people might use Lexical to generate
  // HTML content and not have the ability to use CSS classes.
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    let { element } = super.exportDOM(editor);
    invariant(isHTMLElement(element), 'Expected TextNode createDOM to always return a HTMLElement');
    element.style.whiteSpace = 'pre-wrap';

    // Add text-transform styles for capitalization formats
    if (this.hasFormat('lowercase')) {
      element.style.textTransform = 'lowercase';
    } else if (this.hasFormat('uppercase')) {
      element.style.textTransform = 'uppercase';
    } else if (this.hasFormat('capitalize')) {
      element.style.textTransform = 'capitalize';
    }

    // This is the only way to properly add support for most clients,
    // even if it's semantically incorrect to have to resort to using
    // <b>, <u>, <s>, <i> elements.
    if (this.hasFormat('bold')) {
      element = wrapElementWith(element, 'b');
    }
    if (this.hasFormat('italic')) {
      element = wrapElementWith(element, 'i');
    }
    if (this.hasFormat('strikethrough')) {
      element = wrapElementWith(element, 's');
    }
    if (this.hasFormat('underline')) {
      element = wrapElementWith(element, 'u');
    }

    return {
      element,
    };
  }

  exportJSON(): SerializedTextNode {
    return {
      detail: this.getDetail(),
      format: this.getFormat(),
      mode: this.getMode(),
      style: this.getStyle(),
      text: this.getTextContent(),
      // As an exception here we invoke super at the end for historical reasons.
      // Namely, to preserve the order of the properties and not to break the tests
      // that use the serialized string representation.
      ...super.exportJSON(),
    };
  }

  // Mutators
  selectionTransform(prevSelection: null | BaseSelection, nextSelection: RangeSelection): void {
    return;
  }

  /**
   * Sets the node format to the provided TextFormatType or 32-bit integer. Note that the TextFormatType
   * version of the argument can only specify one format and doing so will remove all other formats that
   * may be applied to the node. For toggling behavior, consider using {@link TextNode.toggleFormat}
   *
   * @param format - TextFormatType or 32-bit integer representing the node format.
   *
   * @returns this TextNode.
   * // TODO 0.12 This should just be a `string`.
   */
  setFormat(format: TextFormatType | number): this {
    const self = this.getWritable();
    self.__format = typeof format === 'string' ? TEXT_TYPE_TO_FORMAT[format] : format;
    return self;
  }

  /**
   * Sets the node detail to the provided TextDetailType or 32-bit integer. Note that the TextDetailType
   * version of the argument can only specify one detail value and doing so will remove all other detail values that
   * may be applied to the node. For toggling behavior, consider using {@link TextNode.toggleDirectionless}
   * or {@link TextNode.toggleUnmergeable}
   *
   * @param detail - TextDetailType or 32-bit integer representing the node detail.
   *
   * @returns this TextNode.
   * // TODO 0.12 This should just be a `string`.
   */
  setDetail(detail: TextDetailType | number): this {
    const self = this.getWritable();
    self.__detail = typeof detail === 'string' ? DETAIL_TYPE_TO_DETAIL[detail] : detail;
    return self;
  }

  /**
   * Sets the node style to the provided CSSText-like string. Set this property as you
   * would an HTMLElement style attribute to apply inline styles to the underlying DOM Element.
   *
   * @param style - CSSText to be applied to the underlying HTMLElement.
   *
   * @returns this TextNode.
   */
  setStyle(style: string): this {
    const self = this.getWritable();
    self.__style = style;
    return self;
  }

  /**
   * Applies the provided format to this TextNode if it's not present. Removes it if it's present.
   * The subscript and superscript formats are mutually exclusive.
   * Prefer using this method to turn specific formats on and off.
   *
   * @param type - TextFormatType to toggle.
   *
   * @returns this TextNode.
   */
  toggleFormat(type: TextFormatType): this {
    const format = this.getFormat();
    const newFormat = toggleTextFormatType(format, type, null);
    return this.setFormat(newFormat);
  }

  /**
   * Toggles the directionless detail value of the node. Prefer using this method over setDetail.
   *
   * @returns this TextNode.
   */
  toggleDirectionless(): this {
    const self = this.getWritable();
    self.__detail ^= IS_DIRECTIONLESS;
    return self;
  }

  /**
   * Toggles the unmergeable detail value of the node. Prefer using this method over setDetail.
   *
   * @returns this TextNode.
   */
  toggleUnmergeable(): this {
    const self = this.getWritable();
    self.__detail ^= IS_UNMERGEABLE;
    return self;
  }

  /**
   * Sets the mode of the node.
   *
   * @returns this TextNode.
   */
  setMode(type: TextModeType): this {
    const mode = TEXT_MODE_TO_TYPE[type];
    if (this.__mode === mode) {
      return this;
    }
    const self = this.getWritable();
    self.__mode = mode;
    return self;
  }

  /**
   * Sets the text content of the node.
   *
   * @param text - the string to set as the text value of the node.
   *
   * @returns this TextNode.
   */
  setTextContent(text: string): this {
    if (this.__text === text) {
      return this;
    }
    const self = this.getWritable();
    self.__text = text;
    return self;
  }

  /**
   * Sets the current Lexical selection to be a RangeSelection with anchor and focus on this TextNode at the provided offsets.
   *
   * @param _anchorOffset - the offset at which the Selection anchor will be placed.
   * @param _focusOffset - the offset at which the Selection focus will be placed.
   *
   * @returns the new RangeSelection.
   */
  select(_anchorOffset?: number, _focusOffset?: number): RangeSelection {
    errorOnReadOnly();
    let anchorOffset = _anchorOffset;
    let focusOffset = _focusOffset;
    const selection = $getSelection();
    const text = this.getTextContent();
    const key = this.__key;
    if (typeof text === 'string') {
      const lastOffset = text.length;
      if (anchorOffset === undefined) {
        anchorOffset = lastOffset;
      }
      if (focusOffset === undefined) {
        focusOffset = lastOffset;
      }
    } else {
      anchorOffset = 0;
      focusOffset = 0;
    }
    if (!$isRangeSelection(selection)) {
      return $internalMakeRangeSelection(key, anchorOffset, key, focusOffset, 'text', 'text');
    } else {
      const compositionKey = $getCompositionKey();
      if (compositionKey === selection.anchor.key || compositionKey === selection.focus.key) {
        $setCompositionKey(key);
      }
      selection.setTextNodeRange(this, anchorOffset, this, focusOffset);
    }
    return selection;
  }

  selectStart(): RangeSelection {
    return this.select(0, 0);
  }

  selectEnd(): RangeSelection {
    const size = this.getTextContentSize();
    return this.select(size, size);
  }

  /**
   * Inserts the provided text into this TextNode at the provided offset, deleting the number of characters
   * specified. Can optionally calculate a new selection after the operation is complete.
   *
   * @param offset - the offset at which the splice operation should begin.
   * @param delCount - the number of characters to delete, starting from the offset.
   * @param newText - the text to insert into the TextNode at the offset.
   * @param moveSelection - optional, whether or not to move selection to the end of the inserted substring.
   *
   * @returns this TextNode.
   */
  spliceText(offset: number, delCount: number, newText: string, moveSelection?: boolean): TextNode {
    const writableSelf = this.getWritable();
    const text = writableSelf.__text;
    const handledTextLength = newText.length;
    let index = offset;
    if (index < 0) {
      index = handledTextLength + index;
      if (index < 0) {
        index = 0;
      }
    }
    const selection = $getSelection();
    if (moveSelection && $isRangeSelection(selection)) {
      const newOffset = offset + handledTextLength;
      selection.setTextNodeRange(writableSelf, newOffset, writableSelf, newOffset);
    }

    const updatedText = text.slice(0, index) + newText + text.slice(index + delCount);

    writableSelf.__text = updatedText;
    return writableSelf;
  }

  /**
   * This method is meant to be overridden by TextNode subclasses to control the behavior of those nodes
   * when a user event would cause text to be inserted before them in the editor. If true, Lexical will attempt
   * to insert text into this node. If false, it will insert the text in a new sibling node.
   *
   * @returns true if text can be inserted before the node, false otherwise.
   */
  canInsertTextBefore(): boolean {
    return true;
  }

  /**
   * This method is meant to be overridden by TextNode subclasses to control the behavior of those nodes
   * when a user event would cause text to be inserted after them in the editor. If true, Lexical will attempt
   * to insert text into this node. If false, it will insert the text in a new sibling node.
   *
   * @returns true if text can be inserted after the node, false otherwise.
   */
  canInsertTextAfter(): boolean {
    return true;
  }

  /**
   * Splits this TextNode at the provided character offsets, forming new TextNodes from the substrings
   * formed by the split, and inserting those new TextNodes into the editor, replacing the one that was split.
   *
   * @param splitOffsets - rest param of the text content character offsets at which this node should be split.
   *
   * @returns an Array containing the newly-created TextNodes.
   */
  splitText(...splitOffsets: Array<number>): Array<TextNode> {
    errorOnReadOnly();
    const self = this.getLatest();
    const textContent = self.getTextContent();
    if (textContent === '') {
      return [];
    }
    const key = self.__key;
    const compositionKey = $getCompositionKey();
    const textLength = textContent.length;
    splitOffsets.sort((a, b) => a - b);
    splitOffsets.push(textLength);
    const parts = [];
    const splitOffsetsLength = splitOffsets.length;
    for (
      let start = 0, offsetIndex = 0;
      start < textLength && offsetIndex <= splitOffsetsLength;
      offsetIndex++
    ) {
      const end = splitOffsets[offsetIndex];
      if (end > start) {
        parts.push(textContent.slice(start, end));
        start = end;
      }
    }
    const partsLength = parts.length;
    if (partsLength === 1) {
      return [self];
    }
    const firstPart = parts[0];
    const parent = self.getParent();
    let writableNode;
    const format = self.getFormat();
    const style = self.getStyle();
    const detail = self.__detail;
    let hasReplacedSelf = false;

    // Prepare to handle selection
    let startTextPoint: TextPointType | null = null;
    let endTextPoint: TextPointType | null = null;
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const [startPoint, endPoint] = selection.isBackward()
        ? [selection.focus, selection.anchor]
        : [selection.anchor, selection.focus];
      if (startPoint.type === 'text' && startPoint.key === key) {
        startTextPoint = startPoint;
      }
      if (endPoint.type === 'text' && endPoint.key === key) {
        endTextPoint = endPoint;
      }
    }

    if (self.isSegmented()) {
      // Create a new TextNode
      writableNode = $createTextNode(firstPart);
      writableNode.__format = format;
      writableNode.__style = style;
      writableNode.__detail = detail;
      writableNode.__state = $cloneNodeState(self, writableNode);
      hasReplacedSelf = true;
    } else {
      // For the first part, update the existing node
      writableNode = self.setTextContent(firstPart);
    }

    // Then handle all other parts
    const splitNodes: TextNode[] = [writableNode];
    let textSize = firstPart.length;

    for (let i = 1; i < partsLength; i++) {
      const part = parts[i];
      const partSize = part.length;
      const sibling = $createTextNode(part);
      sibling.__format = format;
      sibling.__style = style;
      sibling.__detail = detail;
      sibling.__state = $cloneNodeState(self, sibling);
      const siblingKey = sibling.__key;
      const nextTextSize = textSize + partSize;
      if (compositionKey === key) {
        $setCompositionKey(siblingKey);
      }
      textSize = nextTextSize;
      splitNodes.push(sibling);
    }

    // Move the selection to the best location in the split string.
    // The end point is always left-biased, and the start point is
    // generally left biased unless the end point would land on a
    // later node in the split in which case it will prefer the start
    // of that node so they will tend to be on the same node.
    const originalStartOffset = startTextPoint ? startTextPoint.offset : null;
    const originalEndOffset = endTextPoint ? endTextPoint.offset : null;
    let startOffset = 0;
    for (const node of splitNodes) {
      if (!(startTextPoint || endTextPoint)) {
        break;
      }
      const endOffset = startOffset + node.getTextContentSize();
      if (
        startTextPoint !== null &&
        originalStartOffset !== null &&
        originalStartOffset <= endOffset &&
        originalStartOffset >= startOffset
      ) {
        // Set the start point to the first valid node
        startTextPoint.set(node.getKey(), originalStartOffset - startOffset, 'text');
        if (originalStartOffset < endOffset) {
          // The start isn't on a border so we can stop checking
          startTextPoint = null;
        }
      }
      if (
        endTextPoint !== null &&
        originalEndOffset !== null &&
        originalEndOffset <= endOffset &&
        originalEndOffset >= startOffset
      ) {
        endTextPoint.set(node.getKey(), originalEndOffset - startOffset, 'text');
        break;
      }
      startOffset = endOffset;
    }

    // Insert the nodes into the parent's children
    if (parent !== null) {
      internalMarkSiblingsAsDirty(this);
      const writableParent = parent.getWritable();
      const insertionIndex = this.getIndexWithinParent();
      if (hasReplacedSelf) {
        writableParent.splice(insertionIndex, 0, splitNodes);
        this.remove();
      } else {
        writableParent.splice(insertionIndex, 1, splitNodes);
      }

      if ($isRangeSelection(selection)) {
        $updateElementSelectionOnCreateDeleteNode(
          selection,
          parent,
          insertionIndex,
          partsLength - 1,
        );
      }
    }

    return splitNodes;
  }

  /**
   * Merges the target TextNode into this TextNode, removing the target node.
   *
   * @param target - the TextNode to merge into this one.
   *
   * @returns this TextNode.
   */
  mergeWithSibling(target: TextNode): TextNode {
    const isBefore = target === this.getPreviousSibling();
    if (!isBefore && target !== this.getNextSibling()) {
      invariant(false, 'mergeWithSibling: sibling must be a previous or next sibling');
    }
    const key = this.__key;
    const targetKey = target.__key;
    const text = this.__text;
    const textLength = text.length;
    const compositionKey = $getCompositionKey();

    if (compositionKey === targetKey) {
      $setCompositionKey(key);
    }
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchor = selection.anchor;
      const focus = selection.focus;
      if (anchor !== null && anchor.key === targetKey) {
        adjustPointOffsetForMergedSibling(anchor, isBefore, key, target, textLength);
      }
      if (focus !== null && focus.key === targetKey) {
        adjustPointOffsetForMergedSibling(focus, isBefore, key, target, textLength);
      }
    }
    const targetText = target.__text;
    const newText = isBefore ? targetText + text : text + targetText;
    this.setTextContent(newText);
    const writableSelf = this.getWritable();
    target.remove();
    return writableSelf;
  }

  /**
   * This method is meant to be overridden by TextNode subclasses to control the behavior of those nodes
   * when used with the registerLexicalTextEntity function. If you're using registerLexicalTextEntity, the
   * node class that you create and replace matched text with should return true from this method.
   *
   * @returns true if the node is to be treated as a "text entity", false otherwise.
   */
  isTextEntity(): boolean {
    return false;
  }
}

/** @noInheritDoc */
export class TabNode extends TextNode {
  static getType(): string {
    return 'tab';
  }

  static clone(node: TabNode): TabNode {
    return new TabNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super('\t', key);
    this.__detail = IS_UNMERGEABLE;
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    const classNames = getCachedClassNameArray(config.theme, 'tab');

    if (classNames !== undefined) {
      const domClassList = dom.classList;
      domClassList.add(...classNames);
    }
    return dom;
  }

  static importJSON(serializedTabNode: SerializedTabNode): TabNode {
    return $createTabNode().updateFromJSON(serializedTabNode);
  }

  setTextContent(text: string): this {
    invariant(text === '\t' || text === '', 'TabNode does not support setTextContent');
    return super.setTextContent('\t');
  }

  spliceText(offset: number, delCount: number, newText: string, moveSelection?: boolean): TextNode {
    invariant(
      (newText === '' && delCount === 0) || (newText === '\t' && delCount === 1),
      'TabNode does not support spliceText',
    );
    return this;
  }

  setDetail(detail: TextDetailType | number): this {
    invariant(detail === IS_UNMERGEABLE, 'TabNode does not support setDetail');
    return this;
  }

  setMode(type: TextModeType): this {
    invariant(type === 'normal', 'TabNode does not support setMode');
    return this;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

function convertSpanElement(domNode: HTMLSpanElement): DOMConversionOutput {
  // domNode is a <span> since we matched it by nodeName
  const span = domNode;
  const style = span.style;

  return {
    forChild: applyTextFormatFromStyle(style),
    node: null,
  };
}

function convertBringAttentionToElement(domNode: HTMLElement): DOMConversionOutput {
  // domNode is a <b> since we matched it by nodeName
  const b = domNode;
  // Google Docs wraps all copied HTML in a <b> with font-weight normal
  const hasNormalFontWeight = b.style.fontWeight === 'normal';

  return {
    forChild: applyTextFormatFromStyle(b.style, hasNormalFontWeight ? undefined : 'bold'),
    node: null,
  };
}

const preParentCache = new WeakMap<Node, null | Node>();

function isNodePre(node: Node): boolean {
  if (!isHTMLElement(node)) {
    return false;
  } else if (node.nodeName === 'PRE') {
    return true;
  }
  const whiteSpace = node.style.whiteSpace;
  return typeof whiteSpace === 'string' && whiteSpace.startsWith('pre');
}

export function findParentPreDOMNode(node: Node) {
  let cached;
  let parent = node.parentNode;
  const visited = [node];
  while (
    parent !== null &&
    (cached = preParentCache.get(parent)) === undefined &&
    !isNodePre(parent)
  ) {
    visited.push(parent);
    parent = parent.parentNode;
  }
  const resultNode = cached === undefined ? parent : cached;
  for (let i = 0; i < visited.length; i++) {
    preParentCache.set(visited[i], resultNode);
  }
  return resultNode;
}

function $convertTextDOMNode(domNode: Node): DOMConversionOutput {
  const domNode_ = domNode as Text;
  const parentDom = domNode.parentElement;
  invariant(parentDom !== null, 'Expected parentElement of Text not to be null');
  let textContent = domNode_.textContent || '';
  // No collapse and preserve segment break for pre, pre-wrap and pre-line
  if (findParentPreDOMNode(domNode_) !== null) {
    const parts = textContent.split(/(\r?\n|\t)/);
    const nodes: Array<LexicalNode> = [];
    const length = parts.length;
    for (let i = 0; i < length; i++) {
      const part = parts[i];
      if (part === '\n' || part === '\r\n') {
        nodes.push($createLineBreakNode());
      } else if (part === '\t') {
        nodes.push($createTabNode());
      } else if (part !== '') {
        nodes.push($createTextNode(part));
      }
    }
    return { node: nodes };
  }
  textContent = textContent.replaceAll('\r', '').replaceAll(/[ \t\n]+/g, ' ');
  if (textContent === '') {
    return { node: null };
  }
  if (textContent[0] === ' ') {
    // Traverse backward while in the same line. If content contains new line or tab -> potential
    // delete, other elements can borrow from this one. Deletion depends on whether it's also the
    // last space (see next condition: textContent[textContent.length - 1] === ' '))
    let previousText: null | Text = domNode_;
    let isStartOfLine = true;
    while (previousText !== null && (previousText = findTextInLine(previousText, false)) !== null) {
      const previousTextContent = previousText.textContent || '';
      if (previousTextContent.length > 0) {
        if (/[ \t\n]$/.test(previousTextContent)) {
          textContent = textContent.slice(1);
        }
        isStartOfLine = false;
        break;
      }
    }
    if (isStartOfLine) {
      textContent = textContent.slice(1);
    }
  }
  if (textContent[textContent.length - 1] === ' ') {
    // Traverse forward while in the same line, preserve if next inline will require a space
    let nextText: null | Text = domNode_;
    let isEndOfLine = true;
    while (nextText !== null && (nextText = findTextInLine(nextText, true)) !== null) {
      const nextTextContent = (nextText.textContent || '').replace(/^( |\t|\r?\n)+/, '');
      if (nextTextContent.length > 0) {
        isEndOfLine = false;
        break;
      }
    }
    if (isEndOfLine) {
      textContent = textContent.slice(0, textContent.length - 1);
    }
  }
  if (textContent === '') {
    return { node: null };
  }
  return { node: $createTextNode(textContent) };
}

function findTextInLine(text: Text, forward: boolean): null | Text {
  let node: Node = text;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let sibling: null | Node;
    while ((sibling = forward ? node.nextSibling : node.previousSibling) === null) {
      const parentElement = node.parentElement;
      if (parentElement === null) {
        return null;
      }
      node = parentElement;
    }
    node = sibling;
    if (isHTMLElement(node)) {
      const display = node.style.display;
      if (
        (display === '' && !isInlineDomNode(node)) ||
        (display !== '' && !display.startsWith('inline'))
      ) {
        return null;
      }
    }
    let descendant: null | Node = node;
    while ((descendant = forward ? node.firstChild : node.lastChild) !== null) {
      node = descendant;
    }
    if (isDOMTextNode(node)) {
      return node;
    } else if (node.nodeName === 'BR') {
      return null;
    }
  }
}

const nodeNameToTextFormat: Record<string, TextFormatType> = {
  code: 'code',
  em: 'italic',
  i: 'italic',
  mark: 'highlight',
  s: 'strikethrough',
  strong: 'bold',
  sub: 'subscript',
  sup: 'superscript',
  u: 'underline',
};

function convertTextFormatElement(domNode: HTMLElement): DOMConversionOutput {
  const format = nodeNameToTextFormat[domNode.nodeName.toLowerCase()];
  if (format === undefined) {
    return { node: null };
  }
  return {
    forChild: applyTextFormatFromStyle(domNode.style, format),
    node: null,
  };
}

export function $createTextNode(text = ''): TextNode {
  return $applyNodeReplacement(new TextNode(text));
}

export function $isTextNode(node: LexicalNode | null | undefined): node is TextNode {
  return node instanceof TextNode;
}

function applyTextFormatFromStyle(style: CSSStyleDeclaration, shouldApply?: TextFormatType) {
  const fontWeight = style.fontWeight;
  const textDecoration = style.textDecoration.split(' ');
  // Google Docs uses span tags + font-weight for bold text
  const hasBoldFontWeight = fontWeight === '700' || fontWeight === 'bold';
  // Google Docs uses span tags + text-decoration: line-through for strikethrough text
  const hasLinethroughTextDecoration = textDecoration.includes('line-through');
  // Google Docs uses span tags + font-style for italic text
  const hasItalicFontStyle = style.fontStyle === 'italic';
  // Google Docs uses span tags + text-decoration: underline for underline text
  const hasUnderlineTextDecoration = textDecoration.includes('underline');
  // Google Docs uses span tags + vertical-align to specify subscript and superscript
  const verticalAlign = style.verticalAlign;

  return (lexicalNode: LexicalNode) => {
    if (!$isTextNode(lexicalNode)) {
      return lexicalNode;
    }
    if (hasBoldFontWeight && !lexicalNode.hasFormat('bold')) {
      lexicalNode.toggleFormat('bold');
    }
    if (hasLinethroughTextDecoration && !lexicalNode.hasFormat('strikethrough')) {
      lexicalNode.toggleFormat('strikethrough');
    }
    if (hasItalicFontStyle && !lexicalNode.hasFormat('italic')) {
      lexicalNode.toggleFormat('italic');
    }
    if (hasUnderlineTextDecoration && !lexicalNode.hasFormat('underline')) {
      lexicalNode.toggleFormat('underline');
    }
    if (verticalAlign === 'sub' && !lexicalNode.hasFormat('subscript')) {
      lexicalNode.toggleFormat('subscript');
    }
    if (verticalAlign === 'super' && !lexicalNode.hasFormat('superscript')) {
      lexicalNode.toggleFormat('superscript');
    }

    if (shouldApply && !lexicalNode.hasFormat(shouldApply)) {
      lexicalNode.toggleFormat(shouldApply);
    }

    return lexicalNode;
  };
}

/**
 * The direction of a caret, 'next' points towards the end of the document
 * and 'previous' points towards the beginning
 */
export type CaretDirection = 'next' | 'previous';
/**
 * A type utility to flip next and previous
 */
export type FlipDirection<D extends CaretDirection> = (typeof FLIP_DIRECTION)[D];
/**
 * A sibling caret type points from a LexicalNode origin to its next or previous sibling,
 * and a child caret type points from an ElementNode origin to its first or last child.
 */
export type CaretType = 'sibling' | 'child';
/**
 * The RootMode is specified in all caret traversals where the traversal can go up
 * towards the root. 'root' means that it will stop at the document root,
 * and 'shadowRoot' will stop at the document root or any shadow root
 * (per {@link $isRootOrShadowRoot}).
 */
export type RootMode = 'root' | 'shadowRoot';

const FLIP_DIRECTION = {
  next: 'previous',
  previous: 'next',
} as const;

/** @noInheritDoc */
export interface BaseCaret<T extends LexicalNode, D extends CaretDirection, Type>
  extends Iterable<SiblingCaret<LexicalNode, D>> {
  /** The origin node of this caret, typically this is what you will use in traversals */
  readonly origin: T;
  /** sibling for a SiblingCaret (pointing at the next or previous sibling) or child for a ChildCaret (pointing at the first or last child) */
  readonly type: Type;
  /** next if pointing at the next sibling or first child, previous if pointing at the previous sibling or last child */
  readonly direction: D;
  /** Get the ElementNode that is the logical parent (`origin` for `ChildCaret`, `origin.getParent()` for `SiblingCaret`) */
  getParentAtCaret: () => null | ElementNode;
  /** Get the node connected to the origin in the caret's direction, or null if there is no node */
  getNodeAtCaret: () => null | LexicalNode;
  /** Get a new SiblingCaret from getNodeAtCaret() in the same direction. */
  getAdjacentCaret: () => null | SiblingCaret<LexicalNode, D>;
  /**
   * Get a new SiblingCaret with this same node
   */
  getSiblingCaret: () => SiblingCaret<T, D>;
  /** Remove the getNodeAtCaret() node that this caret is pointing towards, if it exists */
  remove: () => this;
  /**
   * Insert a node connected to origin in this direction (before the node that this caret is pointing towards, if any existed).
   * For a `SiblingCaret` this is `origin.insertAfter(node)` for next, or `origin.insertBefore(node)` for previous.
   * For a `ChildCaret` this is `origin.splice(0, 0, [node])` for next or `origin.append(node)` for previous.
   */
  insert: (node: LexicalNode) => this;
  /** If getNodeAtCaret() is not null then replace it with node, otherwise insert node */
  replaceOrInsert: (node: LexicalNode, includeChildren?: boolean) => this;
  /**
   * Splice an iterable (typically an Array) of nodes into this location.
   *
   * @param deleteCount The number of existing nodes to replace or delete
   * @param nodes An iterable of nodes that will be inserted in this location, using replace instead of insert for the first deleteCount nodes
   * @param nodesDirection The direction of the nodes iterable, defaults to 'next'
   */
  splice: (
    deleteCount: number,
    nodes: Iterable<LexicalNode>,
    nodesDirection?: CaretDirection,
  ) => this;
}

/**
 * A RangeSelection expressed as a pair of Carets
 */
export interface CaretRange<D extends CaretDirection = CaretDirection>
  extends Iterable<NodeCaret<D>> {
  readonly type: 'node-caret-range';
  readonly direction: D;
  anchor: PointCaret<D>;
  focus: PointCaret<D>;
  /** Return true if anchor and focus are the same caret */
  isCollapsed: () => boolean;
  /**
   * Iterate the carets between anchor and focus in a pre-order fashion, note
   * that this does not include any text slices represented by the anchor and/or
   * focus. Those are accessed separately from getTextSlices.
   *
   * An ElementNode origin will be yielded as a ChildCaret on enter,
   * and a SiblingCaret on leave.
   */
  iterNodeCarets: (rootMode?: RootMode) => IterableIterator<NodeCaret<D>>;
  /**
   * There are between zero and two non-null TextSliceCarets for a CaretRange.
   * Note that when anchor and focus share an origin node the second element
   * will be null because the slice is entirely represented by the first element.
   *
   * `[slice, slice]`: anchor and focus are TextPointCaret with distinct origin nodes
   * `[slice, null]`: anchor is a TextPointCaret
   * `[null, slice]`: focus is a TextPointCaret
   * `[null, null]`: Neither anchor nor focus are TextPointCarets
   */
  getTextSlices: () => TextPointCaretSliceTuple<D>;
}

export interface StepwiseIteratorConfig<State, Stop, Value> {
  readonly initial: State | Stop;
  readonly hasNext: (value: State | Stop) => value is State;
  readonly step: (value: State) => State | Stop;
  readonly map: (value: State) => Value;
}

/**
 * A NodeCaret is the combination of an origin node and a direction
 * that points towards where a connected node will be fetched, inserted,
 * or replaced. A SiblingCaret points from a node to its next or previous
 * sibling, and a ChildCaret points to its first or last child
 * (using next or previous as direction, for symmetry with SiblingCaret).
 *
 * The differences between NodeCaret and PointType are:
 * - NodeCaret can only be used to refer to an entire node (PointCaret is used when a full analog is needed). A PointType of text type can be used to refer to a specific location inside of a TextNode.
 * - NodeCaret stores an origin node, type (sibling or child), and direction (next or previous). A PointType stores a type (text or element), the key of a node, and a text or child offset within that node.
 * - NodeCaret is directional and always refers to a very specific node, eliminating all ambiguity. PointType can refer to the location before or at a node depending on context.
 * - NodeCaret is more robust to nearby mutations, as it relies only on a node's direct connections. An element Any change to the count of previous siblings in an element PointType will invalidate it.
 * - NodeCaret is designed to work more directly with the internal representation of the document tree, making it suitable for use in traversals without performing any redundant work.
 *
 * The caret does *not* update in response to any mutations, you should
 * not persist it across editor updates, and using a caret after its origin
 * node has been removed or replaced may result in runtime errors.
 */
export type NodeCaret<D extends CaretDirection = CaretDirection> =
  | SiblingCaret<LexicalNode, D>
  | ChildCaret<ElementNode, D>;

/**
 * A PointCaret is a NodeCaret that also includes a
 * TextPointCaret type which refers to a specific offset of a TextNode.
 * This type is separate because it is not relevant to general node traversal
 * so it doesn't make sense to have it show up except when defining
 * a CaretRange and in those cases there will be at most two of them only
 * at the boundaries.
 *
 * The addition of TextPointCaret allows this type to represent any location
 * that is representable by PointType, as the TextPointCaret refers to a
 * specific offset within a TextNode.
 */
export type PointCaret<D extends CaretDirection = CaretDirection> =
  | TextPointCaret<TextNode, D>
  | SiblingCaret<LexicalNode, D>
  | ChildCaret<ElementNode, D>;

/**
 * A SiblingCaret points from an origin LexicalNode towards its next or previous sibling.
 */
export interface SiblingCaret<
  T extends LexicalNode = LexicalNode,
  D extends CaretDirection = CaretDirection,
> extends BaseCaret<T, D, 'sibling'> {
  /** Get a new caret with the latest origin pointer */
  getLatest: () => SiblingCaret<T, D>;
  /**
   * If the origin of this node is an ElementNode, return the ChildCaret of this origin in the same direction.
   * If the origin is not an ElementNode, this will return null.
   */
  getChildCaret: () => null | ChildCaret<T & ElementNode, D>;
  /**
   * Get the caret in the same direction from the parent of this origin.
   *
   * @param mode 'root' to return null at the root, 'shadowRoot' to return null at the root or any shadow root
   * @returns A SiblingCaret with the parent of this origin, or null if the parent is a root according to mode.
   */
  getParentCaret: (mode?: RootMode) => null | SiblingCaret<ElementNode, D>;
  /**
   * Return true if other is a SiblingCaret or TextPointCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSameNodeCaret: (
    other: null | undefined | PointCaret,
  ) => other is SiblingCaret<T, D> | T extends TextNode ? TextPointCaret<T & TextNode, D> : never;
  /**
   * Return true if other is a SiblingCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSamePointCaret: (other: null | undefined | PointCaret) => other is SiblingCaret<T, D>;
  /**
   * Get a new NodeCaret with the head and tail of its directional arrow flipped, such that flipping twice is the identity.
   * For example, given a non-empty parent with a firstChild and lastChild, and a second emptyParent node with no children:
   *
   * @example
   * ```
   * caret.getFlipped().getFlipped().is(caret) === true;
   * $getChildCaret(parent, 'next').getFlipped().is($getSiblingCaret(firstChild, 'previous')) === true;
   * $getSiblingCaret(lastChild, 'next').getFlipped().is($getChildCaret(parent, 'previous')) === true;
   * $getSiblingCaret(firstChild, 'next).getFlipped().is($getSiblingCaret(lastChild, 'previous')) === true;
   * $getChildCaret(emptyParent, 'next').getFlipped().is($getChildCaret(emptyParent, 'previous')) === true;
   * ```
   */
  getFlipped: () => NodeCaret<FlipDirection<D>>;
}

/**
 * A ChildCaret points from an origin ElementNode towards its first or last child.
 */
export interface ChildCaret<
  T extends ElementNode = ElementNode,
  D extends CaretDirection = CaretDirection,
> extends BaseCaret<T, D, 'child'> {
  /** Get a new caret with the latest origin pointer */
  getLatest: () => ChildCaret<T, D>;
  getParentCaret: (mode?: RootMode) => null | SiblingCaret<T, D>;
  getParentAtCaret: () => T;
  /** Return this, the ChildCaret is already a child caret of its origin */
  getChildCaret: () => this;
  /**
   * Return true if other is a ChildCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSameNodeCaret: (other: null | undefined | PointCaret) => other is ChildCaret<T, D>;
  /**
   * Return true if other is a ChildCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSamePointCaret: (other: null | undefined | PointCaret) => other is ChildCaret<T, D>;
  /**
   * Get a new NodeCaret with the head and tail of its directional arrow flipped, such that flipping twice is the identity.
   * For example, given a non-empty parent with a firstChild and lastChild, and a second emptyParent node with no children:
   *
   * @example
   * ```
   * caret.getFlipped().getFlipped().is(caret) === true;
   * $getChildCaret(parent, 'next').getFlipped().is($getSiblingCaret(firstChild, 'previous')) === true;
   * $getSiblingCaret(lastChild, 'next').getFlipped().is($getChildCaret(parent, 'previous')) === true;
   * $getSiblingCaret(firstChild, 'next).getFlipped().is($getSiblingCaret(lastChild, 'previous')) === true;
   * $getChildCaret(emptyParent, 'next').getFlipped().is($getChildCaret(emptyParent, 'previous')) === true;
   * ```
   */
  getFlipped: () => NodeCaret<FlipDirection<D>>;
}

/**
 * A TextPointCaret is a special case of a SiblingCaret that also carries
 * an offset used for representing partially selected TextNode at the edges
 * of a CaretRange.
 *
 * The direction determines which part of the text is adjacent to the caret,
 * if next it's all of the text after offset. If previous, it's all of the
 * text before offset.
 *
 * While this can be used in place of any SiblingCaret of a TextNode,
 * the offset into the text will be ignored except in contexts that
 * specifically use the TextPointCaret or PointCaret types.
 */
export interface TextPointCaret<
  T extends TextNode = TextNode,
  D extends CaretDirection = CaretDirection,
> extends BaseCaret<T, D, 'text'> {
  /** The offset into the string */
  readonly offset: number;
  /** Get a new caret with the latest origin pointer */
  getLatest: () => TextPointCaret<T, D>;
  /**
   * A TextPointCaret can not have a ChildCaret.
   */
  getChildCaret: () => null;
  /**
   * Get the caret in the same direction from the parent of this origin.
   *
   * @param mode 'root' to return null at the root, 'shadowRoot' to return null at the root or any shadow root
   * @returns A SiblingCaret with the parent of this origin, or null if the parent is a root according to mode.
   */
  getParentCaret: (mode?: RootMode) => null | SiblingCaret<ElementNode, D>;
  /**
   * Return true if other is a TextPointCaret or SiblingCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSameNodeCaret: (
    other: null | undefined | PointCaret,
  ) => other is TextPointCaret<T, D> | SiblingCaret<T, D>;
  /**
   * Return true if other is a ChildCaret with the same
   * origin (by node key comparison) and direction.
   */
  isSamePointCaret: (other: null | undefined | PointCaret) => other is TextPointCaret<T, D>;
  /**
   * Get a new TextPointCaret with the head and tail of its directional arrow flipped, such that flipping twice is the identity.
   * For a TextPointCaret this merely flips the direction because the arrow is internal to the node.
   *
   * @example
   * ```
   * caret.getFlipped().getFlipped().is(caret) === true;
   * ```
   */
  getFlipped: () => TextPointCaret<T, FlipDirection<D>>;
}

/**
 * A TextPointCaretSlice is a wrapper for a TextPointCaret that carries a signed
 * distance representing the direction and amount of text selected from the given
 * caret. A negative distance means that text before offset is selected, a
 * positive distance means that text after offset is selected. The offset+distance
 * pair is not affected in any way by the direction of the caret.
 */
export interface TextPointCaretSlice<
  T extends TextNode = TextNode,
  D extends CaretDirection = CaretDirection,
> {
  readonly type: 'slice';
  readonly caret: TextPointCaret<T, D>;
  readonly distance: number;
  /**
   * @returns absolute coordinates into the text (for use with `text.slice(...)`)
   */
  getSliceIndices: () => [startIndex: number, endIndex: number];
  /**
   * @returns The text represented by the slice
   */
  getTextContent: () => string;
  /**
   * @returns The size of the text represented by the slice
   */
  getTextContentSize: () => number;
  /**
   * Remove the slice of text from the contained caret, returning a new
   * TextPointCaret without the wrapper (since the size would be zero).
   *
   * Note that this is a lower-level utility that does not have any specific
   * behavior for 'segmented' or 'token' modes and it will not remove
   * an empty TextNode.
   *
   * @returns The inner TextPointCaret with the same offset and direction
   *          and the latest TextNode origin after mutation
   */
  removeTextSlice(): TextPointCaret<T, D>;
}

/**
 * A utility type to specify that a CaretRange may have zero,
 * one, or two associated TextPointCaretSlice. If the anchor
 * and focus are on the same node, the anchorSlice will contain
 * the slice and focusSlie will be null.
 */
export type TextPointCaretSliceTuple<D extends CaretDirection> = readonly [
  anchorSlice: null | TextPointCaretSlice<TextNode, D>,
  focusSlice: null | TextPointCaretSlice<TextNode, D>,
];

abstract class AbstractCaret<T extends LexicalNode, D extends CaretDirection, Type>
  implements BaseCaret<T, D, Type>
{
  abstract readonly type: Type;
  abstract readonly direction: D;
  readonly origin: T;
  abstract getNodeAtCaret(): null | LexicalNode;
  abstract insert(node: LexicalNode): this;
  abstract getParentAtCaret(): null | ElementNode;
  constructor(origin: T) {
    this.origin = origin;
  }
  [Symbol.iterator](): IterableIterator<SiblingCaret<LexicalNode, D>> {
    return makeStepwiseIterator({
      hasNext: $isSiblingCaret,
      initial: this.getAdjacentCaret(),
      map: (caret) => caret,
      step: (caret: SiblingCaret<LexicalNode, D>) => caret.getAdjacentCaret(),
    });
  }
  getAdjacentCaret(): null | SiblingCaret<LexicalNode, D> {
    return $getSiblingCaret(this.getNodeAtCaret(), this.direction);
  }
  getSiblingCaret(): SiblingCaret<T, D> {
    return $getSiblingCaret(this.origin, this.direction);
  }
  remove(): this {
    const node = this.getNodeAtCaret();
    if (node) {
      node.remove();
    }
    return this;
  }
  replaceOrInsert(node: LexicalNode, includeChildren?: boolean): this {
    const target = this.getNodeAtCaret();
    if (node.is(this.origin) || node.is(target)) {
      // do nothing
    } else if (target === null) {
      this.insert(node);
    } else {
      target.replace(node, includeChildren);
    }
    return this;
  }
  splice(
    deleteCount: number,
    nodes: Iterable<LexicalNode>,
    nodesDirection: CaretDirection = 'next',
  ): this {
    const nodeIter = nodesDirection === this.direction ? nodes : Array.from(nodes).reverse();
    let caret: SiblingCaret<LexicalNode, D> | this = this;
    const parent = this.getParentAtCaret();
    const nodesToRemove = new Map<NodeKey, LexicalNode>();
    // Find all of the nodes we expect to remove first, so
    // we don't have to worry about the cases where there is
    // overlap between the nodes to insert and the nodes to
    // remove
    for (
      let removeCaret = caret.getAdjacentCaret();
      removeCaret !== null && nodesToRemove.size < deleteCount;
      removeCaret = removeCaret.getAdjacentCaret()
    ) {
      const writableNode = removeCaret.origin.getWritable();
      nodesToRemove.set(writableNode.getKey(), writableNode);
    }
    // TODO: Optimize this to work directly with node internals
    for (const node of nodeIter) {
      if (nodesToRemove.size > 0) {
        // For some reason `npm run tsc-extension` needs this annotation?
        const target: null | LexicalNode = caret.getNodeAtCaret();
        if (target) {
          nodesToRemove.delete(target.getKey());
          nodesToRemove.delete(node.getKey());
          if (target.is(node) || caret.origin.is(node)) {
            // do nothing, it's already in the right place
          } else {
            const nodeParent = node.getParent();
            if (nodeParent && nodeParent.is(parent)) {
              // It's a sibling somewhere else in this node, so unparent it first
              node.remove();
            }
            target.replace(node);
          }
        } else {
          invariant(
            target !== null,
            'NodeCaret.splice: Underflow of expected nodesToRemove during splice (keys: %s)',
            Array.from(nodesToRemove).join(' '),
          );
        }
      } else {
        caret.insert(node);
      }
      caret = $getSiblingCaret(node, this.direction);
    }
    for (const node of nodesToRemove.values()) {
      node.remove();
    }
    return this;
  }
}

abstract class AbstractChildCaret<T extends ElementNode, D extends CaretDirection>
  extends AbstractCaret<T, D, 'child'>
  implements ChildCaret<T, D>
{
  readonly type = 'child';
  getLatest(): ChildCaret<T, D> {
    const origin = this.origin.getLatest();
    return origin === this.origin ? this : $getChildCaret(origin, this.direction);
  }
  /**
   * Get the SiblingCaret from this origin in the same direction.
   *
   * @param mode 'root' to return null at the root, 'shadowRoot' to return null at the root or any shadow root
   * @returns A SiblingCaret with this origin, or null if origin is a root according to mode.
   */
  getParentCaret(mode: RootMode = 'root'): null | SiblingCaret<T, D> {
    return $getSiblingCaret($filterByMode(this.getParentAtCaret(), mode), this.direction);
  }
  getFlipped(): NodeCaret<FlipDirection<D>> {
    const dir = flipDirection(this.direction);
    return $getSiblingCaret(this.getNodeAtCaret(), dir) || $getChildCaret(this.origin, dir);
  }
  getParentAtCaret(): T {
    return this.origin;
  }
  getChildCaret(): this {
    return this;
  }
  isSameNodeCaret(other: null | undefined | PointCaret): other is ChildCaret<T, D> {
    return (
      other instanceof AbstractChildCaret &&
      this.direction === other.direction &&
      this.origin.is(other.origin)
    );
  }
  isSamePointCaret(other: null | undefined | PointCaret): other is ChildCaret<T, D> {
    return this.isSameNodeCaret(other);
  }
}

class ChildCaretFirst<T extends ElementNode> extends AbstractChildCaret<T, 'next'> {
  readonly direction = 'next';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getFirstChild();
  }
  insert(node: LexicalNode): this {
    this.origin.splice(0, 0, [node]);
    return this;
  }
}

class ChildCaretLast<T extends ElementNode> extends AbstractChildCaret<T, 'previous'> {
  readonly direction = 'previous';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getLastChild();
  }
  insert(node: LexicalNode): this {
    this.origin.splice(this.origin.getChildrenSize(), 0, [node]);
    return this;
  }
}

const MODE_PREDICATE = {
  root: $isRootNode,
  shadowRoot: $isRootOrShadowRoot,
} as const;

/**
 * Flip a direction ('next' -> 'previous'; 'previous' -> 'next').
 *
 * Note that TypeScript can't prove that FlipDirection is its own
 * inverse (but if you have a concrete 'next' or 'previous' it will
 * simplify accordingly).
 *
 * @param direction A direction
 * @returns The opposite direction
 */
export function flipDirection<D extends CaretDirection>(direction: D): FlipDirection<D> {
  return FLIP_DIRECTION[direction];
}

function $filterByMode<T extends ElementNode>(node: T | null, mode: RootMode = 'root'): T | null {
  return MODE_PREDICATE[mode](node) ? null : node;
}

abstract class AbstractSiblingCaret<T extends LexicalNode, D extends CaretDirection>
  extends AbstractCaret<T, D, 'sibling'>
  implements SiblingCaret<T, D>
{
  readonly type = 'sibling';
  getLatest(): SiblingCaret<T, D> {
    const origin = this.origin.getLatest();
    return origin === this.origin ? this : $getSiblingCaret(origin, this.direction);
  }
  getSiblingCaret(): this {
    return this;
  }
  getParentAtCaret(): null | ElementNode {
    return this.origin.getParent();
  }
  getChildCaret(): ChildCaret<T & ElementNode, D> | null {
    return $isElementNode(this.origin) ? $getChildCaret(this.origin, this.direction) : null;
  }
  getParentCaret(mode: RootMode = 'root'): SiblingCaret<ElementNode, D> | null {
    return $getSiblingCaret($filterByMode(this.getParentAtCaret(), mode), this.direction);
  }
  getFlipped(): NodeCaret<FlipDirection<D>> {
    const dir = flipDirection(this.direction);
    return (
      $getSiblingCaret(this.getNodeAtCaret(), dir) ||
      $getChildCaret(this.origin.getParentOrThrow(), dir)
    );
  }
  isSamePointCaret(other: null | undefined | PointCaret): other is SiblingCaret<T, D> {
    return (
      other instanceof AbstractSiblingCaret &&
      this.direction === other.direction &&
      this.origin.is(other.origin)
    );
  }
  isSameNodeCaret(
    other: null | undefined | PointCaret,
  ): other is T | SiblingCaret<T, D> extends TextNode ? TextPointCaret<T & TextNode, D> : never {
    return (
      (other instanceof AbstractSiblingCaret || other instanceof AbstractTextPointCaret) &&
      this.direction === other.direction &&
      this.origin.is(other.origin)
    );
  }
}

abstract class AbstractTextPointCaret<T extends TextNode, D extends CaretDirection>
  extends AbstractCaret<T, D, 'text'>
  implements TextPointCaret<T, D>
{
  readonly type = 'text';
  readonly offset: number;
  abstract readonly direction: D;
  constructor(origin: T, offset: number) {
    super(origin);
    this.offset = offset;
  }
  getLatest(): TextPointCaret<T, D> {
    const origin = this.origin.getLatest();
    return origin === this.origin ? this : $getTextPointCaret(origin, this.direction, this.offset);
  }
  getParentAtCaret(): null | ElementNode {
    return this.origin.getParent();
  }
  getChildCaret(): null {
    return null;
  }
  getParentCaret(mode: RootMode = 'root'): SiblingCaret<ElementNode, D> | null {
    return $getSiblingCaret($filterByMode(this.getParentAtCaret(), mode), this.direction);
  }
  getFlipped(): TextPointCaret<T, FlipDirection<D>> {
    return $getTextPointCaret(this.origin, flipDirection(this.direction), this.offset);
  }
  isSamePointCaret(other: null | undefined | PointCaret): other is TextPointCaret<T, D> {
    return (
      other instanceof AbstractTextPointCaret &&
      this.direction === other.direction &&
      this.origin.is(other.origin) &&
      this.offset === other.offset
    );
  }
  isSameNodeCaret(
    other: null | undefined | PointCaret,
  ): other is SiblingCaret<T, D> | TextPointCaret<T, D> {
    return (
      (other instanceof AbstractSiblingCaret || other instanceof AbstractTextPointCaret) &&
      this.direction === other.direction &&
      this.origin.is(other.origin)
    );
  }
  getSiblingCaret(): SiblingCaret<T, D> {
    return $getSiblingCaret(this.origin, this.direction);
  }
}
/**
 * Guard to check if the given caret is specifically a TextPointCaret
 *
 * @param caret Any caret
 * @returns true if it is a TextPointCaret
 */
export function $isTextPointCaret<D extends CaretDirection>(
  caret: null | undefined | PointCaret<D>,
): caret is TextPointCaret<TextNode, D> {
  return caret instanceof AbstractTextPointCaret;
}

/**
 * Guard to check if the given argument is any type of caret
 *
 * @param caret
 * @returns true if caret is any type of caret
 */
export function $isNodeCaret<D extends CaretDirection>(
  caret: null | undefined | PointCaret<D>,
): caret is PointCaret<D> {
  return caret instanceof AbstractCaret;
}

/**
 * Guard to check if the given argument is specifically a SiblingCaret (or TextPointCaret)
 *
 * @param caret
 * @returns true if caret is a SiblingCaret
 */
export function $isSiblingCaret<D extends CaretDirection>(
  caret: null | undefined | PointCaret<D>,
): caret is SiblingCaret<LexicalNode, D> {
  return caret instanceof AbstractSiblingCaret;
}

/**
 * Guard to check if the given argument is specifically a ChildCaret

 * @param caret 
 * @returns true if caret is a ChildCaret
 */
export function $isChildCaret<D extends CaretDirection>(
  caret: null | undefined | PointCaret<D>,
): caret is ChildCaret<ElementNode, D> {
  return caret instanceof AbstractChildCaret;
}

class SiblingCaretNext<T extends LexicalNode> extends AbstractSiblingCaret<T, 'next'> {
  readonly direction = 'next';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getNextSibling();
  }
  insert(node: LexicalNode): this {
    this.origin.insertAfter(node);
    return this;
  }
}

class SiblingCaretPrevious<T extends LexicalNode> extends AbstractSiblingCaret<T, 'previous'> {
  readonly direction = 'previous';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getPreviousSibling();
  }
  insert(node: LexicalNode): this {
    this.origin.insertBefore(node);
    return this;
  }
}

class TextPointCaretNext<T extends TextNode> extends AbstractTextPointCaret<T, 'next'> {
  readonly direction = 'next';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getNextSibling();
  }
  insert(node: LexicalNode): this {
    this.origin.insertAfter(node);
    return this;
  }
}

class TextPointCaretPrevious<T extends TextNode> extends AbstractTextPointCaret<T, 'previous'> {
  readonly direction = 'previous';
  getNodeAtCaret(): null | LexicalNode {
    return this.origin.getPreviousSibling();
  }
  insert(node: LexicalNode): this {
    this.origin.insertBefore(node);
    return this;
  }
}

const TEXT_CTOR = {
  next: TextPointCaretNext,
  previous: TextPointCaretPrevious,
} as const;

const SIBLING_CTOR = {
  next: SiblingCaretNext,
  previous: SiblingCaretPrevious,
} as const;

const CHILD_CTOR = {
  next: ChildCaretFirst,
  previous: ChildCaretLast,
};

/**
 * Get a caret that points at the next or previous sibling of the given origin node.
 *
 * @param origin The origin node
 * @param direction 'next' or 'previous'
 * @returns null if origin is null, otherwise a SiblingCaret for this origin and direction
 */
export function $getSiblingCaret<T extends LexicalNode, D extends CaretDirection>(
  origin: T,
  direction: D,
): SiblingCaret<T, D>;
export function $getSiblingCaret<T extends LexicalNode, D extends CaretDirection>(
  origin: null | T,
  direction: D,
): null | SiblingCaret<T, D>;
export function $getSiblingCaret(
  origin: null | LexicalNode,
  direction: CaretDirection,
): null | SiblingCaret<LexicalNode, CaretDirection> {
  return origin ? new SIBLING_CTOR[direction](origin) : null;
}

/**
 * Construct a TextPointCaret
 *
 * @param origin The TextNode
 * @param direction The direction (next points to the end of the text, previous points to the beginning)
 * @param offset The offset into the text in absolute positive string coordinates (0 is the start)
 * @returns a TextPointCaret
 */
export function $getTextPointCaret<T extends TextNode, D extends CaretDirection>(
  origin: T,
  direction: D,
  offset: number | CaretDirection,
): TextPointCaret<T, D>;
export function $getTextPointCaret<T extends TextNode, D extends CaretDirection>(
  origin: null | T,
  direction: D,
  offset: number | CaretDirection,
): null | TextPointCaret<T, D>;
export function $getTextPointCaret(
  origin: TextNode | null,
  direction: CaretDirection,
  offset: number | CaretDirection,
): null | TextPointCaret<TextNode, CaretDirection> {
  return origin ? new TEXT_CTOR[direction](origin, $getTextNodeOffset(origin, offset)) : null;
}

/**
 * Get a normalized offset into a TextNode given a numeric offset or a
 * direction for which end of the string to use. Throws in dev if the offset
 * is not in the bounds of the text content size.
 *
 * @param origin a TextNode
 * @param offset An absolute offset into the TextNode string, or a direction for which end to use as the offset
 * @param mode If 'error' (the default) out of bounds offsets will be an error in dev. Otherwise it will clamp to a valid offset.
 * @returns An absolute offset into the TextNode string
 */
export function $getTextNodeOffset(
  origin: TextNode,
  offset: number | CaretDirection,
  mode: 'error' | 'clamp' = 'error',
): number {
  const size = origin.getTextContentSize();
  let numericOffset = offset === 'next' ? size : offset === 'previous' ? 0 : offset;
  if (numericOffset < 0 || numericOffset > size) {
    devInvariant(
      mode === 'clamp',
      '$getTextNodeOffset: invalid offset %s for size %s at key %s',
      String(offset),
      String(size),
      origin.getKey(),
    );
    // Clamp invalid offsets in prod
    numericOffset = numericOffset < 0 ? 0 : size;
  }
  return numericOffset;
}

/**
 * Construct a TextPointCaretSlice given a TextPointCaret and a signed distance. The
 * distance should be negative to slice text before the caret's offset, and positive
 * to slice text after the offset. The direction of the caret itself is not
 * relevant to the string coordinates when working with a TextPointCaretSlice
 * but mutation operations will preserve the direction.
 *
 * @param caret
 * @param distance
 * @returns TextPointCaretSlice
 */
export function $getTextPointCaretSlice<T extends TextNode, D extends CaretDirection>(
  caret: TextPointCaret<T, D>,
  distance: number,
): TextPointCaretSlice<T, D> {
  return new TextPointCaretSliceImpl(caret, distance);
}

/**
 * Get a caret that points at the first or last child of the given origin node,
 * which must be an ElementNode.
 *
 * @param origin The origin ElementNode
 * @param direction 'next' for first child or 'previous' for last child
 * @returns null if origin is null or not an ElementNode, otherwise a ChildCaret for this origin and direction
 */
export function $getChildCaret<T extends ElementNode, D extends CaretDirection>(
  origin: T,
  direction: D,
): ChildCaret<T, D>;
export function $getChildCaret(
  origin: null | LexicalNode,
  direction: CaretDirection,
): null | ChildCaret<ElementNode, CaretDirection> {
  return $isElementNode(origin) ? new CHILD_CTOR[direction](origin) : null;
}

/**
 * Gets the ChildCaret if one is possible at this caret origin, otherwise return the caret
 */
export function $getChildCaretOrSelf<Caret extends PointCaret | null>(
  caret: Caret,
): Caret | ChildCaret<ElementNode, NonNullable<Caret>['direction']> {
  return (caret && caret.getChildCaret()) || caret;
}

/**
 * Gets the adjacent caret, if not-null and if the origin of the adjacent caret is an ElementNode, then return
 * the ChildCaret. This can be used along with the getParentAdjacentCaret method to perform a full DFS
 * style traversal of the tree.
 *
 * @param caret The caret to start at
 */
export function $getAdjacentChildCaret<D extends CaretDirection>(
  caret: null | NodeCaret<D>,
): null | NodeCaret<D> {
  return caret && $getChildCaretOrSelf(caret.getAdjacentCaret());
}

class CaretRangeImpl<D extends CaretDirection> implements CaretRange<D> {
  readonly type = 'node-caret-range';
  readonly direction: D;
  anchor: PointCaret<D>;
  focus: PointCaret<D>;
  constructor(anchor: PointCaret<D>, focus: PointCaret<D>, direction: D) {
    this.anchor = anchor;
    this.focus = focus;
    this.direction = direction;
  }
  getLatest(): CaretRange<D> {
    const anchor = this.anchor.getLatest();
    const focus = this.focus.getLatest();
    return anchor === this.anchor && focus === this.focus
      ? this
      : new CaretRangeImpl(anchor, focus, this.direction);
  }
  isCollapsed(): boolean {
    return this.anchor.isSamePointCaret(this.focus);
  }
  getTextSlices(): TextPointCaretSliceTuple<D> {
    const getSlice = (k: 'anchor' | 'focus') => {
      const caret = this[k].getLatest();
      return $isTextPointCaret(caret) ? $getSliceFromTextPointCaret(caret, k) : null;
    };
    const anchorSlice = getSlice('anchor');
    const focusSlice = getSlice('focus');
    if (anchorSlice && focusSlice) {
      const { caret: anchorCaret } = anchorSlice;
      const { caret: focusCaret } = focusSlice;
      if (anchorCaret.isSameNodeCaret(focusCaret)) {
        return [$getTextPointCaretSlice(anchorCaret, focusCaret.offset - anchorCaret.offset), null];
      }
    }
    return [anchorSlice, focusSlice];
  }
  iterNodeCarets(rootMode: RootMode = 'root'): IterableIterator<NodeCaret<D>> {
    const anchor = $isTextPointCaret(this.anchor)
      ? this.anchor.getSiblingCaret()
      : this.anchor.getLatest();
    const focus = this.focus.getLatest();
    const isTextFocus = $isTextPointCaret(focus);
    const step = (state: NodeCaret<D>) =>
      state.isSameNodeCaret(focus)
        ? null
        : $getAdjacentChildCaret(state) || state.getParentCaret(rootMode);
    return makeStepwiseIterator({
      hasNext: (state: null | NodeCaret<D>): state is NodeCaret<D> =>
        state !== null && !(isTextFocus && focus.isSameNodeCaret(state)),
      initial: anchor.isSameNodeCaret(focus) ? null : step(anchor),
      map: (state) => state,
      step,
    });
  }
  [Symbol.iterator](): IterableIterator<NodeCaret<D>> {
    return this.iterNodeCarets('root');
  }
}

class TextPointCaretSliceImpl<T extends TextNode, D extends CaretDirection>
  implements TextPointCaretSlice<T, D>
{
  readonly type = 'slice';
  readonly caret: TextPointCaret<T, D>;
  readonly distance: number;
  constructor(caret: TextPointCaret<T, D>, distance: number) {
    this.caret = caret;
    this.distance = distance;
  }
  getSliceIndices(): [startIndex: number, endIndex: number] {
    const {
      distance,
      caret: { offset },
    } = this;
    const offsetB = offset + distance;
    return offsetB < offset ? [offsetB, offset] : [offset, offsetB];
  }

  getTextContent(): string {
    const [startIndex, endIndex] = this.getSliceIndices();
    return this.caret.origin.getTextContent().slice(startIndex, endIndex);
  }

  getTextContentSize(): number {
    return Math.abs(this.distance);
  }

  removeTextSlice(): TextPointCaret<T, D> {
    const {
      caret: { origin, direction },
    } = this;
    const [indexStart, indexEnd] = this.getSliceIndices();
    const text = origin.getTextContent();
    return $getTextPointCaret(
      origin.setTextContent(text.slice(0, indexStart) + text.slice(indexEnd)),
      direction,
      indexStart,
    );
  }
}

function $getSliceFromTextPointCaret<T extends TextNode, D extends CaretDirection>(
  caret: TextPointCaret<T, D>,
  anchorOrFocus: 'anchor' | 'focus',
): TextPointCaretSlice<T, D> {
  const { direction, origin } = caret;
  const offsetB = $getTextNodeOffset(
    origin,
    anchorOrFocus === 'focus' ? flipDirection(direction) : direction,
  );
  return $getTextPointCaretSlice(caret, offsetB - caret.offset);
}

/**
 * Guard to check for a TextPointCaretSlice
 *
 * @param caretOrSlice A caret or slice
 * @returns true if caretOrSlice is a TextPointCaretSlice
 */
export function $isTextPointCaretSlice<D extends CaretDirection>(
  caretOrSlice: null | undefined | PointCaret<D> | TextPointCaretSlice<TextNode, D>,
): caretOrSlice is TextPointCaretSlice<TextNode, D> {
  return caretOrSlice instanceof TextPointCaretSliceImpl;
}

/**
 * Construct a CaretRange that starts at anchor and goes to the end of the
 * document in the anchor caret's direction.
 */
export function $extendCaretToRange<D extends CaretDirection>(
  anchor: PointCaret<D>,
): CaretRange<D> {
  return $getCaretRange(anchor, $getSiblingCaret($getRoot(), anchor.direction));
}

/**
 * Construct a collapsed CaretRange that starts and ends at anchor.
 */
export function $getCollapsedCaretRange<D extends CaretDirection>(
  anchor: PointCaret<D>,
): CaretRange<D> {
  return $getCaretRange(anchor, anchor);
}

/**
 * Construct a CaretRange from anchor and focus carets pointing in the
 * same direction. In order to get the expected behavior,
 * the anchor must point towards the focus or be the same point.
 *
 * In the 'next' direction the anchor should be at or before the
 * focus in the document. In the 'previous' direction the anchor
 * should be at or after the focus in the document
 * (similar to a backwards RangeSelection).
 *
 * @param anchor
 * @param focus
 * @returns a CaretRange
 */
export function $getCaretRange<D extends CaretDirection>(
  anchor: PointCaret<D>,
  focus: PointCaret<D>,
): CaretRange<D> {
  invariant(
    anchor.direction === focus.direction,
    '$getCaretRange: anchor and focus must be in the same direction',
  );
  return new CaretRangeImpl(anchor, focus, anchor.direction);
}

/**
 * A generalized utility for creating a stepwise iterator
 * based on:
 *
 * - an initial state
 * - a stop guard that returns true if the iteration is over, this
 *   is typically used to detect a sentinel value such as null or
 *   undefined from the state but may return true for other conditions
 *   as well
 * - a step function that advances the state (this will be called
 *   after map each time next() is called to prepare the next state)
 * - a map function that will be called that may transform the state
 *   before returning it. It will only be called once for each next()
 *   call when stop(state) === false
 *
 * @param config
 * @returns An IterableIterator
 */
export function makeStepwiseIterator<State, Stop, Value>(
  config: StepwiseIteratorConfig<State, Stop, Value>,
): IterableIterator<Value> {
  const { initial, hasNext, step, map } = config;
  let state = initial;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next(): IteratorResult<Value> {
      if (!hasNext(state)) {
        return { done: true, value: undefined };
      }
      const rval = { done: false, value: map(state) };
      state = step(state);
      return rval;
    },
  };
}

function compareNumber(a: number, b: number): -1 | 0 | 1 {
  return Math.sign(a - b) as -1 | 0 | 1;
}

/**
 * A total ordering for `PointCaret<'next'>`, based on
 * the same order that a {@link CaretRange} would iterate
 * them.
 *
 * For a given origin node:
 * - ChildCaret comes before SiblingCaret
 * - TextPointCaret comes before SiblingCaret
 *
 * An exception is thrown when a and b do not have any
 * common ancestor.
 *
 * This ordering is a sort of mix of pre-order and post-order
 * because each ElementNode will show up as a ChildCaret
 * on 'enter' (pre-order) and a SiblingCaret on 'leave' (post-order).
 *
 * @param a
 * @param b
 * @returns -1 if a comes before b, 0 if a and b are the same, or 1 if a comes after b
 */
export function $comparePointCaretNext(a: PointCaret<'next'>, b: PointCaret<'next'>): -1 | 0 | 1 {
  const compare = $getCommonAncestor(a.origin, b.origin);
  invariant(
    compare !== null,
    '$comparePointCaretNext: a (key %s) and b (key %s) do not have a common ancestor',
    a.origin.getKey(),
    b.origin.getKey(),
  );
  switch (compare.type) {
    case 'same': {
      const aIsText = a.type === 'text';
      const bIsText = b.type === 'text';
      return aIsText && bIsText
        ? compareNumber(a.offset, b.offset)
        : a.type === b.type
          ? 0
          : aIsText
            ? -1
            : bIsText
              ? 1
              : a.type === 'child'
                ? -1
                : 1;
    }
    case 'ancestor': {
      return a.type === 'child' ? -1 : 1;
    }
    case 'descendant': {
      return b.type === 'child' ? 1 : -1;
    }
    case 'branch': {
      return $getCommonAncestorResultBranchOrder(compare);
    }
  }
}

/**
 * Return the ordering of siblings in a CommonAncestorResultBranch
 * @param branch Returns -1 if a precedes b, 1 otherwise
 */
export function $getCommonAncestorResultBranchOrder<A extends LexicalNode, B extends LexicalNode>(
  compare: CommonAncestorResultBranch<A, B>,
): -1 | 1 {
  const { a, b } = compare;
  const aKey = a.__key;
  const bKey = b.__key;
  let na: null | LexicalNode = a;
  let nb: null | LexicalNode = b;
  for (; na && nb; na = na.getNextSibling(), nb = nb.getNextSibling()) {
    if (na.__key === bKey) {
      return -1;
    } else if (nb.__key === aKey) {
      return 1;
    }
  }
  return na === null ? 1 : -1;
}

/**
 * The two compared nodes are the same
 */
export interface CommonAncestorResultSame<A extends LexicalNode> {
  readonly type: 'same';
  readonly commonAncestor: A;
}
/**
 * Node a was a descendant of node b, and not the same node
 */
export interface CommonAncestorResultDescendant<B extends ElementNode> {
  readonly type: 'descendant';
  readonly commonAncestor: B;
}
/**
 * Node a is an ancestor of node b, and not the same node
 */
export interface CommonAncestorResultAncestor<A extends ElementNode> {
  readonly type: 'ancestor';
  readonly commonAncestor: A;
}
/**
 * Node a and node b have a common ancestor but are on different branches,
 * the `a` and `b` properties of this result are the ancestors of a and b
 * that are children of the commonAncestor. Since they are siblings, their
 * positions are comparable to determine order in the document.
 */
export interface CommonAncestorResultBranch<A extends LexicalNode, B extends LexicalNode> {
  readonly type: 'branch';
  readonly commonAncestor: ElementNode;
  /** The ancestor of `a` that is a child of `commonAncestor`  */
  readonly a: A | ElementNode;
  /** The ancestor of `b` that is a child of `commonAncestor`  */
  readonly b: B | ElementNode;
}
/**
 * The result of comparing two nodes that share some common ancestor
 */
export type CommonAncestorResult<A extends LexicalNode, B extends LexicalNode> =
  | CommonAncestorResultSame<A>
  | CommonAncestorResultAncestor<A & ElementNode>
  | CommonAncestorResultDescendant<B & ElementNode>
  | CommonAncestorResultBranch<A, B>;

function $isSameNode<T extends LexicalNode>(reference: T, other: LexicalNode): other is T {
  return other.is(reference);
}

function $initialElementTuple(node: LexicalNode): [ElementNode | null, LexicalNode | null] {
  return $isElementNode(node) ? [node.getLatest(), null] : [node.getParent(), node.getLatest()];
}

/**
 * Find a common ancestor of a and b and return a detailed result object,
 * or null if there is no common ancestor between the two nodes.
 *
 * The result object will have a commonAncestor property, and the other
 * properties can be used to quickly compare these positions in the tree.
 *
 * @param a A LexicalNode
 * @param b A LexicalNode
 * @returns A comparison result between the two nodes or null if they have no common ancestor
 */
export function $getCommonAncestor<A extends LexicalNode, B extends LexicalNode>(
  a: A,
  b: B,
): null | CommonAncestorResult<A, B> {
  if (a.is(b)) {
    return { commonAncestor: a, type: 'same' };
  }
  // Map of parent -> child entries based on a and its ancestors
  const aMap = new Map<ElementNode, LexicalNode | null>();
  for (
    let [parent, child] = $initialElementTuple(a);
    parent;
    child = parent, parent = parent.getParent()
  ) {
    aMap.set(parent, child);
  }
  for (
    let [parent, child] = $initialElementTuple(b);
    parent;
    child = parent, parent = parent.getParent()
  ) {
    const aChild = aMap.get(parent);
    if (aChild === undefined) {
      // keep going
    } else if (aChild === null) {
      // a is the ancestor
      invariant($isSameNode(a, parent), '$originComparison: ancestor logic error');
      return { commonAncestor: parent, type: 'ancestor' };
    } else if (child === null) {
      // b is the ancestor
      invariant($isSameNode(b, parent), '$originComparison: descendant logic error');
      return { commonAncestor: parent, type: 'descendant' };
    } else {
      invariant(
        ($isElementNode(aChild) || $isSameNode(a, aChild)) &&
          ($isElementNode(child) || $isSameNode(b, child)) &&
          parent.is(aChild.getParent()) &&
          parent.is(child.getParent()),
        '$originComparison: branch logic error',
      );
      return {
        a: aChild,
        b: child,
        commonAncestor: parent,
        type: 'branch',
      };
    }
  }
  return null;
}

/**
 * @param point
 * @returns a PointCaret for the point
 */
export function $caretFromPoint<D extends CaretDirection>(
  point: Pick<PointType, 'type' | 'key' | 'offset'>,
  direction: D,
): PointCaret<D> {
  const { type, key, offset } = point;
  const node = $getNodeByKeyOrThrow(point.key);
  if (type === 'text') {
    invariant(
      $isTextNode(node),
      '$caretFromPoint: Node with type %s and key %s that does not inherit from TextNode encountered for text point',
      node.getType(),
      key,
    );
    return $getTextPointCaret(node, direction, offset);
  }
  invariant(
    $isElementNode(node),
    '$caretFromPoint: Node with type %s and key %s that does not inherit from ElementNode encountered for element point',
    node.getType(),
    key,
  );
  return $getChildCaretAtIndex(node, point.offset, direction);
}

/**
 * Update the given point in-place from the PointCaret
 *
 * @param point the point to set
 * @param caret the caret to set the point from
 */
export function $setPointFromCaret<D extends CaretDirection>(
  point: PointType,
  caret: PointCaret<D>,
): void {
  const { origin, direction } = caret;
  const isNext = direction === 'next';
  if ($isTextPointCaret(caret)) {
    point.set(origin.getKey(), caret.offset, 'text');
  } else if ($isSiblingCaret(caret)) {
    if ($isTextNode(origin)) {
      point.set(origin.getKey(), $getTextNodeOffset(origin, direction), 'text');
    } else {
      point.set(
        origin.getParentOrThrow().getKey(),
        origin.getIndexWithinParent() + (isNext ? 1 : 0),
        'element',
      );
    }
  } else {
    invariant(
      $isChildCaret(caret) && $isElementNode(origin),
      '$setPointFromCaret: exhaustiveness check',
    );
    point.set(origin.getKey(), isNext ? 0 : origin.getChildrenSize(), 'element');
  }
}

/**
 * Set a RangeSelection on the editor from the given CaretRange
 *
 * @returns The new RangeSelection
 */
export function $setSelectionFromCaretRange(caretRange: CaretRange): RangeSelection {
  const currentSelection = $getSelection();
  const selection = $isRangeSelection(currentSelection)
    ? currentSelection
    : $createRangeSelection();
  $updateRangeSelectionFromCaretRange(selection, caretRange);
  $setSelection(selection);
  return selection;
}

/**
 * Update the points of a RangeSelection based on the given PointCaret.
 */
export function $updateRangeSelectionFromCaretRange(
  selection: RangeSelection,
  caretRange: CaretRange,
): void {
  $setPointFromCaret(selection.anchor, caretRange.anchor);
  $setPointFromCaret(selection.focus, caretRange.focus);
}

/**
 * Get a pair of carets for a RangeSelection.
 *
 * If the focus is before the anchor, then the direction will be
 * 'previous', otherwise the direction will be 'next'.
 */
export function $caretRangeFromSelection(selection: RangeSelection): CaretRange {
  const { anchor, focus } = selection;
  const anchorCaret = $caretFromPoint(anchor, 'next');
  const focusCaret = $caretFromPoint(focus, 'next');
  const direction = $comparePointCaretNext(anchorCaret, focusCaret) <= 0 ? 'next' : 'previous';
  return $getCaretRange(
    $getCaretInDirection(anchorCaret, direction),
    $getCaretInDirection(focusCaret, direction),
  );
}

/**
 * Given a SiblingCaret we can always compute a caret that points to the
 * origin of that caret in the same direction. The adjacent caret of the
 * returned caret will be equivalent to the given caret.
 *
 * @example
 * ```ts
 * siblingCaret.is($rewindSiblingCaret(siblingCaret).getAdjacentCaret())
 * ```
 *
 * @param caret The caret to "rewind"
 * @returns A new caret (ChildCaret or SiblingCaret) with the same direction
 */
export function $rewindSiblingCaret<T extends LexicalNode, D extends CaretDirection>(
  caret: SiblingCaret<T, D>,
): NodeCaret<D> {
  const { direction, origin } = caret;
  // Rotate the direction around the origin and get the adjacent node
  const rewindOrigin = $getSiblingCaret(origin, flipDirection(direction)).getNodeAtCaret();
  return rewindOrigin
    ? $getSiblingCaret(rewindOrigin, direction)
    : $getChildCaret(origin.getParentOrThrow(), direction);
}

function $getAnchorCandidates<D extends CaretDirection>(
  anchor: PointCaret<D>,
  rootMode: RootMode = 'root',
): [PointCaret<D>, ...NodeCaret<D>[]] {
  // These candidates will be the anchor itself, the pointer to the anchor (if different), and then any parents of that
  const carets: [PointCaret<D>, ...NodeCaret<D>[]] = [anchor];
  for (
    let parent = $isChildCaret(anchor) ? anchor.getParentCaret(rootMode) : anchor.getSiblingCaret();
    parent !== null;
    parent = parent.getParentCaret(rootMode)
  ) {
    carets.push($rewindSiblingCaret(parent));
  }
  return carets;
}

declare const CaretOriginAttachedBrand: unique symbol;
function $isCaretAttached<Caret extends PointCaret<CaretDirection>>(
  caret: null | undefined | Caret,
): caret is Caret & { [CaretOriginAttachedBrand]: never } {
  return !!caret && caret.origin.isAttached();
}

/**
 * Remove all text and nodes in the given range. If the range spans multiple
 * blocks then the remaining contents of the later block will be merged with
 * the earlier block.
 *
 * @param initialRange The range to remove text and nodes from
 * @param sliceMode If 'preserveEmptyTextPointCaret' it will leave an empty TextPointCaret at the anchor for insert if one exists, otherwise empty slices will be removed
 * @returns The new collapsed range (biased towards the earlier node)
 */
export function $removeTextFromCaretRange<D extends CaretDirection>(
  initialRange: CaretRange<D>,
  sliceMode: 'removeEmptySlices' | 'preserveEmptyTextSliceCaret' = 'removeEmptySlices',
): CaretRange<D> {
  if (initialRange.isCollapsed()) {
    return initialRange;
  }
  // Always process removals in document order
  const rootMode = 'root';
  const nextDirection = 'next';
  let sliceState = sliceMode;
  const range = $getCaretRangeInDirection(initialRange, nextDirection);

  const anchorCandidates = $getAnchorCandidates(range.anchor, rootMode);
  const focusCandidates = $getAnchorCandidates(range.focus.getFlipped(), rootMode);

  // Mark the start of each ElementNode
  const seenStart = new Set<NodeKey>();
  // Queue removals since removing the only child can cascade to having
  // a parent remove itself which will affect iteration
  const removedNodes: LexicalNode[] = [];
  for (const caret of range.iterNodeCarets(rootMode)) {
    if ($isChildCaret(caret)) {
      seenStart.add(caret.origin.getKey());
    } else if ($isSiblingCaret(caret)) {
      const { origin } = caret;
      if (!$isElementNode(origin) || seenStart.has(origin.getKey())) {
        removedNodes.push(origin);
      }
    }
  }
  for (const node of removedNodes) {
    node.remove();
  }

  // Splice text at the anchor and/or origin.
  // If the text is entirely selected then it is removed (unless it is the first slice and sliceMode is preserveEmptyTextSliceCaret).
  // If it's a token with a non-empty selection then it is removed.
  // Segmented nodes will be copied to a plain text node with the same format
  // and style and set to normal mode.
  for (const slice of range.getTextSlices()) {
    if (!slice) {
      continue;
    }
    const { origin } = slice.caret;
    const contentSize = origin.getTextContentSize();
    const caretBefore = $rewindSiblingCaret($getSiblingCaret(origin, nextDirection));
    const mode = origin.getMode();
    if (
      (Math.abs(slice.distance) === contentSize && sliceState === 'removeEmptySlices') ||
      (mode === 'token' && slice.distance !== 0)
    ) {
      // anchorCandidates[1] should still be valid, it is caretBefore
      caretBefore.remove();
    } else if (slice.distance !== 0) {
      sliceState = 'removeEmptySlices';
      let nextCaret = slice.removeTextSlice();
      const sliceOrigin = slice.caret.origin;
      if (mode === 'segmented') {
        const src = nextCaret.origin;
        const plainTextNode = $createTextNode(src.getTextContent())
          .setStyle(src.getStyle())
          .setFormat(src.getFormat());
        caretBefore.replaceOrInsert(plainTextNode);
        nextCaret = $getTextPointCaret(plainTextNode, nextDirection, nextCaret.offset);
      }
      if (sliceOrigin.is(anchorCandidates[0].origin)) {
        anchorCandidates[0] = nextCaret;
      }
      if (sliceOrigin.is(focusCandidates[0].origin)) {
        focusCandidates[0] = nextCaret.getFlipped();
      }
    }
  }

  // Find the deepest anchor and focus candidates that are
  // still attached
  let anchorCandidate: PointCaret<'next'> | undefined;
  let focusCandidate: PointCaret<'previous'> | undefined;
  for (const candidate of anchorCandidates) {
    if ($isCaretAttached(candidate)) {
      anchorCandidate = $normalizeCaret(candidate);
      break;
    }
  }
  for (const candidate of focusCandidates) {
    if ($isCaretAttached(candidate)) {
      focusCandidate = $normalizeCaret(candidate);
      break;
    }
  }

  // Merge blocks if necessary
  const mergeTargets = $getBlockMergeTargets(anchorCandidate, focusCandidate, seenStart);
  if (mergeTargets) {
    const [anchorBlock, focusBlock] = mergeTargets;
    // always merge blocks later in the document with
    // blocks earlier in the document
    $getChildCaret(anchorBlock, 'previous').splice(0, focusBlock.getChildren());
    focusBlock.remove();
  }

  // note this caret can be in either direction
  const bestCandidate = [
    anchorCandidate,
    focusCandidate,
    ...anchorCandidates,
    ...focusCandidates,
  ].find($isCaretAttached);
  if (bestCandidate) {
    const anchor = $getCaretInDirection($normalizeCaret(bestCandidate), initialRange.direction);
    return $getCollapsedCaretRange(anchor);
  }
  invariant(
    false,
    '$removeTextFromCaretRange: selection was lost, could not find a new anchor given candidates with keys: %s',
    JSON.stringify(anchorCandidates.map((n) => n.origin.__key)),
  );
}

/**
 * Determine if the two caret origins are in distinct blocks that
 * should be merged.
 *
 * The returned block pair will be the closest blocks to their
 * common ancestor, and must be no shadow roots between
 * the blocks and their respective carets. If two distinct
 * blocks matching this criteria are not found, this will return
 * null.
 */
function $getBlockMergeTargets(
  anchor: null | undefined | PointCaret<'next'>,
  focus: null | undefined | PointCaret<'previous'>,
  seenStart: Set<NodeKey>,
): null | [ElementNode, ElementNode] {
  if (!anchor || !focus) {
    return null;
  }
  const anchorParent = anchor.getParentAtCaret();
  const focusParent = focus.getParentAtCaret();
  if (!anchorParent || !focusParent) {
    return null;
  }
  // TODO refactor when we have a better primitive for common ancestor
  const anchorElements = anchorParent.getParents().reverse();
  anchorElements.push(anchorParent);
  const focusElements = focusParent.getParents().reverse();
  focusElements.push(focusParent);
  const maxLen = Math.min(anchorElements.length, focusElements.length);
  let commonAncestorCount: number;
  for (
    commonAncestorCount = 0;
    commonAncestorCount < maxLen &&
    anchorElements[commonAncestorCount] === focusElements[commonAncestorCount];
    commonAncestorCount++
  ) {
    // just traverse the ancestors
  }
  const $getBlock = (
    arr: readonly ElementNode[],
    predicate: (node: ElementNode) => boolean,
  ): ElementNode | undefined => {
    let block: ElementNode | undefined;
    for (let i = commonAncestorCount; i < arr.length; i++) {
      const ancestor = arr[i];
      if ($isRootOrShadowRoot(ancestor)) {
        return;
      } else if (!block && predicate(ancestor)) {
        block = ancestor;
      }
    }
    return block;
  };
  const anchorBlock = $getBlock(anchorElements, INTERNAL_$isBlock);
  const focusBlock =
    anchorBlock &&
    $getBlock(focusElements, (node) => seenStart.has(node.getKey()) && INTERNAL_$isBlock(node));
  return anchorBlock && focusBlock ? [anchorBlock, focusBlock] : null;
}

/**
 * Return the deepest ChildCaret that has initialCaret's origin
 * as an ancestor, or initialCaret if the origin is not an ElementNode
 * or is already the deepest ChildCaret.
 *
 * This is generally used when normalizing because there is
 * "zero distance" between these locations.
 *
 * @param initialCaret
 * @returns Either a deeper ChildCaret or the given initialCaret
 */
function $getDeepestChildOrSelf<Caret extends null | PointCaret<CaretDirection>>(
  initialCaret: Caret,
): ChildCaret<ElementNode, NonNullable<Caret>['direction']> | Caret {
  let caret: ChildCaret<ElementNode, NonNullable<Caret>['direction']> | Caret = initialCaret;
  while ($isChildCaret(caret)) {
    const adjacent = $getAdjacentChildCaret(caret);
    if (!$isChildCaret(adjacent)) {
      break;
    }
    caret = adjacent;
  }
  return caret;
}

/**
 * Normalize a caret to the deepest equivalent PointCaret.
 * This will return a TextPointCaret with the offset set according
 * to the direction if given a caret with a TextNode origin
 * or a caret with an ElementNode origin with the deepest ChildCaret
 * having an adjacent TextNode.
 *
 * If given a TextPointCaret, it will be returned, as no normalization
 * is required when an offset is already present.
 *
 * @param initialCaret
 * @returns The normalized PointCaret
 */
export function $normalizeCaret<D extends CaretDirection>(
  initialCaret: PointCaret<D>,
): PointCaret<D> {
  const caret = $getDeepestChildOrSelf(initialCaret.getLatest());
  const { direction } = caret;
  if ($isTextNode(caret.origin)) {
    return $isTextPointCaret(caret)
      ? caret
      : $getTextPointCaret(caret.origin, direction, direction);
  }
  const adj = caret.getAdjacentCaret();
  return $isSiblingCaret(adj) && $isTextNode(adj.origin)
    ? $getTextPointCaret(adj.origin, direction, flipDirection(direction))
    : caret;
}

declare const PointCaretIsExtendableBrand: unique symbol;
/**
 * Determine whether the TextPointCaret's offset can be extended further without leaving the TextNode.
 * Returns false if the given caret is not a TextPointCaret or the offset can not be moved further in
 * direction.
 *
 * @param caret A PointCaret
 * @returns true if caret is a TextPointCaret with an offset that is not at the end of the text given the direction.
 */
export function $isExtendableTextPointCaret<D extends CaretDirection>(
  caret: PointCaret<D>,
): caret is TextPointCaret<TextNode, D> & {
  [PointCaretIsExtendableBrand]: never;
} {
  return (
    $isTextPointCaret(caret) && caret.offset !== $getTextNodeOffset(caret.origin, caret.direction)
  );
}

/**
 * Return the caret if it's in the given direction, otherwise return
 * caret.getFlipped().
 *
 * @param caret Any PointCaret
 * @param direction The desired direction
 * @returns A PointCaret in direction
 */
export function $getCaretInDirection<
  Caret extends PointCaret<CaretDirection>,
  D extends CaretDirection,
>(
  caret: Caret,
  direction: D,
):
  | NodeCaret<D>
  | (Caret extends TextPointCaret<TextNode, CaretDirection> ? TextPointCaret<TextNode, D> : never) {
  return (caret.direction === direction ? caret : caret.getFlipped()) as
    | NodeCaret<D>
    | (Caret extends TextPointCaret<TextNode, CaretDirection>
        ? TextPointCaret<TextNode, D>
        : never);
}

/**
 * Return the range if it's in the given direction, otherwise
 * construct a new range using a flipped focus as the anchor
 * and a flipped anchor as the focus. This transformation
 * preserves the section of the document that it's working
 * with, but reverses the order of iteration.
 *
 * @param range Any CaretRange
 * @param direction The desired direction
 * @returns A CaretRange in direction
 */
export function $getCaretRangeInDirection<D extends CaretDirection>(
  range: CaretRange<CaretDirection>,
  direction: D,
): CaretRange<D> {
  if (range.direction === direction) {
    return range as CaretRange<D>;
  }
  return $getCaretRange(
    // focus and anchor get flipped here
    $getCaretInDirection(range.focus, direction),
    $getCaretInDirection(range.anchor, direction),
  );
}

/**
 * Get a caret pointing at the child at the given index, or the last
 * caret in that node if out of bounds.
 *
 * @param parent An ElementNode
 * @param index The index of the origin for the caret
 * @returns A caret pointing towards the node at that index
 */
export function $getChildCaretAtIndex<D extends CaretDirection>(
  parent: ElementNode,
  index: number,
  direction: D,
): NodeCaret<D> {
  let caret: NodeCaret<'next'> = $getChildCaret(parent, 'next');
  for (let i = 0; i < index; i++) {
    const nextCaret: null | SiblingCaret<LexicalNode, 'next'> = caret.getAdjacentCaret();
    if (nextCaret === null) {
      break;
    }
    caret = nextCaret;
  }
  return $getCaretInDirection(caret, direction);
}

/**
 * Returns the Node sibling when this exists, otherwise the closest parent sibling. For example
 * R -> P -> T1, T2
 *   -> P2
 * returns T2 for node T1, P2 for node T2, and null for node P2.
 * @param startCaret The initial caret
 * @param rootMode The root mode, 'root' ('default') or 'shadowRoot'
 * @returns An array (tuple) containing the found caret and the depth difference, or null, if this node doesn't exist.
 */
export function $getAdjacentSiblingOrParentSiblingCaret<D extends CaretDirection>(
  startCaret: NodeCaret<D>,
  rootMode: RootMode = 'root',
): null | [NodeCaret<D>, number] {
  let depthDiff = 0;
  let caret = startCaret;
  let nextCaret = $getAdjacentChildCaret(caret);
  while (nextCaret === null) {
    depthDiff--;
    nextCaret = caret.getParentCaret(rootMode);
    if (!nextCaret) {
      return null;
    }
    caret = nextCaret;
    nextCaret = $getAdjacentChildCaret(caret);
  }
  return nextCaret && [nextCaret, depthDiff];
}

/**
 * Get the adjacent nodes to initialCaret in the given direction.
 *
 * @example
 * ```ts
 * expect($getAdjacentNodes($getChildCaret(parent, 'next'))).toEqual(parent.getChildren());
 * expect($getAdjacentNodes($getChildCaret(parent, 'previous'))).toEqual(parent.getChildren().reverse());
 * expect($getAdjacentNodes($getSiblingCaret(node, 'next'))).toEqual(node.getNextSiblings());
 * expect($getAdjacentNodes($getSiblingCaret(node, 'previous'))).toEqual(node.getPreviousSiblings().reverse());
 * ```
 *
 * @param initialCaret The caret to start at (the origin will not be included)
 * @returns An array of siblings.
 */
export function $getAdjacentNodes(initialCaret: NodeCaret<CaretDirection>): LexicalNode[] {
  const siblings = [];
  for (let caret = initialCaret.getAdjacentCaret(); caret; caret = caret.getAdjacentCaret()) {
    siblings.push(caret.origin);
  }
  return siblings;
}

export function $splitTextPointCaret<D extends CaretDirection>(
  textPointCaret: TextPointCaret<TextNode, D>,
): NodeCaret<D> {
  const { origin, offset, direction } = textPointCaret;
  if (offset === $getTextNodeOffset(origin, direction)) {
    return textPointCaret.getSiblingCaret();
  } else if (offset === $getTextNodeOffset(origin, flipDirection(direction))) {
    return $rewindSiblingCaret(textPointCaret.getSiblingCaret());
  }
  const [textNode] = origin.splitText(offset);
  invariant(
    $isTextNode(textNode),
    '$splitTextPointCaret: splitText must return at least one TextNode',
  );
  return $getCaretInDirection($getSiblingCaret(textNode, 'next'), direction);
}

export interface SplitAtPointCaretNextOptions {
  /** The function to create the right side of a split ElementNode (default {@link $copyNode}) */
  $copyElementNode?: (node: ElementNode) => ElementNode;
  /** The function to split a TextNode (default {@link $splitTextPointCaret}) */
  $splitTextPointCaretNext?: (caret: TextPointCaret<TextNode, 'next'>) => NodeCaret<'next'>;
  /** If the parent matches rootMode a split will not occur, default is 'shadowRoot' */
  rootMode?: RootMode;
  /**
   * If element.canBeEmpty() and would create an empty split, this function will be
   * called with the element and 'first' | 'last'. If it returns false, the empty
   * split will not be created. Default is `() => true` to always split when possible.
   */
  $shouldSplit?: (node: ElementNode, edge: 'first' | 'last') => boolean;
}

function $alwaysSplit(_node: ElementNode, _edge: 'first' | 'last'): true {
  return true;
}

/**
 * Split a node at a PointCaret and return a NodeCaret at that point, or null if the
 * node can't be split. This is non-recursive and will only perform at most one split.
 *
 * @returns The NodeCaret pointing to the location of the split (or null if a split is not possible)
 */
export function $splitAtPointCaretNext(
  pointCaret: PointCaret<'next'>,
  {
    $copyElementNode = $copyNode,
    $splitTextPointCaretNext = $splitTextPointCaret,
    rootMode = 'shadowRoot',
    $shouldSplit = $alwaysSplit,
  }: SplitAtPointCaretNextOptions = {},
): null | NodeCaret<'next'> {
  if ($isTextPointCaret(pointCaret)) {
    return $splitTextPointCaretNext(pointCaret);
  }
  const parentCaret = pointCaret.getParentCaret(rootMode);
  if (parentCaret) {
    const { origin } = parentCaret;
    if ($isChildCaret(pointCaret) && !(origin.canBeEmpty() && $shouldSplit(origin, 'first'))) {
      // No split necessary, the left side would be empty
      return $rewindSiblingCaret(parentCaret);
    }
    const siblings = $getAdjacentNodes(pointCaret);
    if (siblings.length > 0 || (origin.canBeEmpty() && $shouldSplit(origin, 'last'))) {
      // Split and insert the siblings into the new tree
      parentCaret.insert($copyElementNode(origin).splice(0, 0, siblings));
    }
  }
  return parentCaret;
}
