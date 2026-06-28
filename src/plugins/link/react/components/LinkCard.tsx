/* eslint-disable @typescript-eslint/no-use-before-define */
import { $createNodeSelection, $getNodeByKey, $setSelection, LexicalEditor } from 'lexical';
import { type FC, type MouseEventHandler, useCallback, useEffect, useState } from 'react';

import { EDIT_LINK_CARD_COMMAND, LinkCardNode } from '../../node/LinkCardNode';
import { LinkReactRendererRegistry } from '../renderer-registry';

interface LinkCardProps {
  description: string;
  editor: LexicalEditor;
  icon: string;
  node: LinkCardNode;
  openTarget: null | string;
  rendererRegistry: LinkReactRendererRegistry;
  title: string;
  url: string;
}

const LinkCard: FC<LinkCardProps> = ({
  description,
  editor,
  icon,
  node,
  openTarget,
  rendererRegistry,
  title,
  url,
}) => {
  const key = node.getKey();
  const [isSelected, setIsSelected] = useState(() => isNodeSelected(editor, key));
  const [, setRendererVersion] = useState(0);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      setIsSelected(isNodeSelected(editor, key));
    });
  }, [editor, key]);

  useEffect(() => {
    const handleChange = () => {
      setRendererVersion((version) => version + 1);
    };
    rendererRegistry.on('change', handleChange);
    return () => {
      rendererRegistry.off('change', handleChange);
    };
  }, [rendererRegistry]);

  const onClickCapture = useCallback<MouseEventHandler<HTMLElement>>(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (editor.isEditable()) return;
      if (openTarget === '_self') {
        window.location.href = url;
        return;
      }
      window.open(url, openTarget || '_blank');
    },
    [editor, openTarget, url],
  );

  const onMouseDownCapture = useCallback<MouseEventHandler<HTMLElement>>(
    (event) => {
      if (!editor.isEditable()) return;
      event.preventDefault();
      event.stopPropagation();
      editor.focus();
      editor.update(() => {
        const selection = $createNodeSelection();
        selection.add(key);
        $setSelection(selection);
      });
      editor.dispatchCommand(EDIT_LINK_CARD_COMMAND, {
        cardNode: node,
        cardNodeDOM: editor.getElementByKey(key),
      });
    },
    [editor, key, node],
  );

  const props = {
    description,
    editor,
    icon,
    isSelected,
    node,
    onClickCapture,
    onMouseDownCapture,
    openTarget,
    title,
    url,
  };

  return rendererRegistry.renderCardNode(props) || <DefaultLinkCard {...props} />;
};

LinkCard.displayName = 'LinkCard';

export default LinkCard;

function isNodeSelected(editor: LexicalEditor, key: string): boolean {
  return editor.getEditorState().read(() => {
    const currentNode = $getNodeByKey(key);
    return currentNode?.isSelected() ?? false;
  });
}

function DefaultLinkCard(props: {
  description: string;
  icon: string;
  isSelected: boolean;
  onClickCapture: MouseEventHandler<HTMLElement>;
  onMouseDownCapture: MouseEventHandler<HTMLElement>;
  openTarget: null | string;
  title: string;
  url: string;
}) {
  return (
    <a
      href={props.url}
      onClickCapture={props.onClickCapture}
      onMouseDownCapture={props.onMouseDownCapture}
      rel="noreferrer"
      style={{
        alignItems: 'center',
        color: '#1677ff',
        display: 'inline-flex',
        gap: 4,
        lineHeight: 1,
        maxWidth: 320,
        outline: props.isSelected ? '2px solid rgba(22,119,255,0.45)' : undefined,
        outlineOffset: props.isSelected ? 1 : undefined,
        padding: '0 2px',
        textDecoration: 'none',
        verticalAlign: 'baseline',
      }}
      target={props.openTarget || '_blank'}
    >
      {props.icon ? (
        <img
          alt=""
          src={props.icon}
          style={{
            borderRadius: 5,
            display: 'block',
            height: '1.1em',
            objectFit: 'cover',
            position: 'relative',
            top: '0.06em',
            width: '1.1em',
          }}
        />
      ) : (
        <span
          style={{
            alignItems: 'center',
            background: 'rgba(0,0,0,0.06)',
            borderRadius: 5,
            display: 'inline-flex',
            fontSize: 11,
            height: '1.1em',
            justifyContent: 'center',
            lineHeight: 1,
            position: 'relative',
            top: '0.06em',
            width: '1.1em',
          }}
        >
          {props.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span
        style={{
          display: 'inline-block',
          lineHeight: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontSize: '1em',
            fontWeight: 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {props.title}
        </span>
      </span>
    </a>
  );
}
