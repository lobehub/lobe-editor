'use client';

import { ActionIcon } from '@lobehub/ui';
import { Popover } from 'antd';
import { motion } from 'framer-motion';
import { CircleChevronLeftIcon, CircleChevronRightIcon, CircleChevronUpIcon } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import type { ChatInputActionsCollapseProps } from '../type';

const CollapsedActions = memo<ChatInputActionsCollapseProps>(
  ({ children, groupCollapse = false, onGroupCollapseChange, gap, mode }) => {
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
          animate={groupCollapse ? 'closed' : 'open'}
          initial={groupCollapse ? 'closed' : 'open'}
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
          icon={groupCollapse ? CircleChevronRightIcon : CircleChevronLeftIcon}
          onClick={() => onGroupCollapseChange?.(!groupCollapse)}
          size={{
            blockSize: 36,
            size: 20,
          }}
        />
      </Flexbox>
    );
  },
);

CollapsedActions.displayName = 'ChatInputActionsCollapse';

export default CollapsedActions;
