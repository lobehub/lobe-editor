'use client';

import { mergeRegister } from '@lexical/utils';
import { LexicalEditor } from 'lexical';
import { memo, useEffect, useRef } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { CodeMirrorNode } from '../node/CodeMirrorNode';
import { useStyles } from './style';
import { loadCodeMirror } from '../lib';
import { SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND } from '../command';

interface ReactCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

const ReactCodemirrorNode = memo<ReactCodemirrorNodeProps>(({ node, className, editor }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const instanceRef = useRef<any>(null);
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
  const { cx, styles } = useStyles();

  useEffect(() => {
    console.info('isSelected changed:', isSelected);
    if(!isSelected) {
      if(instanceRef.current) {
        instanceRef.current.blur();
      }
      return;
    }
    if(isSelected && instanceRef.current) {
      instanceRef.current.focus();
    }
  }, [isSelected]);

  useEffect(() => {
    if(ref.current) {
      const dom = ref.current;
      loadCodeMirror().then((CodeMirror) => {
        const instance = CodeMirror.fromTextArea(dom, {
          theme: 'One Dark Pro',
          mode: node.lang,
          value: node.code,
          lineNumbers: true,
        });

        instance.on('keydown', (instance, e) => {
          e.stopPropagation();
        });

        instance.on('leftOut', () => {
          editor.dispatchCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, {key: node.getKey()});
          queueMicrotask(() => {
            editor.focus();
          })
        });
        instance.on('rightOut', () => {
          editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, {key: node.getKey()});
          queueMicrotask(() => {
            editor.focus();
          })
        });

        instanceRef.current = instance;
        if(isSelected) {
          instanceRef.current.focus();
        }
      });
    }

    return () => {
      if(instanceRef.current) {
        instanceRef.current.destory();
        instanceRef.current = null;
      }
    };
  }, [ref]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {}),
    );
  }, [clearSelection, editor, isSelected, node, setSelected]);

  return (
    <div className={cx(styles, isSelected && 'selected', className)}>
      <textarea ref={ref} />
    </div>
  );
});

ReactCodemirrorNode.displayName = 'ReactCodemirrorNode';

export default ReactCodemirrorNode;
