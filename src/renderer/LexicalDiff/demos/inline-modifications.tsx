import { LexicalDiff } from '@lobehub/editor/renderer';

import { makeEditorState, makeParagraph } from './fixtures';

/**
 * Inline text modifications: character-level diff highlighting within paragraphs.
 * Demonstrates multiple insert/delete spans in a single block.
 */
const oldValue = makeEditorState([
  makeParagraph('The quick brown fox jumps over the lazy dog.'),
  makeParagraph('React 18 introduced concurrent features and automatic batching.'),
  makeParagraph('TypeScript provides static typing for JavaScript.'),
]);

const newValue = makeEditorState([
  makeParagraph('The quick red fox leaps over the lazy cat.'),
  makeParagraph(
    'React 19 introduced concurrent features, automatic batching, and Server Components.',
  ),
  makeParagraph('TypeScript provides static typing and excellent tooling for JavaScript.'),
]);

export default () => {
  return (
    <LexicalDiff
      labels={{ new: 'Edited', old: 'Original' }}
      newValue={newValue}
      oldValue={oldValue}
      style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.8, maxWidth: 960 }}
    />
  );
};
