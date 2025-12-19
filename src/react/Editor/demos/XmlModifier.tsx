/* eslint-disable sort-keys-fix/sort-keys-fix */
import { StoryBook, useControls, useCreateStore } from '@lobehub/ui/storybook';
import { button } from 'leva';
import { ReactNode, memo } from 'react';

import {
  DiffAction,
  LITEXML_APPLY_COMMAND,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_REMOVE_COMMAND,
} from '@/plugins/litexml';
import { IEditor } from '@/types';

const XmlModifier = memo<{ children?: ReactNode; editor?: IEditor }>(({ children, editor }) => {
  const store = useCreateStore();
  useControls(
    {
      delay: true,
      content: {
        value: '<span id="n4t5" bold="true">@lobehub/replace</span>',
        rows: 4,
      },
      apply: button((get) => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
          delay: get('delay'),
          litexml: [get('content')],
        });
      }),
      removeId: 'lwap',
      remove: button((get) => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_REMOVE_COMMAND, {
          delay: get('delay'),
          id: get('removeId'),
        });
      }),
      afterId: 'll63',
      insertAfter: button((get) => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_INSERT_COMMAND, {
          afterId: get('afterId'),
          delay: get('delay'),
          litexml: get('content'),
        });
      }),
      beforeId: 'll63',
      insertBefore: button((get) => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_INSERT_COMMAND, {
          beforeId: get('beforeId'),
          delay: get('delay'),
          litexml: get('content'),
        });
      }),
      acceptAllDiffs: button(() => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
      }),
      rejectAllDiffs: button(() => {
        if (!editor) return;
        editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
      }),
    },
    {
      store,
    },
  );
  return (
    <StoryBook levaStore={store} paddingBlock={'0 24px'}>
      {children}
    </StoryBook>
  );
});

export default XmlModifier;
