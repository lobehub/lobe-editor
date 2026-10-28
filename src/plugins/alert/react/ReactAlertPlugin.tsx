'use client';

import { cx } from '@lobehub/ui';
import type { NodeKey } from 'lexical';
import { $getNodeByKey } from 'lexical';
import { type FC, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { $isAlertNode, ALERT_HEADER_SELECTOR, AlertNode, type AlertType } from '../node/AlertNode';
import { AlertPlugin } from '../plugin';
import AlertHeader from './AlertHeader';
import { styles } from './style';
import type { ReactAlertPluginProps } from './type';

interface AlertHeaderSlot {
  alertType: AlertType;
  container: HTMLElement;
}

const ReactAlertPlugin: FC<ReactAlertPluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();
  const { editable } = useEditable();
  const [slots, setSlots] = useState<Map<NodeKey, AlertHeaderSlot>>(() => new Map());

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(AlertPlugin, {
      theme: {
        alert: cx(styles.alert, className),
      },
    });
  }, [className, editor]);

  useLexicalEditor((lexicalEditor) => {
    return lexicalEditor.registerMutationListener(AlertNode, (mutations) => {
      setSlots((prev) => {
        const next = new Map(prev);
        lexicalEditor.getEditorState().read(() => {
          for (const [key, mutation] of mutations) {
            const node = $getNodeByKey(key);
            const container = lexicalEditor
              .getElementByKey(key)
              ?.querySelector<HTMLElement>(ALERT_HEADER_SELECTOR);
            if (mutation === 'destroyed' || !$isAlertNode(node) || !container) {
              next.delete(key);
              continue;
            }
            next.set(key, { alertType: node.getAlertType(), container });
          }
        });
        return next;
      });
    });
  }, []);

  return (
    <>
      {Array.from(slots, ([key, { alertType, container }]) =>
        createPortal(
          <AlertHeader alertType={alertType} editable={editable} nodeKey={key} />,
          container,
          key,
        ),
      )}
    </>
  );
};

ReactAlertPlugin.displayName = 'ReactAlertPlugin';

export default ReactAlertPlugin;
