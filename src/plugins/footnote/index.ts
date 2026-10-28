export {
  FOOTNOTE_JUMP_TO_DEFINITION_COMMAND,
  FOOTNOTE_JUMP_TO_REFERENCE_COMMAND,
  INSERT_FOOTNOTE_COMMAND,
  type InsertFootnotePayload,
} from './command';
export * from './node/FootnoteDefinitionNode';
export * from './node/FootnoteNode';
export * from './node/FootnoteSectionNode';
export * from './plugin';
export * from './react';
export { type FootnoteSnapshot, IFootnoteService } from './service';
export { $collectFootnotes, type FootnoteState, normalizeFootnoteIdentifier } from './utils';
