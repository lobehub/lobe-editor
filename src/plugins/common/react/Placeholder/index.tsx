import { mergeRegister } from '@lexical/utils';
import { LexicalEditor } from 'lexical';
import { CSSProperties, ReactNode, memo, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';

import { $canShowPlaceholderCurry } from '../../utils';
import { useStyles } from './style';

export interface PlaceholderProps {
  children: ReactNode;
  style?: CSSProperties;
}

function canShowPlaceholderFromCurrentEditorState(editor: LexicalEditor): boolean {
  const currentCanShowPlaceholder = editor
    .getEditorState()
    .read($canShowPlaceholderCurry(editor.isComposing()));

  return currentCanShowPlaceholder;
}

const Placeholder = memo<PlaceholderProps>(({ children, style }) => {
  const [canShowPlaceholder, setCanShowPlaceholder] = useState(() => false);
  const [top, setTop] = useState(-25);
  const { styles } = useStyles();

  useLexicalEditor((editor) => {
    setCanShowPlaceholder(() => canShowPlaceholderFromCurrentEditorState(editor));
    function resetCanShowPlaceholder() {
      const currentCanShowPlaceholder = canShowPlaceholderFromCurrentEditorState(editor);
      setCanShowPlaceholder(currentCanShowPlaceholder);
      const root = editor.getRootElement();
      requestAnimationFrame(() => {
        if (root) {
          setTop(root.firstElementChild?.getBoundingClientRect().height || 0);
        }
      });
    }
    resetCanShowPlaceholder();

    return mergeRegister(
      editor.registerUpdateListener(() => {
        resetCanShowPlaceholder();
      }),
      editor.registerEditableListener(() => {
        resetCanShowPlaceholder();
      }),
    );
  }, []);

  if (!canShowPlaceholder) {
    return null;
  }

  return (
    <div
      className={styles.placeholder}
      style={{
        ...style,
        marginTop: -top,
      }}
    >
      <div className={styles.placeholderContainer}>{children}</div>
    </div>
  );
});

Placeholder.displayName = 'Placeholder';

export default Placeholder;
