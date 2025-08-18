'use client';

import { mergeRegister } from '@lexical/utils';
import { Dropdown, type MenuProps } from '@lobehub/ui';
import {
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical';
import { Children, FC, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { ITriggerContext, SlashPlugin } from '../plugin/index';
import { ISlashMenuOption, ISlashOption, SlashOptions } from '../service/i-slash-service';
import { $splitNodeContainingQuery } from '../utils/utils';
import type { ReactSlashOptionProps, ReactSlashPluginProps } from './type';
import { setCancelablePromise } from './utils';

const ReactSlashPlugin: FC<ReactSlashPluginProps> = ({ children, anchorClassName }) => {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ITriggerContext | null>(null);
  const [options, setOptions] = useState<Array<ISlashOption>>([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const cancelRef = useRef<{
    cancel: () => void;
  }>({
    cancel: () => {},
  });
  const triggerMapRef = useRef<Map<string, ReactSlashOptionProps>>(new Map());

  const close = useCallback(() => {
    setIsOpen(false);
    setOptions([]);
    setResolution(null);
    setActiveKey(null);
  }, []);

  useLayoutEffect(() => {
    const options =
      Children.map(children, (child) => {
        if (!child) return null;
        const option = child.props as SlashOptions;
        triggerMapRef.current.set(option.trigger, option);
        return option;
      })?.filter(Boolean) || [];

    editor.registerPlugin(SlashPlugin, {
      slashOptions: options,
      triggerClose: () => {
        close();
        cancelRef.current.cancel();
      },
      triggerOpen: (ctx: ITriggerContext) => {
        setResolution(ctx);
        cancelRef.current.cancel();
        if (Array.isArray(ctx.items)) {
          setOptions(ctx.items);
          if (!activeKey) {
            // @ts-ignore
            setActiveKey(ctx.items?.[0]?.key);
          }
        } else {
          setLoading(true);
          const pr = setCancelablePromise((resolve, reject) => {
            ctx
              // @ts-ignore
              .items(ctx.match || null)
              .then(resolve, reject)
              .finally(() => setLoading(false));
          });
          pr.promise.then((items) => {
            const typedItems = items as ISlashOption[];
            setOptions(typedItems);
            if (!activeKey) {
              // @ts-ignore
              setActiveKey(typedItems?.[0]?.key);
            }
          });
          cancelRef.current.cancel = () => {
            pr.cancel();
            setLoading(false);
          };
        }
        const rect = ctx.getRect();
        setDropdownPosition({ x: rect.left, y: rect.bottom });
        setIsOpen(true);
      },
    });
  }, [activeKey, editor, close]);

  const onSelect = useCallback(
    (option: ISlashOption) => {
      // Don't process divider items
      if ('type' in option && option.type === 'divider') {
        return;
      }

      const lexicalEditor = editor.getLexicalEditor();
      if (lexicalEditor && resolution) {
        lexicalEditor.update(() => {
          const textNodeContainingQuery = resolution.match
            ? $splitNodeContainingQuery(resolution.match)
            : null;

          textNodeContainingQuery?.remove();
          option.onSelect?.(editor, resolution.match ? resolution.match.matchingString : '');
        });
      }

      const currentTriggerProps = triggerMapRef.current.get(resolution?.trigger || '');

      // Call the external unified onSelect first if it exists
      if (currentTriggerProps?.onSelect) {
        currentTriggerProps.onSelect(editor, option as ISlashMenuOption);
      }

      close();
    },
    [editor, resolution, close],
  );

  useLexicalEditor(
    (editor) => {
      const pureOptions = options.filter(
        (item): item is ISlashMenuOption =>
          !('type' in item && item.type === 'divider') && 'key' in item && Boolean(item.key),
      );
      return mergeRegister(
        editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_DOWN_COMMAND,
          (payload) => {
            const event = payload;
            if (pureOptions !== null && pureOptions.length) {
              const currentIndex = activeKey
                ? pureOptions.findIndex((opt) => opt.key === activeKey)
                : -1;
              const newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % pureOptions.length;
              setActiveKey(String(pureOptions[newIndex].key));
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_UP_COMMAND,
          (payload) => {
            const event = payload;
            if (pureOptions !== null && pureOptions.length) {
              const currentIndex = activeKey
                ? pureOptions.findIndex((opt) => opt.key === activeKey)
                : -1;
              const newIndex =
                currentIndex === -1
                  ? pureOptions.length - 1
                  : (currentIndex - 1 + pureOptions.length) % pureOptions.length;
              setActiveKey(String(pureOptions[newIndex].key));
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_ESCAPE_COMMAND,
          (payload) => {
            const event = payload;
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_TAB_COMMAND,
          (payload) => {
            const event = payload;
            if (options === null || activeKey === null) {
              return false;
            }
            const selectedOption = options.find(
              (opt): opt is ISlashMenuOption => 'key' in opt && opt.key === activeKey,
            );
            if (!selectedOption) {
              return false;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            onSelect(selectedOption);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          KEY_ENTER_COMMAND,
          (event: KeyboardEvent | null) => {
            if (options === null || activeKey === null) {
              return false;
            }
            const selectedOption = options.find(
              (opt): opt is ISlashMenuOption => 'key' in opt && opt.key === activeKey,
            );
            if (!selectedOption) {
              return false;
            }

            if (event !== null) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            onSelect(selectedOption);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    },
    [options, activeKey, setActiveKey],
  );

  const { renderComp: CustomRender } = triggerMapRef.current.get(resolution?.trigger || '') || {};

  // Adapter for custom render component onSelect
  const customRenderOnSelect = useCallback(
    (option: ISlashMenuOption) => {
      onSelect(option);
    },
    [onSelect],
  );

  const handleMenuClick: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      const option = options.find(
        (item): item is ISlashMenuOption => 'key' in item && item.key === key,
      );
      if (option) onSelect(option);
    },
    [options, onSelect],
  );

  /**
   * Render the custom component if it exists
   */
  if (CustomRender) {
    return (
      <CustomRender
        activeKey={activeKey}
        loading={loading}
        onSelect={customRenderOnSelect}
        open={isOpen}
        options={options}
        setActiveKey={setActiveKey}
      />
    );
  }

  return (
    <div
      style={{
        left: dropdownPosition.x,
        position: 'fixed',
        top: dropdownPosition.y,
        zIndex: 1050,
      }}
    >
      <Dropdown
        menu={{
          // @ts-ignore
          activeKey: activeKey,
          items: loading
            ? [
                {
                  disabled: true,
                  key: 'loading',
                  label: 'Loading...',
                },
              ]
            : options,
          onClick: handleMenuClick,
        }}
        open={isOpen}
      >
        <span className={anchorClassName} />
      </Dropdown>
    </div>
  );
};

ReactSlashPlugin.displayName = 'ReactSlashPlugin';

export default ReactSlashPlugin;
