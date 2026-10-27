import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $isRootNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import { FOOTNOTE_JUMP_TO_REFERENCE_COMMAND } from '../command';
import {
  $isFootnoteDefinitionNode,
  FOOTNOTE_BACK_SELECTOR,
  FOOTNOTE_LABEL_SELECTOR,
  FootnoteDefinitionNode,
} from '../node/FootnoteDefinitionNode';
import { FootnoteNode } from '../node/FootnoteNode';
import { $isFootnoteSectionNode, FootnoteSectionNode } from '../node/FootnoteSectionNode';
import type { FootnoteService } from '../service';
import { $collectFootnotes, type FootnoteState, getDefinitionOrder } from '../utils';

function $getRootSections(state: FootnoteState): FootnoteSectionNode[] {
  return state.sections
    .map((key) => $getNodeByKey(key))
    .filter($isFootnoteSectionNode)
    .filter((section) => $isRootNode(section.getParent()));
}

function $needsNormalization(state: FootnoteState): boolean {
  const sections = $getRootSections(state);
  if (sections.length > 1) return true;
  const section = sections[0];
  if (!section) return false;

  const children = section.getChildren();
  if (!children.every($isFootnoteDefinitionNode)) return false;
  const identifiers = children.map((node) => node.getIdentifier());
  const ordered = getDefinitionOrder(state, identifiers);
  return ordered.some((identifier, index) => identifier !== identifiers[index]);
}

export function $normalizeFootnotes(): void {
  const state = $collectFootnotes();
  const [target, ...extra] = $getRootSections(state);
  if (!target) return;

  for (const section of extra) {
    target.append(...section.getChildren());
    section.remove();
  }

  const children = target.getChildren();
  if (!children.every($isFootnoteDefinitionNode)) return;
  const definitions = children;
  const byIdentifier = new Map<string, FootnoteDefinitionNode[]>();
  for (const definition of definitions) {
    const list = byIdentifier.get(definition.getIdentifier()) ?? [];
    list.push(definition);
    byIdentifier.set(definition.getIdentifier(), list);
  }

  const ordered = getDefinitionOrder(state, Array.from(byIdentifier.keys())).flatMap(
    (identifier) => byIdentifier.get(identifier) ?? [],
  );
  ordered.forEach((definition, index) => {
    const current = target.getChildAtIndex(index);
    if (current && !current.is(definition)) current.insertBefore(definition);
  });
}

function applyFootnoteDom(editor: LexicalEditor, state: FootnoteState, unusedLabel: string) {
  for (const [identifier, { key }] of state.definitions) {
    const element = editor.getElementByKey(key);
    if (!element) continue;
    const number = state.numbers.get(identifier);
    const label = element.querySelector<HTMLElement>(FOOTNOTE_LABEL_SELECTOR);
    if (label) {
      label.textContent = number ? `${number}.` : '';
      label.title = number ? '' : unusedLabel;
    }
    element.dataset.footnoteOrphan = String(!number);
    element.dataset.footnoteDuplicate = 'false';
  }
  for (const key of state.duplicateDefinitions) {
    const element = editor.getElementByKey(key);
    if (element) element.dataset.footnoteDuplicate = 'true';
  }
}

export function registerFootnoteSync(
  editor: LexicalEditor,
  service: FootnoteService,
  getUnusedLabel: () => string,
) {
  let dirty = true;
  let hasFootnotes = false;
  const markDirty = () => {
    dirty = true;
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const back = target.closest<HTMLElement>(FOOTNOTE_BACK_SELECTOR);
    const identifier = back?.closest<HTMLElement>('[data-footnote-definition]')?.dataset
      .footnoteDefinition;
    if (identifier === undefined) return;
    event.preventDefault();
    editor.dispatchCommand(FOOTNOTE_JUMP_TO_REFERENCE_COMMAND, identifier);
  };

  return mergeRegister(
    editor.registerMutationListener(FootnoteNode, markDirty),
    editor.registerMutationListener(FootnoteDefinitionNode, markDirty),
    editor.registerMutationListener(FootnoteSectionNode, markDirty),
    editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener('click', handleClick);
      rootElement?.addEventListener('click', handleClick);
    }),
    editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      const changed = dirtyElements.size > 0 || dirtyLeaves.size > 0;
      if (!dirty && !(hasFootnotes && changed)) return;
      dirty = false;

      const { normalize, state } = editorState.read(() => {
        const state = $collectFootnotes($getRoot());
        return { normalize: $needsNormalization(state), state };
      });
      hasFootnotes = state.references.size > 0 || state.definitions.size > 0;
      service.update(state);
      if (editor.getRootElement()) applyFootnoteDom(editor, state, getUnusedLabel());

      if (
        normalize &&
        editor.isEditable() &&
        !tags.has(COLLABORATION_TAG) &&
        !tags.has(HISTORIC_TAG)
      ) {
        editor.update($normalizeFootnotes, {
          tag: [HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG],
        });
      }
    }),
  );
}
