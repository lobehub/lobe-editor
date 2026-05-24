import { PlusIcon } from 'lucide-react';
import { memo } from 'react';

import { styles } from './TableController/style';
import TableControllerButton from './TableControllerButton';

interface TableInsertButtonProps {
  ariaLabel: string;
  offset?: number;
  onInsert: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position: 'left' | 'top';
  reference: HTMLElement | null;
  visible: boolean;
}

const TableInsertButton = memo<TableInsertButtonProps>(
  ({ ariaLabel, offset, onInsert, onMouseEnter, onMouseLeave, position, reference, visible }) => {
    return (
      <TableControllerButton
        ariaLabel={ariaLabel}
        className={styles.insertButton}
        gap={4}
        offset={offset}
        onClick={onInsert}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        position={position}
        reference={reference}
        visible={visible}
        visibleClassName={styles.insertButtonVisible}
      >
        <PlusIcon size={16} />
      </TableControllerButton>
    );
  },
);

TableInsertButton.displayName = 'TableInsertButton';

export default TableInsertButton;
