import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { mergeRegister } from '@lexical/utils';
import {
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical';
import type { FC, ReactElement } from 'react';
import { Children, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { ITriggerContext, SlashPlugin } from '../plugin/index';
import { ISlashOption, SlashOptions } from '../service/i-slash-service';
import { $splitNodeContainingQuery } from '../utils/utils';
import { DefaultMenuRender } from './DefaultMenuRender';

export interface ReactSlashOptionProps {
  /**
   * 是否禁用浮动
   */
  disableFloating?: boolean;
  /**
   * 可以搜索的选项
   */
  items?: SlashOptions['items'];
  /**
   * 搜索的最大长度
   * 默认为 75
   */
  maxLength?: number;
  /**
   * 自定义渲染组件
   */
  renderComp?: FC<MenuRenderProps>;
  /**
   * 触发字符
   */
  trigger?: SlashOptions['trigger'];
}

export const ReactSlashOption: FC<ReactSlashOptionProps> = () => {
  return null;
};

export interface MenuRenderProps {
  /**
   * 当前高亮的元素
   */
  highlightedIndex: number | null;
  /**
   * 加载状态
   */
  loading?: boolean;
  /**
   * 当前搜索到的选项
   */
  options: Array<ISlashOption>;
  /**
   * 主动触发选中
   * @param option 当前选中元素
   */
  selectOptionAndCleanUp: (option: ISlashOption) => void;
  /**
   * 主动设置当前高亮元素
   * @param index
   * @returns
   */
  setHighlightedIndex: (index: number | null) => void;
}

export interface ReactSlashPluginProps {
  MenuComp?: FC<MenuRenderProps>;
  anchorClassName?: string;
  children?:
    | (ReactElement<ReactSlashOptionProps> | undefined)
    | (ReactElement<ReactSlashOptionProps> | undefined)[];
}

export const ReactSlashPlugin = ({
  MenuComp = DefaultMenuRender,
  children,
}: ReactSlashPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [resolution, setResolution] = useState<ITriggerContext | null>(null);
  const [options, setOptions] = useState<Array<ISlashOption>>([]);
  const triggerMapRef = useRef<Map<string, ReactSlashOptionProps>>(new Map());

  const { refs, floatingStyles, context } = useFloating<HTMLElement>({
    middleware: [
      offset(5),
      flip({ padding: 10 }),
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
            minWidth: `${rects.reference.width}px`,
          });
        },
        padding: 10,
      }),
    ],
    onOpenChange: setIsOpen,
    open: isOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
  });

  const close = useCallback(() => {
    setIsOpen(false);
    setOptions([]);
    setResolution(null);
    context.onOpenChange(false);
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
        setResolution(null);
        context.onOpenChange(false);
      },
      triggerOpen: (ctx) => {
        setResolution(ctx);
        if (Array.isArray(ctx.items)) {
          setOptions(ctx.items);
        } else {
          setLoading(true);
          ctx
            .items(ctx.match || null)
            .then(setOptions)
            .finally(() => setLoading(false));
        }
        setHighlightedIndex(0);
        refs.setPositionReference({
          getBoundingClientRect: () => {
            return ctx.getRect();
          },
        });
        context.onOpenChange(true);
      },
    });
  }, [editor]);

  const selectOptionAndCleanUp = useCallback(
    (option: ISlashOption) => {
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

      close();
    },
    [context, resolution, close],
  );

  useLexicalEditor(
    (editor) => {
      return mergeRegister(
        editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_DOWN_COMMAND,
          (payload) => {
            const event = payload;
            if (options !== null && options.length) {
              const newSelectedIndex =
                highlightedIndex === null
                  ? 0
                  : highlightedIndex !== options.length - 1
                    ? highlightedIndex + 1
                    : 0;
              setHighlightedIndex(newSelectedIndex);
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
            if (options !== null && options.length) {
              const newSelectedIndex =
                highlightedIndex === null
                  ? options.length - 1
                  : highlightedIndex !== 0
                    ? highlightedIndex - 1
                    : options.length - 1;
              setHighlightedIndex(newSelectedIndex);
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
            if (options === null || highlightedIndex === null || !options[highlightedIndex]) {
              return false;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            selectOptionAndCleanUp(options[highlightedIndex]);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          KEY_ENTER_COMMAND,
          (event: KeyboardEvent | null) => {
            if (options === null || highlightedIndex === null || !options[highlightedIndex]) {
              return false;
            }

            if (event !== null) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            selectOptionAndCleanUp(options[highlightedIndex]);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    },
    [options, highlightedIndex, setHighlightedIndex],
  );

  const role = useRole(context);

  const { getFloatingProps } = useInteractions([role]);

  const { renderComp: CustomRender, disableFloating } =
    triggerMapRef.current.get(resolution?.trigger || '') || {};

  /**
   * Render the custom component if it exists and floating is disabled
   */
  if (isOpen && CustomRender && disableFloating) {
    return (
      <CustomRender
        highlightedIndex={highlightedIndex}
        loading={loading}
        options={options}
        selectOptionAndCleanUp={selectOptionAndCleanUp}
        setHighlightedIndex={setHighlightedIndex}
      />
    );
  }

  return (
    isOpen && (
      <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
        {CustomRender ? (
          <CustomRender
            highlightedIndex={highlightedIndex}
            loading={loading}
            options={options}
            selectOptionAndCleanUp={selectOptionAndCleanUp}
            setHighlightedIndex={setHighlightedIndex}
          />
        ) : (
          <MenuComp
            highlightedIndex={highlightedIndex}
            loading={loading}
            options={options}
            selectOptionAndCleanUp={selectOptionAndCleanUp}
            setHighlightedIndex={setHighlightedIndex}
          />
        )}
      </div>
    )
  );
};
