import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { Button, Hotkey, TextArea } from '@lobehub/ui';
import { type TextAreaRef } from 'antd/es/input/TextArea';
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  isModifierMatch,
} from 'lexical';
import { type FC, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { CONTROL_OR_META } from '@/common/sys';
import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';

import { SELECT_MATH_SIDE_COMMAND, UPDATE_MATH_COMMAND } from '../../command';
import { $isMathNode, MathBlockNode, MathInlineNode } from '../../node';
import { useStyles } from '../style';

export const MathEdit: FC = () => {
  const divRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<TextAreaRef>(null);
  const [mathNode, setMathNode] = useState<MathInlineNode | MathBlockNode | null>(null);
  const [value, setValue] = useState<string>('');
  const [mathDOM, setMathDOM] = useState<HTMLElement | null>(null);
  const [prev, setPrev] = useState<boolean>(false);
  const { styles } = useStyles();
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!mathDOM || !divRef.current) {
      return;
    }
    computePosition(mathDOM, divRef.current, {
      middleware: [offset(8), flip(), shift()],
      placement: 'bottom-start',
    }).then(({ x, y }) => {
      if (divRef.current) {
        divRef.current.style.left = `${x}px`;
        divRef.current.style.top = `${y}px`;
        textareaRef.current?.focus();
        if (prev) {
          textareaRef.current?.resizableTextArea?.textArea?.setSelectionRange(0, 0);
        }
      }
    });
  }, [mathDOM, prev]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mathNode) return;
      if (isModifierMatch(e, CONTROL_OR_META) && e.key === 'Enter') {
        e.preventDefault();
        editor.dispatchCommand(UPDATE_MATH_COMMAND, { code: value, key: mathNode.getKey() });
        return;
      }
      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
        e.preventDefault();
        editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: true });
      }
      if (
        e.key === 'ArrowRight' &&
        e.currentTarget.selectionStart === e.currentTarget.value.length
      ) {
        e.preventDefault();
        editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: false });
      }
    },
    [mathNode, value],
  );

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(({ prevEditorState }) => {
        // Handle editor state updates
        const canEdit = editor.read(() => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            return false;
          }
          const node = selection.getNodes()[0];
          if (!$isMathNode(node)) {
            // Handle math node
            return false;
          }
          setMathNode(node);
          setValue(node.code);
          setMathDOM(editor.getElementByKey(node.getKey()));
          return node;
        });

        if (canEdit) {
          const node = prevEditorState.read(() => {
            const sel = prevEditorState._selection;
            if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
              return false;
            }
            const node = sel.anchor.getNode();
            if ($isTextNode(node)) {
              return node.getNextSibling();
            }
            if (!$isElementNode(node)) {
              return false;
            }
            return node.getChildAtIndex(sel.anchor.offset);
          });
          if (canEdit === node) {
            setPrev(true);
          } else {
            setPrev(false);
          }
        }

        if (!canEdit) {
          setMathNode(null);
          setMathDOM(null);
          setValue('');
          if (divRef.current) {
            divRef.current.style.left = `-10000px`;
            divRef.current.style.top = `-10000px`;
          }
        }
      }),
    );
  }, []);

  return (
    <div className={styles.mathEditor} ref={divRef}>
      <TextArea
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        ref={textareaRef}
        value={value}
      />
      <div className="bottom">
        <Button className="button" type="text">
          <Hotkey keys="mod+enter" />
        </Button>
      </div>
    </div>
  );
};
