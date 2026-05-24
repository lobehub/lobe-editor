import { Trash2Icon } from 'lucide-react';
import { memo } from 'react';

import { styles } from './TableController/style';
import TableControllerButton from './TableControllerButton';

interface TableDeleteButtonProps {
  ariaLabel: string;
  offset?: number;
  onDelete: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position: 'left' | 'top';
  reference: HTMLElement | null;
  visible: boolean;
}

const TableDeleteButton = memo<TableDeleteButtonProps>(
  ({ ariaLabel, offset, onDelete, onMouseEnter, onMouseLeave, position, reference, visible }) => {
    return (
      <TableControllerButton
        ariaLabel={ariaLabel}
        className={styles.deleteButton}
        offset={offset}
        onClick={onDelete}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        position={position}
        reference={reference}
        visible={visible}
        visibleClassName={styles.deleteButtonVisible}
      >
        <Trash2Icon size={14} />
      </TableControllerButton>
    );
  },
);

TableDeleteButton.displayName = 'TableDeleteButton';

export default TableDeleteButton;
