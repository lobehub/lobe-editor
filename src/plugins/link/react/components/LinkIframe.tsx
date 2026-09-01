import type { LexicalEditor } from 'lexical';
import { $createNodeSelection, $getNodeByKey, $setSelection } from 'lexical';
import {
  type FC,
  type MouseEventHandler,
  type ReactEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { LinkIframeNode } from '../../node/LinkIframeNode';
import type { LinkReactRendererRegistry } from '../renderer-registry';

interface LinkIframeProps {
  editor: LexicalEditor;
  node: LinkIframeNode;
  rendererRegistry: LinkReactRendererRegistry;
  src: string;
  title: string;
  url: string;
}

const LinkIframe: FC<LinkIframeProps> = ({ editor, node, rendererRegistry, src, title, url }) => {
  const key = node.getKey();
  const [isSelected, setIsSelected] = useState(() => isNodeSelected(editor, key));
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const isLoading = loadedSrc !== src;
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

  const onLoad = useCallback(() => {
    setLoadedSrc(src);
  }, [src]);

  const onMouseDownCapture = useCallback<MouseEventHandler<HTMLElement>>(
    (event) => {
      if (!editor.isEditable()) return;
      event.currentTarget.focus();
      event.preventDefault();
      event.stopPropagation();
      editor.focus();
      editor.update(() => {
        const selection = $createNodeSelection();
        selection.add(key);
        $setSelection(selection);
      });
    },
    [editor, key],
  );

  const props = {
    editor,
    isEditable: editor.isEditable(),
    isLoading,
    isSelected,
    node,
    onLoad,
    onMouseDownCapture,
    src,
    title,
    url,
  };

  return rendererRegistry.renderIframeNode(props) || <DefaultLinkIframe {...props} />;
};

LinkIframe.displayName = 'LinkIframe';

export default LinkIframe;

function isNodeSelected(editor: LexicalEditor, key: string): boolean {
  return editor.getEditorState().read(() => {
    const currentNode = $getNodeByKey(key);
    return currentNode?.isSelected() ?? false;
  });
}

export function DefaultLinkIframe(props: {
  isEditable: boolean;
  isLoading: boolean;
  isSelected: boolean;
  onLoad: ReactEventHandler<HTMLIFrameElement>;
  onMouseDownCapture: MouseEventHandler<HTMLElement>;
  src: string;
  title: string;
  url: string;
}) {
  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        boxShadow: props.isSelected ? '0 0 0 2px rgba(22,119,255,0.18)' : undefined,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        ...(props.isSelected ? { borderColor: '#1677ff' } : {}),
      }}
      tabIndex={0}
    >
      {props.isLoading && (
        <style>{'@keyframes lobe-link-iframe-spin{to{transform:rotate(360deg)}}'}</style>
      )}
      <div
        onMouseDownCapture={props.onMouseDownCapture}
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          color: 'rgba(0,0,0,0.55)',
          cursor: props.isEditable ? 'pointer' : 'default',
          fontSize: 12,
          padding: '8px 10px',
        }}
      >
        {props.title}
      </div>
      {props.isLoading && (
        <div
          style={{
            alignItems: 'center',
            background: 'rgba(0,0,0,0.03)',
            bottom: 0,
            color: 'rgba(0,0,0,0.45)',
            display: 'flex',
            fontSize: 13,
            gap: 8,
            height: 320,
            justifyContent: 'center',
            left: 0,
            position: 'absolute',
            right: 0,
            zIndex: 1,
          }}
        >
          <span
            style={{
              animation: 'lobe-link-iframe-spin 1s linear infinite',
              border: '2px solid rgba(0,0,0,0.12)',
              borderRadius: '50%',
              borderTopColor: '#1677ff',
              display: 'inline-block',
              height: 14,
              width: 14,
            }}
          />
          Loading embed...
        </div>
      )}
      <iframe
        loading="lazy"
        onLoad={props.onLoad}
        src={props.src}
        style={{
          border: 0,
          display: 'block',
          height: 320,
          visibility: props.isLoading ? 'hidden' : 'visible',
          width: '100%',
        }}
        title={props.title}
      />
    </div>
  );
}
