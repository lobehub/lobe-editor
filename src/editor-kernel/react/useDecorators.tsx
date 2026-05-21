import type { LexicalEditor, NodeKey } from 'lexical';
import {
  type ComponentClass,
  type FC,
  type JSX,
  type ReactNode,
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
  onError: (error: unknown) => void;
};

export type ErrorBoundaryType = ComponentClass<ErrorBoundaryProps> | FC<ErrorBoundaryProps>;

type PortalDecorator = {
  queryDOM: (_element: HTMLElement) => HTMLElement;
  render: ReactNode;
};

type MultiPortalDecorator = {
  multi: PortalDecorator[];
};

type DecoratorValue = JSX.Element | PortalDecorator | MultiPortalDecorator;

export function useDecorators(
  editor: IEditor,
  ErrorBoundary: ErrorBoundaryType,
): Array<JSX.Element> {
  const [decorators, setDecorators] = useState<Record<NodeKey, DecoratorValue>>(
    () => editor.getLexicalEditor()?.getDecorators<JSX.Element>() || {},
  );

  // Subscribe to changes
  useLayoutEffectImpl(() => {
    let clears: Array<() => void> = [];
    const handleInit = (editor: LexicalEditor) => {
      // Get initial decorators
      const initialDecorators = editor.getDecorators<JSX.Element>();
      setDecorators(initialDecorators);

      clears.push(
        editor.registerDecoratorListener<JSX.Element>((nextDecorators) => {
          flushSync(() => {
            setDecorators(nextDecorators);
          });
        }),
      );
    };

    // Check if editor is already initialized
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      handleInit(lexicalEditor);
    } else {
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
    const decoratedPortals: JSX.Element[] = [];
    const decoratorKeys = Object.keys(decorators);

    for (const nodeKey of decoratorKeys) {
      const decorator = decorators[nodeKey];
      const element = editor.getLexicalEditor()?.getElementByKey(nodeKey);

      if (element !== null && element !== undefined) {
        const portalDecorators =
          'multi' in decorator
            ? decorator.multi
            : [
                'queryDOM' in decorator
                  ? decorator
                  : {
                      queryDOM: () => element,
                      render: decorator,
                    },
              ];

        portalDecorators.forEach((portalDecorator, index) => {
          const targetElement = portalDecorator.queryDOM(element);
          if (!(targetElement instanceof HTMLElement)) {
            return;
          }

          decoratedPortals.push(
            createPortal(
              <ErrorBoundary onError={(e) => editor.getLexicalEditor()?._onError(e as Error)}>
                <Suspense fallback={null}>{portalDecorator.render}</Suspense>
              </ErrorBoundary>,
              targetElement,
              `${nodeKey}:${index}`,
            ),
          );
        });
      }
    }

    return decoratedPortals;
  }, [ErrorBoundary, decorators, editor]);
}
