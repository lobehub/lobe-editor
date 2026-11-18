import { copyToClipboard, type LexicalClipboardData } from '@lexical/clipboard';
import { ActionIcon, DropdownMenu, type DropdownMenuProps } from '@lobehub/ui';
import { CopyIcon, MoreHorizontalIcon, Trash2Icon, ZoomInIcon } from 'lucide-react';
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
  useCallback,
  useMemo,
} from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import type { BlockImageNode } from '../../node/block-image-node';
import type { ImageNode } from '../../node/image-node';
import { $deleteImageByKey, $getImageClipboardData } from '../../utils/actions';
import { styles } from './style';

export interface ImageActionsProps {
  node: ImageNode | BlockImageNode;
  onMenuOpenChange?: (open: boolean) => void;
  onPreview?: (event: ReactMouseEvent) => void;
  /** Show the "..." menu (delete / copy). Only for editable editors. */
  showMenu: boolean;
  /** Show the zoom-in preview button. */
  showPreview: boolean;
}

// Clicks inside the dropdown portal bubble through the React tree; keep them
// from reaching the image container (which selects the image and opens the
// edit popover).
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();
// Keep the editor selection while pressing the trigger.
const preventDefault = (event: SyntheticEvent) => event.preventDefault();

const ImageActions = memo<ImageActionsProps>(
  ({ node, onMenuOpenChange, onPreview, showMenu, showPreview }) => {
    const [editor] = useLexicalComposerContext();
    const t = useTranslation();
    const nodeKey = node.getKey();
    const canCopy = node.status === 'uploaded';

    const handleDelete = useCallback(() => {
      editor.getLexicalEditor()?.update(() => {
        $deleteImageByKey(nodeKey);
      });
    }, [editor, nodeKey]);

    const handleCopy = useCallback(() => {
      const lexicalEditor = editor.getLexicalEditor();
      if (!lexicalEditor) return;

      let data: LexicalClipboardData | null = null;
      lexicalEditor.read(() => {
        data = $getImageClipboardData(nodeKey);
      });
      if (data) void copyToClipboard(lexicalEditor, null, data);
    }, [editor, nodeKey]);

    const items = useMemo<DropdownMenuProps['items']>(
      () => [
        {
          icon: Trash2Icon,
          key: 'delete',
          label: t('image.delete'),
          onClick: handleDelete,
        },
        {
          disabled: !canCopy,
          icon: CopyIcon,
          key: 'copy',
          label: t('image.copy'),
          onClick: handleCopy,
        },
      ],
      [canCopy, handleCopy, handleDelete, t],
    );

    if (!showMenu && !showPreview) return null;

    return (
      <div
        className={styles.actions}
        data-image-actions="true"
        onClick={stopPropagation}
        onDoubleClick={stopPropagation}
        role="toolbar"
      >
        {showMenu && (
          <DropdownMenu
            items={items}
            onOpenChange={onMenuOpenChange}
            placement="bottomRight"
            positionerProps={{ style: { zIndex: 10_001 } }}
          >
            <ActionIcon
              aria-label={t('image.more')}
              className={styles.overlayAction}
              glass
              icon={MoreHorizontalIcon}
              onMouseDown={preventDefault}
              size="small"
              title={t('image.more')}
              variant="filled"
            />
          </DropdownMenu>
        )}
        {showPreview && (
          <ActionIcon
            aria-label={t('image.preview')}
            className={styles.overlayAction}
            glass
            icon={ZoomInIcon}
            onClick={onPreview}
            size="small"
            title={t('image.preview')}
            variant="filled"
          />
        )}
      </div>
    );
  },
);

ImageActions.displayName = 'ImageActions';

export default ImageActions;
