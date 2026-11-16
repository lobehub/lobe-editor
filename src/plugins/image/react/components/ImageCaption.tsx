import type { LexicalEditor } from 'lexical';
import {
  type FC,
  type KeyboardEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useEditable } from '@/editor-kernel/react/useEditable';
import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { styles } from './style';

export interface CaptionNode {
  caption: string;
  setCaption: (caption: string) => void;
}

interface ImageCaptionProps {
  active: boolean;
  node: CaptionNode;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

const ImageCaption: FC<ImageCaptionProps> = ({ active, node }) => {
  const { editable } = useEditable();
  const t = useTranslation();
  const caption = node.caption;
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const editorRef = useRef<LexicalEditor | null>(null);

  useLexicalEditor((editor) => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // Native beforeinput must not reach Lexical's root listener, otherwise it is applied to
    // the editor selection (e.g. replacing the selected image node) instead of the input.
    const stop = (event: Event) => event.stopPropagation();
    input.addEventListener('beforeinput', stop);
    return () => input.removeEventListener('beforeinput', stop);
  });

  const handleBlur = useCallback(() => {
    const next = draft;
    setDraft(null);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const editor = editorRef.current;
    if (!editor || next === null || next === node.caption) return;
    editor.update(() => {
      node.setCaption(next);
    });
  }, [draft, node]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelRef.current = true;
      event.currentTarget.blur();
    }
  }, []);

  if (!editable) {
    if (!caption) return null;
    return (
      <div className={styles.caption} data-image-caption="">
        {caption}
      </div>
    );
  }

  if (!caption && !active && draft === null) return null;

  return (
    <input
      aria-label={t('image.captionPlaceholder')}
      className={styles.captionInput}
      data-image-caption=""
      onBlur={handleBlur}
      onChange={(event) => setDraft(event.target.value)}
      onClick={stopPropagation}
      onCopy={stopPropagation}
      onCut={stopPropagation}
      onFocus={() => setDraft((current) => current ?? caption)}
      onInput={stopPropagation}
      onKeyDown={handleKeyDown}
      onKeyUp={stopPropagation}
      onMouseDown={stopPropagation}
      onPaste={stopPropagation}
      placeholder={t('image.captionPlaceholder')}
      ref={inputRef}
      type="text"
      value={draft ?? caption}
    />
  );
};

ImageCaption.displayName = 'ImageCaption';

export default ImageCaption;
