import type { HeadingTagType } from '@lexical/rich-text';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical';

export const INSERT_QUOTE_COMMAND = createCommand<unknown>('INSERT_QUOTE_COMMAND');
export const INSERT_HEADING_COMMAND = createCommand<{ tag: HeadingTagType }>(
  'INSERT_HEADING_COMMAND',
);
/**
 * Requests that a Hole payload accept an arrow-key entry from one of its
 * boundaries.
 *
 * `from` is the canonical direction. `edge` is retained as a deprecated
 * compatibility field for consumers that dispatched the original command.
 * The type keeps the canonical and legacy shapes mutually exclusive; the
 * resolver still gives `from` precedence defensively at runtime. Hole itself
 * always dispatches the canonical `from` field. A target handler returns
 * `true` only after it owns the caret/focus transfer; `false` preserves Hole's
 * normal boundary traversal.
 */
export type EnterHoleContentPayload =
  | {
      /** Canonical direction: the boundary from which the target is entered. */
      from: 'after' | 'before';
      key: string;
      /** @deprecated Use `from`; this field is intentionally not accepted with it. */
      edge?: never;
    }
  | {
      /** @deprecated Legacy callers may provide `edge` until they migrate. */
      edge: 'end' | 'start';
      key: string;
      from?: never;
    };

export const ENTER_HOLE_CONTENT_COMMAND = createCommand<EnterHoleContentPayload>(
  'ENTER_HOLE_CONTENT_COMMAND',
);

/** Resolve the canonical boundary side for a command payload. */
export const getHoleContentEntrySide = (
  payload: EnterHoleContentPayload,
): 'after' | 'before' | null => {
  if (payload.from) return payload.from;
  if (payload.edge === 'start') return 'before';
  if (payload.edge === 'end') return 'after';
  return null;
};

export function registerCommands(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_QUOTE_COMMAND,
      () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createQuoteNode());
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      INSERT_HEADING_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createHeadingNode(payload.tag));
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
  );
}
