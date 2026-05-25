import { Editor, useEditor } from '@lobehub/editor/react';
import { createStaticStyles } from 'antd-style';
import { type FC } from 'react';

const useStyles = createStaticStyles(({ css }) => ({
  container: css`
    display: flex;
    gap: 16px;
    padding: 16px;
  `,
  editor: css`
    min-height: 120px;
    padding: 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
  `,
  label: css`
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 500;
    opacity: 0.6;
  `,
  wrapper: css`
    flex: 1;
  `,
}));

const SpellCheckOn: FC = () => {
  const editor = useEditor();
  const styles = useStyles();
  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>{'spellCheck={true}'} (browser default)</div>
      <Editor
        autoFocus
        className={styles.editor}
        content={''}
        editor={editor}
        placeholder={'Type here — browser spellcheck & Safari predictive text active...'}
        spellCheck={true}
        type={'text'}
        variant={'chat'}
      />
    </div>
  );
};

const SpellCheckOff: FC = () => {
  const editor = useEditor();
  const styles = useStyles();
  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>{'spellCheck={false}'} (recommended for chat input)</div>
      <Editor
        className={styles.editor}
        content={''}
        editor={editor}
        placeholder={'Type here — spellcheck & Safari predictive text suppressed...'}
        spellCheck={false}
        type={'text'}
        variant={'chat'}
      />
    </div>
  );
};

const Demo: FC = () => {
  const styles = useStyles();
  return (
    <div className={styles.container}>
      <SpellCheckOn />
      <SpellCheckOff />
    </div>
  );
};

export default Demo;
