import type { LexicalEditor, NodeKey } from 'lexical';
import {
  type ComponentClass,
  type FC,
  type JSX,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';

import { CAN_USE_DOM } from '@/common/canUseDOM';
import { IEditor } from '@/types';

// This workaround is no longer necessary in React 19,
// but we currently support React >=17.x
// https://github.com/facebook/react/pull/26395
const useLayoutEffectImpl: typeof useLayoutEffect = CAN_USE_DOM ? useLayoutEffect : useEffect;

type ErrorBoundaryProps = {
  children: JSX.Element;
  onError: (error: Error) => void;
};

export type ErrorBoundaryType = ComponentClass<ErrorBoundaryProps> | FC<ErrorBoundaryProps>;

export function useDecorators(
  editor: IEditor,
  ErrorBoundary: ErrorBoundaryType,
): Array<JSX.Element> {
  const [decorators, setDecorators] = useState<Record<NodeKey, JSX.Element>>(
    () => editor.getLexicalEditor()?.getDecorators<JSX.Element>() || {},
  );

  // Subscribe to changes
  useLayoutEffectImpl(() => {
    let clears: Array<() => void> = [];
    const handleInit = (editor: LexicalEditor) => {
      console.log('[useDecorators] Setting up decorator listener for editor');

      // Get initial decorators
      const initialDecorators = editor.getDecorators<JSX.Element>();
      console.log('[useDecorators] Initial decorators:', {
        count: Object.keys(initialDecorators).length,
        keys: Object.keys(initialDecorators),
      });
      setDecorators(initialDecorators);

      clears.push(
        editor.registerDecoratorListener<JSX.Element>((nextDecorators) => {
          console.log('[useDecorators] Decorator listener triggered:', {
            count: Object.keys(nextDecorators).length,
            keys: Object.keys(nextDecorators),
          });
          flushSync(() => {
            setDecorators(nextDecorators);
          });
        }),
      );
    };

    // Check if editor is already initialized
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      console.log('[useDecorators] Editor already initialized, setting up listener immediately');
      handleInit(lexicalEditor);
    } else {
      console.log('[useDecorators] Waiting for editor initialization');
      editor.on('initialized', handleInit);
      clears.push(() => {
        editor.off('initialized', handleInit);
      });
    }

    return () => {
      clears.forEach((clear) => clear());
    };
  }, [editor]);

  // Return decorators defined as React Portals
  return useMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators);

    console.log('[useDecorators] Processing decorators:', {
      decoratorCount: decoratorKeys.length,
      decoratorKeys,
      decorators: Object.fromEntries(
        Object.entries(decorators).map(([key, value]) => [key, !!value]),
      ),
    });

    for (const nodeKey of decoratorKeys) {
      const reactDecorator = (
        <ErrorBoundary onError={(e) => editor.getLexicalEditor()?._onError(e)}>
          <Suspense fallback={null}>{decorators[nodeKey]}</Suspense>
        </ErrorBoundary>
      );
      const element = editor.getLexicalEditor()?.getElementByKey(nodeKey);

      console.log('[useDecorators] Processing decorator:', {
        decorator: !!decorators[nodeKey],
        elementTagName: element?.tagName,
        hasElement: !!element,
        nodeKey,
      });

      if (element !== null && element !== undefined) {
        decoratedPortals.push(createPortal(reactDecorator, element, nodeKey));
        console.log('[useDecorators] Created portal for:', nodeKey);
      } else {
        console.warn('[useDecorators] No element found for decorator:', nodeKey);
      }
    }

    console.log('[useDecorators] Total portals created:', decoratedPortals.length);
    return decoratedPortals;
  }, [ErrorBoundary, decorators, editor]);
}
