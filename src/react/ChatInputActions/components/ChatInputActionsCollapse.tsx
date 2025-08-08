'use client';

import { ActionIcon } from '@lobehub/ui';
import { Popover } from 'antd';
import { motion } from 'framer-motion';
import { CircleChevronLeftIcon, CircleChevronRightIcon, CircleChevronUpIcon } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';
import useMergeState from 'use-merge-value';

import type { ChatInputActionsCollapseProps } from '../type';

const ChatInputActionsCollapse = memo<ChatInputActionsCollapseProps>(
  ({ children, expand, defaultExpand = true, onChange, gap, mode }) => {
    const [expanded, setExpaned] = useMergeState(defaultExpand, {
      defaultValue: defaultExpand,
      onChange,
      value: expand,
    });

    if (mode === 'popup') {
      return (
        <Popover
          arrow={false}
          content={
            <Flexbox align={'center'} gap={gap} horizontal>
              {children}
            </Flexbox>
          }
          styles={{
            body: {
              padding: 4,
            },
          }}
        >
          <ActionIcon
            icon={CircleChevronUpIcon}
            size={{
              blockSize: 36,
              size: 20,
            }}
          />
        </Popover>
      );
    }

    return (
      <Flexbox align={'center'} flex={'none'} gap={gap} horizontal>
        <motion.div
          animate={expanded ? 'open' : 'closed'}
          style={{
            alignItems: 'center',
            display: 'flex',
            gap,
            overflow: 'hidden',
          }}
          transition={{
            duration: 0.2,
          }}
          variants={{
            closed: { opacity: 0, width: 0 },
            open: {
              opacity: 1,
              width: 'auto',
            },
          }}
        >
          {children}
        </motion.div>
        <ActionIcon
          icon={expanded ? CircleChevronLeftIcon : CircleChevronRightIcon}
          onClick={() => setExpaned(!expanded)}
          size={{
            blockSize: 36,
            size: 20,
          }}
        />
      </Flexbox>
    );
  },
);

ChatInputActionsCollapse.displayName = 'ChatInputActionsCollapse';

export default ChatInputActionsCollapse;
