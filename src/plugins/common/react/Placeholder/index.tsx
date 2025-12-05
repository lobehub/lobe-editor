import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isBlockElementNode,
  $isRangeSelection,
  ElementNode,
  LexicalEditor,
  LexicalNode,
} from 'lexical';
import { type CSSProperties, type ReactNode, memo, useRef, useState } from 'react';

import { $closestNodeType } from '@/editor-kernel';
import { useLexicalEditor } from '@/editor-kernel/react';

import { $canShowPlaceholderCurry } from '../../utils';
import { useStyles } from './style';

export interface PlaceholderProps {
  children: ReactNode;
  lineEmptyPlaceholder?: string;
  style?: CSSProperties;
}

function canShowPlaceholderFromCurrentEditorState(editor: LexicalEditor): boolean {
  const currentCanShowPlaceholder = editor
    .getEditorState()
    .read($canShowPlaceholderCurry(editor.isComposing()));

  return currentCanShowPlaceholder;
}

// 判断 DOM 是否只有一个 br 子元素
function hasOnlyBrChild(element: HTMLElement): boolean {
  const children = element.childNodes;
  return (
    children.length === 1 &&
    children[0].nodeType === Node.ELEMENT_NODE &&
    (children[0] as Element).tagName.toLowerCase() === 'br'
  );
}

const Placeholder = memo<PlaceholderProps>(({ children, style, lineEmptyPlaceholder }) => {
  const currentPlaceHolderRef = useRef<HTMLElement | null>(null);
  const [canShowPlaceholder, setCanShowPlaceholder] = useState(() => false);

  const { styles } = useStyles();

  useLexicalEditor((editor) => {
    setCanShowPlaceholder(() => canShowPlaceholderFromCurrentEditorState(editor));
    function resetCanShowPlaceholder() {
      const currentCanShowPlaceholder = canShowPlaceholderFromCurrentEditorState(editor);
      setCanShowPlaceholder(currentCanShowPlaceholder);
      return currentCanShowPlaceholder;
    }
    resetCanShowPlaceholder();

    return mergeRegister(
      editor.registerUpdateListener(() => {
        const show = resetCanShowPlaceholder();
        if (!show && lineEmptyPlaceholder) {
          editor.read(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel) && sel.isCollapsed()) {
              const anchor = sel.anchor;
              let node: LexicalNode | ElementNode | null = $getNodeByKey(anchor.key);
              while (node && !$isBlockElementNode(node)) {
                node = node.getParent();
              }
              const tableNode = $closestNodeType(node, ['tablecell', 'heading']);
              if (node && !tableNode) {
                const dom = editor.getElementByKey(node.getKey()) as HTMLElement | null;
                if (dom && hasOnlyBrChild(dom)) {
                  if (currentPlaceHolderRef.current && currentPlaceHolderRef.current !== dom) {
                    currentPlaceHolderRef.current.dataset.placeholder = '';
                  }
                  currentPlaceHolderRef.current = dom;
                  dom.dataset.placeholder = lineEmptyPlaceholder;
                  return;
                }
              }
              if (currentPlaceHolderRef.current) {
                currentPlaceHolderRef.current.dataset.placeholder = '';
                currentPlaceHolderRef.current = null;
              }
            }
          });
        }
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
    <div className={styles.placeholder} style={style}>
      {children}
    </div>
  );
});

Placeholder.displayName = 'Placeholder';

export default Placeholder;
