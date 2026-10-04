import type { Binding } from '@lexical/yjs';
import {
  $getRoot,
  $isElementNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  type LexicalNode,
} from 'lexical';
import type { XmlElement, XmlText } from 'yjs';
import { createRelativePositionFromTypeIndex, Map as YMap } from 'yjs';

import { $getNodeId, $normalizeNodeIds } from '@/plugins/common/node/node-id';
import { $getNodeIdentityPolicy } from '@/plugins/common/node/node-identity-policy';

type SharedType = XmlElement | XmlText | YMap<unknown>;
type NodeIdRepair = { nodeId: string; nodeKey: string };

const reconciliationOrigins = new WeakMap<Binding, object>();

function getReconciliationOrigin(binding: Binding): object {
  let origin = reconciliationOrigins.get(binding);
  if (!origin) {
    origin = { type: 'lobe-editor-node-id-reconciliation' };
    reconciliationOrigins.set(binding, origin);
  }
  return origin;
}

export function isNodeIdReconciliationOrigin(binding: Binding, origin: unknown): boolean {
  const reconciliationOrigin = reconciliationOrigins.get(binding);
  return reconciliationOrigin !== undefined && origin === reconciliationOrigin;
}

function getSharedNodeState(sharedType: SharedType): YMap<unknown> | undefined {
  const state =
    sharedType instanceof YMap ? sharedType.get('__state') : sharedType.getAttribute('__state');
  return state instanceof YMap ? state : undefined;
}

function setSharedNodeState(sharedType: SharedType, state: YMap<unknown>): void {
  if (sharedType instanceof YMap) {
    sharedType.set('__state', state);
  } else {
    sharedType.setAttribute('__state', state);
  }
}

function getStableSharedIdentity(binding: Binding, node: LexicalNode): string | undefined {
  const sharedType = binding.collabNodeMap.get(node.getKey())?.getSharedType() as
    SharedType | undefined;
  if (!sharedType) return undefined;

  const id = createRelativePositionFromTypeIndex(sharedType, 0).type;
  if (!id) return undefined;

  return `${id.client.toString(36).padStart(7, '0')}:${id.clock.toString(36).padStart(11, '0')}`;
}

function hasRepairableSharedIdIssues(binding: Binding): boolean {
  const editor = binding.editor;
  return editor.getEditorState().read(
    () => {
      const policy = $getNodeIdentityPolicy();
      const groups = new Map<string, LexicalNode[]>();
      let hasMappedMissingId = false;

      const visit = (node: LexicalNode) => {
        if (policy.isIdentityNode(node)) {
          const nodeId = $getNodeId(node);
          if (!nodeId) {
            if (getStableSharedIdentity(binding, node)) hasMappedMissingId = true;
          } else {
            const group = groups.get(nodeId) || [];
            group.push(node);
            groups.set(nodeId, group);
          }
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      visit($getRoot());

      if (hasMappedMissingId) return true;
      for (const group of groups.values()) {
        if (group.length < 2 || (group.length === 2 && policy.canShareId(group[0], group[1]))) {
          continue;
        }
        const identities = group.map((node) => getStableSharedIdentity(binding, node));
        if (
          identities.every((identity): identity is string => Boolean(identity)) &&
          new Set(identities).size === identities.length
        ) {
          return true;
        }
      }
      return false;
    },
    { editor },
  );
}

function writeRepairedNodeIds(binding: Binding, repairs: NodeIdRepair[]): void {
  if (repairs.length === 0) return;

  binding.doc.transact(() => {
    for (const repair of repairs) {
      const sharedType = binding.collabNodeMap.get(repair.nodeKey)?.getSharedType() as
        SharedType | undefined;
      if (!sharedType) continue;

      const existingState = getSharedNodeState(sharedType);
      const state = existingState ?? new YMap<unknown>();
      const currentProperties = existingState?.get('properties');
      const properties =
        currentProperties &&
        typeof currentProperties === 'object' &&
        !Array.isArray(currentProperties)
          ? (currentProperties as Record<string, unknown>)
          : {};

      state.set('properties', { ...properties, nodeId: repair.nodeId });
      if (!existingState) setSharedNodeState(sharedType, state);
    }
  }, getReconciliationOrigin(binding));
}

/** Repair shared ID collisions only after the binding has mapped their Yjs types. */
export function reconcileSharedNodeIds(binding: Binding): void {
  if (!hasRepairableSharedIdIssues(binding)) return;

  const repairs: NodeIdRepair[] = [];
  binding.editor.update(
    () => {
      $normalizeNodeIds($getRoot(), {
        onRepair: (node, previousId, nodeId) => {
          if (previousId !== nodeId) repairs.push({ nodeId, nodeKey: node.getKey() });
        },
        stableDuplicateRepair: true,
        stableOwnershipKey: (node) => getStableSharedIdentity(binding, node),
      });
    },
    {
      discrete: true,
      onUpdate: () => writeRepairedNodeIds(binding, repairs),
      skipTransforms: true,
      tag: [COLLABORATION_TAG, HISTORIC_TAG],
    },
  );
}
