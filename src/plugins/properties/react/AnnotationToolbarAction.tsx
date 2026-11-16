import type { FC, MouseEvent } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import { OPEN_ANNOTATION_COMPOSER_COMMAND } from '../command';
import type { AnnotationToolbarActionProps } from './type';

/** A small toolbar item intended to be embedded in the existing ReactToolbarPlugin children. */
export const AnnotationToolbarAction: FC<AnnotationToolbarActionProps> = ({
  children = 'Comment',
  className,
  disabled,
  kind = 'comment',
  payload = null,
}) => {
  const [editor] = useLexicalComposerContext();

  const onMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    // Preserve the native selection while the floating toolbar button is pressed.
    event.preventDefault();
  };

  const onClick = () => {
    if (disabled || !editor.isEditable()) return;
    editor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, { kind, payload });
  };

  return (
    <button
      className={className}
      disabled={disabled}
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </button>
  );
};

AnnotationToolbarAction.displayName = 'AnnotationToolbarAction';
