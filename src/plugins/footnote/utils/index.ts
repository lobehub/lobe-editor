import { $dfs } from '@lexical/utils';
import type { ElementNode, NodeKey } from 'lexical';
import { $getRoot } from 'lexical';

import {
  $createFootnoteDefinitionNode,
  $isFootnoteDefinitionNode,
  type FootnoteDefinitionNode,
} from '../node/FootnoteDefinitionNode';
import { $isFootnoteNode } from '../node/FootnoteNode';
import {
  $createFootnoteSectionNode,
  $isFootnoteSectionNode,
  type FootnoteSectionNode,
} from '../node/FootnoteSectionNode';

export interface FootnoteDefinitionInfo {
  key: NodeKey;
  text: string;
}

export interface FootnoteState {
  definitions: Map<string, FootnoteDefinitionInfo>;
  duplicateDefinitions: NodeKey[];
  numbers: Map<string, number>;
  references: Map<string, NodeKey[]>;
  sections: NodeKey[];
}

export function normalizeFootnoteIdentifier(identifier: unknown): string {
  if (typeof identifier !== 'string' && typeof identifier !== 'number') return '';
  return String(identifier)
    .trim()
    .replaceAll(/[\s[\]^]+/g, '-');
}

export function $collectFootnotes(root: ElementNode = $getRoot()): FootnoteState {
  const state: FootnoteState = {
    definitions: new Map(),
    duplicateDefinitions: [],
    numbers: new Map(),
    references: new Map(),
    sections: [],
  };

  for (const { node } of $dfs(root)) {
    if ($isFootnoteNode(node)) {
      const identifier = node.getIdentifier();
      const keys = state.references.get(identifier);
      if (keys) keys.push(node.getKey());
      else {
        state.references.set(identifier, [node.getKey()]);
        state.numbers.set(identifier, state.numbers.size + 1);
      }
    } else if ($isFootnoteDefinitionNode(node)) {
      const identifier = node.getIdentifier();
      if (state.definitions.has(identifier)) state.duplicateDefinitions.push(node.getKey());
      else state.definitions.set(identifier, { key: node.getKey(), text: node.getTextContent() });
    } else if ($isFootnoteSectionNode(node)) {
      state.sections.push(node.getKey());
    }
  }

  return state;
}

const stateCache = new WeakMap<object, FootnoteState>();

export function $getCachedFootnoteState(): FootnoteState | null {
  let root: ElementNode;
  // Read-only renderers call this from inside `editorState.read`; any other caller has no active state.
  try {
    root = $getRoot();
  } catch {
    return null;
  }
  let state = stateCache.get(root);
  if (!state) {
    state = $collectFootnotes(root);
    stateCache.set(root, state);
  }
  return state;
}

export function $getFootnoteSection(): FootnoteSectionNode | null {
  return $getRoot().getChildren().find($isFootnoteSectionNode) ?? null;
}

export function $findFootnoteDefinition(identifier: string): FootnoteDefinitionNode | null {
  for (const { node } of $dfs($getRoot())) {
    if ($isFootnoteDefinitionNode(node) && node.getIdentifier() === identifier) return node;
  }
  return null;
}

export function $ensureFootnoteDefinition(identifier: string): FootnoteDefinitionNode {
  const existing = $findFootnoteDefinition(identifier);
  if (existing) return existing;

  let section = $getFootnoteSection();
  if (!section) {
    section = $createFootnoteSectionNode();
    $getRoot().append(section);
  }
  const definition = $createFootnoteDefinitionNode(identifier);
  section.append(definition);
  return definition;
}

export function $getNextFootnoteIdentifier(): string {
  const used = new Set<string>();
  let max = 0;
  for (const { node } of $dfs($getRoot())) {
    if (!$isFootnoteNode(node) && !$isFootnoteDefinitionNode(node)) continue;
    const identifier = node.getIdentifier();
    used.add(identifier);
    if (/^\d+$/.test(identifier)) max = Math.max(max, Number(identifier));
  }
  let next = max + 1;
  while (used.has(String(next))) next++;
  return String(next);
}

export function getDefinitionOrder(state: FootnoteState, identifiers: string[]): string[] {
  const referenced = identifiers
    .filter((identifier) => state.numbers.has(identifier))
    .sort((a, b) => state.numbers.get(a)! - state.numbers.get(b)!);
  const orphans = identifiers.filter((identifier) => !state.numbers.has(identifier));
  return [...referenced, ...orphans];
}
