import type { LexicalEditor } from 'lexical';
import { $createNodeSelection, $getNodeByKey, $setSelection } from 'lexical';
import {
  type FC,
  type MouseEventHandler,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import type { LinkCardNode } from '../../node/LinkCardNode';
import { EDIT_LINK_CARD_COMMAND } from '../../node/LinkCardNode';
import { ILinkService } from '../../service/i-link-service';
import type { LinkReactRendererRegistry } from '../renderer-registry';

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
  const linkService = getKernelFromEditor(editor)?.requireService(ILinkService);
  const subscribeCardMetadata = useCallback(
    (listener: () => void) => linkService?.subscribeCardMetadata(listener) || (() => {}),
    [linkService],
  );
  const getCardMetadataSnapshot = useCallback(
    () => linkService?.isCardMetadataLoading(key) ?? false,
    [key, linkService],
  );
  const isLoading = useSyncExternalStore(
    subscribeCardMetadata,
    getCardMetadataSnapshot,
    getCardMetadataSnapshot,
  );
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
    isLoading,
    isSelected,
    layout: node.isInline() ? ('inline' as const) : ('block' as const),
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

export function DefaultLinkCard(props: {
  description: string;
  icon: string;
  isLoading: boolean;
  isSelected: boolean;
  layout: 'block' | 'inline';
  onClickCapture: MouseEventHandler<HTMLElement>;
  onMouseDownCapture: MouseEventHandler<HTMLElement>;
  openTarget: null | string;
  title: string;
  url: string;
}) {
  if (props.layout === 'block') {
    return (
      <a
        aria-busy={props.isLoading}
        href={props.url}
        onClickCapture={props.onClickCapture}
        onMouseDownCapture={props.onMouseDownCapture}
        rel="noreferrer"
        style={{
          alignItems: 'center',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          color: 'inherit',
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '40px minmax(0, 1fr)',
          maxWidth: 520,
          outline: props.isSelected ? '2px solid rgba(22,119,255,0.45)' : undefined,
          outlineOffset: props.isSelected ? 1 : undefined,
          padding: 12,
          textDecoration: 'none',
          width: '100%',
        }}
        target={props.openTarget || '_blank'}
      >
        {props.isLoading ? (
          <LinkCardLoadingIndicator size={18} />
        ) : props.icon ? (
          <img
            alt=""
            src={props.icon}
            style={{ borderRadius: 8, height: 40, objectFit: 'cover', width: 40 }}
          />
        ) : null}
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.title}
          </strong>
          {props.isLoading ? (
            <span style={{ fontSize: 12, opacity: 0.65 }}>Loading preview...</span>
          ) : props.description ? (
            <span
              style={{
                opacity: 0.65,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {props.description}
            </span>
          ) : null}
        </span>
      </a>
    );
  }

  return (
    <a
      aria-busy={props.isLoading}
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
      {props.isLoading ? (
        <LinkCardLoadingIndicator size={'1.1em'} />
      ) : props.icon ? (
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

function LinkCardLoadingIndicator({ size }: { size: number | string }) {
  return (
    <>
      <style>{'@keyframes lobe-link-card-spin{to{transform:rotate(360deg)}}'}</style>
      <span
        aria-label="Loading link preview"
        role="status"
        style={{
          animation: 'lobe-link-card-spin 1s linear infinite',
          border: '2px solid rgba(0,0,0,0.12)',
          borderRadius: '50%',
          borderTopColor: '#1677ff',
          boxSizing: 'border-box',
          display: 'inline-block',
          flex: '0 0 auto',
          height: size,
          width: size,
        }}
      />
    </>
  );
}
