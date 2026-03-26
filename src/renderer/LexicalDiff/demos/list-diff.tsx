import { LexicalDiff } from '@lobehub/editor/renderer';

import { makeEditorState, makeHeading, makeList } from './fixtures';

/**
 * List diff: bullet/number list with items added, removed, and modified.
 * Also demonstrates list type change (bullet ↔ number).
 */
const oldValue = makeEditorState([
  makeHeading('Sprint Tasks', 'h2'),
  makeList(['Implement auth flow', 'Fix login bug', 'Update dependencies', 'Write docs']),
  makeHeading('Done', 'h2'),
  makeList(['Setup project', 'Configure ESLint'], 'bullet', [true, true]),
]);

const newValue = makeEditorState([
  makeHeading('Sprint Tasks', 'h2'),
  makeList(
    ['Implement auth flow', 'Fix login and signup bugs', 'Update dependencies', 'Add unit tests'],
    'number',
  ),
  makeHeading('Done', 'h2'),
  makeList(['Setup project', 'Configure ESLint', 'Initial PR merged'], 'bullet', [
    true,
    true,
    true,
  ]),
]);

export default () => {
  return (
    <LexicalDiff
      labels={{ new: 'Current', old: 'Previous' }}
      newValue={newValue}
      oldValue={oldValue}
      style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, maxWidth: 960 }}
    />
  );
};
