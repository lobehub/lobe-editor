import type { Binding } from '@lexical/yjs';
import type { EditorState, LexicalNode } from 'lexical';

import { $setNodeProperties } from '@/plugins/properties/state';
import type { NodeProperties } from '@/plugins/properties/types';

const ignoredNodeProperties = new Set([
  '__cachedText',
  '__first',
  '__key',
  '__last',
  '__next',
  '__parent',
  '__prev',
  '__size',
  '__state',
  '__text',
]);

function shouldIgnoreNodeProperty(property: string, node: LexicalNode, binding: Binding): boolean {
  if (ignoredNodeProperties.has(property) || typeof (node as any)[property] === 'function') {
    return true;
  }

  const excludedProperties = binding.excludedProperties.get(node.constructor as any);
  return Boolean(excludedProperties?.has(property));
}

function ensureYjsNodeProperties(binding: Binding, node: LexicalNode): void {
  if (binding.nodeProperties.has(node.__type)) {
    return;
  }

  let defaultNode = node;

  try {
    defaultNode = new (node.constructor as { new (): LexicalNode })();
  } catch {
    defaultNode = node;
  }

  const defaultProperties: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(defaultNode)) {
    if (!shouldIgnoreNodeProperty(property, defaultNode, binding)) {
      defaultProperties[property] = value;
    }
  }

  binding.nodeProperties.set(node.__type, Object.freeze(defaultProperties));
}

export function ensureYjsNodePropertiesFromEditorState(
  binding: Binding,
  editorState: EditorState,
): void {
  editorState.read(() => {
    editorState._nodeMap.forEach((node) => {
      ensureYjsNodeProperties(binding, node);
    });
  });
}

type SharedTypeWithState = {
  get?: (key: string) => unknown;
  getAttribute?: (key: string) => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reconcile the editor-owned annotation NodeState from the Yjs representation.
 *
 * Lexical/Yjs currently handles updates below `__state`, but when UndoManager
 * removes the whole `__state` entry the parent map event only marks the key as
 * deleted. The upstream sync path intentionally ignores that missing map, so
 * the previous Lexical NodeState can remain live. Read only the `properties`
 * state from each mapped collab node and update that state in place; text,
 * structure, and selection are left untouched.
 */
export function $syncAnnotationNodePropertiesFromYjs(
  binding: Binding,
  nodeKeys?: ReadonlySet<string>,
): void {
  const collabNodes = nodeKeys
    ? [...nodeKeys]
        .map((nodeKey) => binding.collabNodeMap.get(nodeKey))
        .filter((collabNode): collabNode is NonNullable<typeof collabNode> => Boolean(collabNode))
    : [...binding.collabNodeMap.values()];

  collabNodes.forEach((collabNode) => {
    const node = collabNode.getNode();
    if (!node) return;

    const sharedType = collabNode.getSharedType() as unknown as SharedTypeWithState;
    const state = sharedType.get?.('__state') ?? sharedType.getAttribute?.('__state');
    const serializedState =
      state && typeof (state as { toJSON?: unknown }).toJSON === 'function'
        ? ((state as { toJSON: () => unknown }).toJSON() as unknown)
        : undefined;
    const properties =
      isRecord(serializedState) && isRecord(serializedState.properties)
        ? (serializedState.properties as NodeProperties)
        : {};

    // `$setState` uses the state's equality function, so unchanged nodes are
    // not marked dirty and this reconciliation cannot create an update loop.
    $setNodeProperties(node, properties);
  });
}
