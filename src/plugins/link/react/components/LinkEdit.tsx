import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { Block, Button, Hotkey, Icon, Input, Text } from '@lobehub/ui';
import type { InputRef } from 'antd';
import {
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  createCommand,
} from 'lexical';
import { BaselineIcon, LinkIcon } from 'lucide-react';
import {
  type ChangeEvent,
  type FC,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Flexbox } from 'react-layout-kit';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { UPDATE_LINK_TEXT_COMMAND } from '../../command';
import { LinkNode } from '../../node/LinkNode';
import { useStyles } from '../style';

export const EDIT_LINK_COMMAND = createCommand<{
  linkNode: LinkNode | null;
  linkNodeDOM: HTMLElement | null;
}>();

const LinkEdit: FC = () => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkNodeRef = useRef<LinkNode | null>(null);
  const linkInputRef = useRef<InputRef | null>(null);
  const linkTextInputRef = useRef<InputRef | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkDom, setLinkDom] = useState<HTMLElement | null>(null);
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();
  const { styles, theme } = useStyles();

  useEffect(() => {
    if (!linkDom || !divRef.current) {
      return;
    }
    computePosition(linkDom, divRef.current, {
      middleware: [offset(8), flip(), shift()],
      placement: 'bottom-start',
    }).then(({ x, y }) => {
      if (divRef.current) {
        divRef.current.style.left = `${x}px`;
        divRef.current.style.top = `${y}px`;
      }
    });
  }, [linkDom]);

  // 提取提交逻辑到独立函数
  const handleSubmit = useCallback(() => {
    const lexicalEditor = editor.getLexicalEditor();
    if (
      !linkNodeRef.current ||
      !linkInputRef.current ||
      !linkTextInputRef.current ||
      !lexicalEditor
    ) {
      return;
    }

    const linkNode = linkNodeRef.current;
    const input = linkInputRef.current;
    const inputDOM = input.input as HTMLInputElement;
    const textInput = linkTextInputRef.current;
    const textInputDOM = textInput.input as HTMLInputElement;

    // 更新链接URL
    const currentURL = lexicalEditor.read(() => linkNode.getURL());
    if (currentURL !== inputDOM.value) {
      lexicalEditor.update(() => {
        linkNode.setURL(inputDOM.value);
      });
    }

    // 更新链接文本
    const currentText = lexicalEditor.read(() => linkNode.getTextContent());
    if (currentText !== textInputDOM.value) {
      lexicalEditor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
        key: linkNode.getKey(),
        text: textInputDOM.value,
      });
    }

    // 关闭编辑器并聚焦到编辑器
    lexicalEditor.focus();

    // 隐藏编辑面板
    if (divRef.current) {
      divRef.current.style.left = '-9999px';
      divRef.current.style.top = '-9999px';
    }
    linkNodeRef.current = null;
    setLinkUrl('');
    setLinkText('');
    setLinkDom(null);
  }, [editor, linkNodeRef, linkInputRef, linkTextInputRef]);

  // 取消编辑，不保存更改
  const handleCancel = useCallback(() => {
    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) return;

    // 将焦点返回到编辑器
    lexicalEditor.focus();

    // 隐藏编辑面板
    if (divRef.current) {
      divRef.current.style.left = '-9999px';
      divRef.current.style.top = '-9999px';
    }
    linkNodeRef.current = null;
    setLinkUrl('');
    setLinkText('');
    setLinkDom(null);
  }, [editor]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const lexicalEditor = editor.getLexicalEditor();
      if (
        !linkNodeRef.current ||
        !linkInputRef.current ||
        !linkTextInputRef.current ||
        !lexicalEditor
      ) {
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
            const currentText = lexicalEditor.read(() => linkNode.getTextContent());
            if (currentText !== textInputDOM.value) {
              lexicalEditor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
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
            lexicalEditor.focus();
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

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerCommand(
        EDIT_LINK_COMMAND,
        (payload) => {
          if (!payload.linkNode || !payload.linkNodeDOM) {
            setLinkDom(null);
            setLinkUrl('');
            setLinkText('');
            if (divRef.current) {
              divRef.current.style.left = '-9999px';
              divRef.current.style.top = '-9999px';
            }
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
          if (divRef.current) {
            divRef.current.style.left = '-9999px';
            divRef.current.style.top = '-9999px';
          }
          linkNodeRef.current = null;
          setLinkUrl('');
          setLinkText('');
          setLinkDom(null);
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
          variant={'outlined'}
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
};

export default LinkEdit;
