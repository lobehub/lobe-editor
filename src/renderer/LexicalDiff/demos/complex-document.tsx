import { LexicalDiff } from '@lobehub/editor/renderer';

import {
  makeCode,
  makeEditorState,
  makeHeading,
  makeList,
  makeParagraph,
  makeQuote,
} from './fixtures';

/**
 * Complex document diff: mixed block types (heading, paragraph, list, quote, code)
 * with insert, delete, modify, and cross-type changes.
 */
const oldValue = makeEditorState([
  makeHeading('Project Roadmap', 'h1'),
  makeParagraph('This document outlines the planned features for Q1.'),
  makeHeading('Phase 1', 'h2'),
  makeList(['Setup CI/CD pipeline', 'Migrate to monorepo', 'Add E2E tests']),
  makeQuote('Ship fast, iterate faster.'),
  makeParagraph('Target completion: end of March.'),
]);

const newValue = makeEditorState([
  makeHeading('Project Roadmap 2025', 'h1'),
  makeParagraph('This document outlines the planned features for Q1 and Q2.'),
  makeHeading('Phase 1', 'h2'),
  makeList(['Setup CI/CD pipeline', 'Migrate to monorepo', 'Add E2E tests', 'Document API']),
  makeQuote('Ship fast, iterate faster. — Engineering Team'),
  makeCode("const config = { version: '2.0' };"),
  makeParagraph('Target completion: end of April.'),
]);

export default () => {
  return (
    <LexicalDiff
      labels={{ new: 'After', old: 'Before' }}
      newValue={newValue}
      oldValue={oldValue}
      style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, maxWidth: 960 }}
    />
  );
};
