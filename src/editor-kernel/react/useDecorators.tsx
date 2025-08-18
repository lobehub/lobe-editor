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
      clears.push(
        editor.registerDecoratorListener<JSX.Element>((nextDecorators) => {
          flushSync(() => {
            setDecorators(nextDecorators);
          });
        }),
      );
    };

    editor.on('initialized', handleInit);
    clears.push(() => {
      editor.off('initialized', handleInit);
    });
    return () => {
      clears.forEach((clear) => clear());
    };
  }, [editor]);

  // Return decorators defined as React Portals
  return useMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators);

    for (const nodeKey of decoratorKeys) {
      const reactDecorator = (
        <ErrorBoundary onError={(e) => editor.getLexicalEditor()?._onError(e)}>
          <Suspense fallback={null}>{decorators[nodeKey]}</Suspense>
        </ErrorBoundary>
      );
      const element = editor.getLexicalEditor()?.getElementByKey(nodeKey);

      if (element !== null && element !== undefined) {
        decoratedPortals.push(createPortal(reactDecorator, element, nodeKey));
      }
    }

    return decoratedPortals;
  }, [ErrorBoundary, decorators, editor]);
}
