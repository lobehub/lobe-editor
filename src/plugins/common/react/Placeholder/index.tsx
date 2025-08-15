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

  const { styles } = useStyles();

  useLexicalEditor((editor) => {
    setCanShowPlaceholder(() => canShowPlaceholderFromCurrentEditorState(editor));
    function resetCanShowPlaceholder() {
      const currentCanShowPlaceholder = canShowPlaceholderFromCurrentEditorState(editor);
      setCanShowPlaceholder(currentCanShowPlaceholder);
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
    <p className={styles.placeholder} style={style}>
      {children}
    </p>
  );
});

Placeholder.displayName = 'Placeholder';

export default Placeholder;
