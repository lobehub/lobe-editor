import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode } from 'lexical';
import { $getRoot, $isRootNode } from 'lexical';

import { $isFootnoteDefinitionNode, FootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import {
  $createFootnoteSectionNode,
  $isFootnoteSectionNode,
  FootnoteSectionNode,
} from '../node/FootnoteSectionNode';
import { $getFootnoteSection } from '../utils';

const DIFF_NODE_TYPE = 'diff';

const $isDiffNode = (node: LexicalNode | null) => node?.getType() === DIFF_NODE_TYPE;

export function registerFootnoteStructure(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerNodeTransform(FootnoteDefinitionNode, (definition) => {
      if (
        $findMatchingParent(definition, (node) => $isFootnoteSectionNode(node) || $isDiffNode(node))
      ) {
        return;
      }

      let section = $getFootnoteSection();
      if (!section) {
        section = $createFootnoteSectionNode();
        $getRoot().append(section);
      }
      section.append(definition);
    }),
    editor.registerNodeTransform(FootnoteSectionNode, (section) => {
      const parent = section.getParent();
      if (!$isRootNode(parent) && !$isDiffNode(parent)) {
        $getRoot().append(section);
      }

      let anchor: LexicalNode = section;
      for (const child of section.getChildren()) {
        if ($isFootnoteDefinitionNode(child) || $isDiffNode(child)) continue;
        anchor.insertAfter(child);
        anchor = child;
      }
      if (section.isEmpty()) section.remove();
    }),
  );
}
