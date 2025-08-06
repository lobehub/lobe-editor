import { COMMAND_PRIORITY_NORMAL } from 'lexical';
import type { FC, ReactElement } from 'react';
import { Children, useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { SlashPlugin } from '../plugin/index';
import { SlashOptions } from '../service/i-slash-service';
import {
  LexicalMenu,
  MenuOption,
  MenuRenderFn,
  MenuResolution,
  useMenuAnchorRef,
} from './ReactMenu';

import './index.less';

export interface ReactSlashOptionProps {
  items?: SlashOptions['items'];
  trigger?: SlashOptions['trigger'];
}

export class MyMenuOption extends MenuOption {
  constructor(
    public label: string,
    public value: string,
    public icon?: string,
    public onSelect?: SlashOptions['items'][0]['onSelect'],
  ) {
    super(value);
  }
}

export const ReactSlashOption: FC<ReactSlashOptionProps> = () => {
  return null;
};

export interface ReactSlashPluginProps {
  anchorClassName?: string;
  children?:
  | (ReactElement<ReactSlashOptionProps> | undefined)
  | (ReactElement<ReactSlashOptionProps> | undefined)[];
  menuRenderFn: MenuRenderFn<MyMenuOption>;
}

export const ReactSlashPlugin = (props: ReactSlashPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = useState<MenuResolution | null>(null);
  const [options, setOptions] = useState<Array<MyMenuOption>>([]);
  const anchorElementRef = useMenuAnchorRef(resolution, setResolution, props.anchorClassName);

  useLayoutEffect(() => {
    console.info('ReactSlashPlugin: Initializing Slash Plugin');
    const options =
      Children.map(props.children, (child) => {
        if (!child) return null;
        return child.props as SlashOptions;
      })?.filter(Boolean) || [];

    editor.registerPlugin(SlashPlugin, {
      slashOptions: options,
      triggerClose: () => {
        console.log('Slash menu closed');
        setResolution(null);
      },
      triggerOpen: (ctx) => {
        console.log('Slash menu opened', ctx);
        setResolution(ctx);
        setOptions(
          ctx.items.map((item) => {
            return new MyMenuOption(item.label, item.value, item.icon, item.onSelect);
          }),
        );
      },
    });
  }, [editor]);

  const closeTypeahead = useCallback(() => {
    setResolution(null);
  }, [resolution]);

  return resolution === null || editor === null || anchorElementRef.current === null ? null : (
    <LexicalMenu
      anchorElementRef={anchorElementRef}
      close={closeTypeahead}
      commandPriority={COMMAND_PRIORITY_NORMAL}
      editor={editor.getLexicalEditor()!}
      menuRenderFn={props.menuRenderFn ?? ReactSlashPlugin.defaultProps.menuRenderFn}
      onSelectOption={(option, nodeToRemove, closeMenu, matchingString) => {
        nodeToRemove?.remove();
        option.onSelect?.(editor, matchingString);
        closeMenu();
      }}
      options={options}
      resolution={resolution}
      shouldSplitNodeWithQuery={true}
    />
  );
};

ReactSlashPlugin.defaultProps = {
  menuRenderFn: ((anchorElementRef, { selectOptionAndCleanUp, setHighlightedIndex, options, selectedIndex }) =>
    anchorElementRef.current && options.length
      ? createPortal(
        <div className="typeahead-popover component-picker-menu">
          <ul>
            {options.map((option, i: number) => (
              <li
                className={selectedIndex === i ? 'selected' : ''}
                key={option.key}
                onClick={() => {
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(i);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>,
        anchorElementRef.current,
      )
      : null) as MenuRenderFn<MyMenuOption>,
};
