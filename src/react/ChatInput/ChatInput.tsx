'use client';

import { Typography } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { ReactCodeblockPlugin } from '@/plugins/codeblock';
import { ReactHRPlugin } from '@/plugins/hr';
import { ReactImagePlugin } from '@/plugins/image';
import { ReactLinkPlugin } from '@/plugins/link';
import { ReactListPlugin } from '@/plugins/list';

import Editor from '../Editor';
import { useStyles } from './style';
import type { ChatInputProps } from './type';

const ChatInput = memo<ChatInputProps>(({ className, mentionOption, slashOption, plugins = [], content }) => {
  const { styles } = useStyles();

  const memoPlugins = useMemo(
    () => [
      ReactListPlugin,
      ReactLinkPlugin,
      ReactImagePlugin,
      ReactCodeblockPlugin,
      ReactHRPlugin,
      ...plugins,
    ],
    [plugins],
  );

  return (
    <Flexbox
      align="flex-end"
      className={styles.container}
      gap={12}
      horizontal
      paddingBlock={8}
      paddingInline={16}
      width={'100%'}
    >
      <Typography fontSize={14} headerMultiple={0.25} marginMultiple={1}>
        <Editor
          className={className}
          content={content}
          mentionOption={mentionOption}
          plugins={memoPlugins}
          slashOption={slashOption}
        />
      </Typography>
    </Flexbox>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
