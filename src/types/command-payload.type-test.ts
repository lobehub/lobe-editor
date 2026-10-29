import { createCommand } from 'lexical';

import type { IEditor } from '@/types/kernel';

const TEST_COMMAND = createCommand<{ key: string; value: number }>('TYPE_TEST_COMMAND');

/** Compiled by the type-check script; this function is intentionally not run. */
export const assertCommandPayloadInference = (editor: IEditor): void => {
  editor.dispatchCommand(TEST_COMMAND, { key: 'node', value: 1 });

  // @ts-expect-error -- both payload fields remain required through IEditor.dispatchCommand.
  editor.dispatchCommand(TEST_COMMAND, { key: 'node' });
};
