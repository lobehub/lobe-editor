import { createCommand } from 'lexical';

/**
 * LiteXML command identities.
 *
 * These symbols are intentionally isolated in a side-effect-free module so they
 * keep a SINGLE runtime identity across every entry of this package.
 *
 * Lexical's `dispatchCommand` matches command listeners by object reference, not
 * by the string label. The package ships two independently-bundled entries — the
 * browser build (`index` / `react` / `renderer`) and the node build (`headless`)
 * — and if each entry inlined its own `createCommand(...)` call, dispatching a
 * command obtained from one entry onto an editor registered by the other would
 * silently no-op (different object identities, same label).
 *
 * By keeping every command in this one module — exposed verbatim through
 * `@lobehub/editor/litexml-commands` and emitted as a shared chunk by both
 * builds — a single object backs the command in any runtime, and the module is
 * pure enough to be imported on the server without pulling in the DOM-dependent
 * editor bundle.
 */

export enum DiffAction {
  Reject,
  Accept,
}

export const LITEXML_MODIFY_COMMAND = createCommand<
  Array<
    | {
        action: 'insert';
        beforeId: string;
        litexml: string;
      }
    | {
        action: 'insert';
        afterId: string;
        litexml: string;
      }
    | {
        action: 'remove';
        id: string;
      }
    | {
        action: 'modify';
        litexml: string | string[];
      }
  >
>('LITEXML_MODIFY_COMMAND');

export const LITEXML_APPLY_COMMAND = createCommand<{ delay?: boolean; litexml: string | string[] }>(
  'LITEXML_APPLY_COMMAND',
);

export const LITEXML_REMOVE_COMMAND = createCommand<{ delay?: boolean; id: string }>(
  'LITEXML_REMOVE_COMMAND',
);

export const LITEXML_INSERT_COMMAND = createCommand<
  | {
      beforeId: string;
      delay?: boolean;
      litexml: string;
    }
  | {
      afterId: string;
      delay?: boolean;
      litexml: string;
    }
>('LITEXML_INSERT_COMMAND');

export const LITEXML_DIFFNODE_COMMAND = createCommand<{ action: DiffAction; nodeKey: string }>(
  'LITEXML_DIFFNODE_COMMAND',
);

export const LITEXML_DIFFNODE_ALL_COMMAND = createCommand<{ action: DiffAction }>(
  'LITEXML_DIFFNODE_ALL_COMMAND',
);
