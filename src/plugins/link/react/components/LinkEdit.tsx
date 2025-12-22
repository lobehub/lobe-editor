import { mergeRegister } from '@lexical/utils';
import { Block, Button, Hotkey, Icon, Input, Text , Flexbox } from '@lobehub/ui';
import type { InputRef } from 'antd';
import {
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
  createCommand,
} from 'lexical';
import { BaselineIcon, LinkIcon } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import { UPDATE_LINK_TEXT_COMMAND } from '../../command';
import { LinkNode } from '../../node/LinkNode';
import { useStyles } from '../style';

export const EDIT_LINK_COMMAND = createCommand<{
  linkNode: LinkNode | null;
  linkNodeDOM: HTMLElement | null;
}>();

interface LinkEditProps {
  editor: LexicalEditor;
}

const LinkEdit = memo<LinkEditProps>(({ editor }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkNodeRef = useRef<LinkNode | null>(null);
  const linkInputRef = useRef<InputRef | null>(null);
  const linkTextInputRef = useRef<InputRef | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkDom, setLinkDom] = useState<HTMLElement | null>(null);
  const { editable } = useEditable();

  const t = useTranslation();
  const { styles, theme } = useStyles();

  // 取消编辑，不保存更改
  const handleCancel = useCallback(() => {
    if (!editor) return;
    editor.focus();
    cleanPosition(divRef.current);
    linkNodeRef.current = null;
    setLinkUrl('');
    setLinkText('');
    setLinkDom(null);
  }, [editor]);

  // 提取提交逻辑到独立函数
  const handleSubmit = useCallback(() => {
    if (!linkNodeRef.current || !linkInputRef.current || !linkTextInputRef.current || !editor)
      return;

    const linkNode = linkNodeRef.current;
    const input = linkInputRef.current;
    const inputDOM = input.input as HTMLInputElement;
    const textInput = linkTextInputRef.current;
    const textInputDOM = textInput.input as HTMLInputElement;

    // 更新链接URL
    const currentURL = editor.read(() => linkNode.getURL());
    if (currentURL !== inputDOM.value) {
      editor.update(() => {
        linkNode.setURL(inputDOM.value);
      });
    }

    // 更新链接文本
    const currentText = editor.read(() => linkNode.getTextContent());
    if (currentText !== textInputDOM.value) {
      editor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
        key: linkNode.getKey(),
        text: textInputDOM.value,
      });
    }

    // 关闭编辑器并聚焦到编辑器
    editor.focus();

    // 隐藏编辑面板
    handleCancel();
  }, [editor, linkNodeRef, linkInputRef, linkTextInputRef, handleCancel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!linkNodeRef.current || !linkInputRef.current || !linkTextInputRef.current || !editor) {
        return;
      }

      const linkNode = linkNodeRef.current;
      const input = linkInputRef.current;
      const inputDOM = input.input as HTMLInputElement;
      const textInput = linkTextInputRef.current;
      const textInputDOM = textInput.input as HTMLInputElement;
      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          if (event.currentTarget === textInputDOM) {
            const currentText = editor.read(() => linkNode.getTextContent());
            if (currentText !== textInputDOM.value) {
              editor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
                key: linkNode.getKey(),
                text: textInputDOM.value,
              });
              // 更新文本后跳转到链接输入框
              inputDOM.focus();
            } else {
              // 如果文本没有变化，直接跳转到链接输入框
              inputDOM.focus();
            }
          } else if (event.currentTarget === inputDOM) {
            // 在链接输入框按回车时提交所有更改
            handleSubmit();
          }
          return;
        }
        case 'Tab': {
          event.preventDefault();
          if (event.currentTarget === textInputDOM) {
            inputDOM.focus();
          } else {
            editor.focus();
          }
          return;
        }
        case 'Escape': {
          event.preventDefault();
          handleCancel();
          return;
        }
        // No default
      }
    },
    [linkNodeRef, linkInputRef, handleSubmit, handleCancel],
  );

  useEffect(() => {
    if (linkDom) {
      updatePosition({
        floating: divRef.current,
        reference: linkDom,
      });
    } else {
      cleanPosition(divRef.current);
    }
  }, [linkDom]);

  // 点击编辑器外部时关闭面板
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!divRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      // 点击面板内部忽略
      if (divRef.current.contains(target)) return;
      // 面板打开时（存在 linkDom）才触发关闭
      if (linkDom) handleCancel();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [linkDom]);

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerCommand(
        EDIT_LINK_COMMAND,
        (payload) => {
          if (!payload.linkNode || !payload.linkNodeDOM) {
            handleCancel();
            return false;
          }
          linkNodeRef.current = payload.linkNode;
          setLinkUrl(payload.linkNode.getURL());
          setLinkText(payload.linkNode.getTextContent());
          setLinkDom(payload.linkNodeDOM);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          handleCancel();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (payload) => {
          if (linkNodeRef.current && linkTextInputRef.current) {
            payload.stopImmediatePropagation();
            payload.preventDefault();
            linkTextInputRef.current.focus();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, []);

  if (!linkNodeRef.current || !editable) return null;

  return (
    <Block className={styles.linkEdit} ref={divRef} shadow variant={'outlined'}>
      <Flexbox gap={8} padding={12}>
        <Text weight={500}>{t('link.editTextTitle')}</Text>
        <Input
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            // Handle link text change
            setLinkText(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          prefix={<Icon color={theme.colorTextDescription} icon={BaselineIcon} />}
          ref={linkTextInputRef}
          value={linkText}
        />
        <Text weight={500}>{t('link.editLinkTitle')}</Text>
        <Input
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            // Handle link URL change
            setLinkUrl(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="https://enter-link-url"
          prefix={<Icon color={theme.colorTextDescription} icon={LinkIcon} />}
          ref={linkInputRef}
          value={linkUrl}
        />
      </Flexbox>
      <Flexbox
        className={styles.linkEditFooter}
        horizontal
        justify={'flex-end'}
        padding={4}
        width={'100%'}
      >
        <Button
          onClick={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          size={'small'}
          type={'text'}
          variant={'filled'}
        >
          {t('confirm')}
          <Hotkey compact keys="enter" variant={'borderless'} />
        </Button>
      </Flexbox>
    </Block>
  );
});

LinkEdit.displayName = 'LinkEdit';

export default LinkEdit;
