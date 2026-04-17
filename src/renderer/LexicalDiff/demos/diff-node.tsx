import { LexicalDiff } from '@lobehub/editor/renderer';

import { makeDiffNode, makeEditorState, makeHeading, makeParagraph } from './fixtures';

/**
 * Serialized diff-node demo: useful when an upstream pipeline has already
 * embedded custom `diff` nodes and the result still needs to be rendered
 * through LexicalDiff.
 */
const value = makeEditorState([
  makeHeading('Precomputed Diff Blocks', 'h2'),
  makeDiffNode('modify', [
    makeParagraph('Old API contract: returns `{ result: string }`.'),
    makeParagraph('New API contract: returns `{ result: string; meta: object }`.'),
  ]),
  makeDiffNode('add', [makeParagraph('Added migration note for downstream consumers.')]),
  makeDiffNode('remove', [makeParagraph('Removed the legacy fallback description.')]),
]);

export default () => {
  return (
    <LexicalDiff
      labels={{ new: 'Rendered State', old: 'Rendered State' }}
      newValue={value}
      oldValue={value}
      style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, maxWidth: 960 }}
    />
  );
};
