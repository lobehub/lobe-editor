import { useLexicalComposerContext } from "@/editor-kernel/react/react-context";
import { SlashOptions, SlashPlugin } from "@/plugins/slash";
import React, { useCallback, useLayoutEffect, useState } from "react";
import { LexicalMenu, MenuOption, MenuRenderFn, MenuResolution, useMenuAnchorRef } from "./ReactMenu";
import { COMMAND_PRIORITY_LOW } from "lexical";
import ReactDOM from "react-dom";

export interface ReactSlashOptionProps {
    items: SlashOptions['items'];
    trigger: SlashOptions['trigger'];
}

export class MyMenuOption extends MenuOption {
    constructor(
        public label: string,
        public value: string,
        public icon?: string,
    ) {
        super(value);
    }
}

export const ReactSlashOption: React.FC<ReactSlashOptionProps> = () => {
    return null;
};

export interface ReactSlashPluginProps {
    anchorClassName?: string;
    children?: React.ReactElement<ReactSlashOptionProps> | React.ReactElement<ReactSlashOptionProps>[];
    menuRenderFn: MenuRenderFn<MyMenuOption>;
}

export const ReactSlashPlugin = (props: ReactSlashPluginProps) => {
    const [editor] = useLexicalComposerContext();
    const [resolution, setResolution] = useState<MenuResolution | null>(null);
    const [options, setOptions] = useState<Array<MyMenuOption>>([]);
    const anchorElementRef = useMenuAnchorRef(
        resolution,
        setResolution,
        props.anchorClassName,
    );

    useLayoutEffect(() => {
        console.info('ReactSlashPlugin: Initializing Slash Plugin');
        const options = React.Children.map(props.children, (child) => {
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
                setOptions(ctx.items.map(item => {
                    return new MyMenuOption(item.label, item.value, item.icon);
                }));
            }
        });
    }, [editor]);

    const closeTypeahead = useCallback(() => {
        setResolution(null);
    }, [resolution]);

    return (resolution === null ||
        editor === null ||
        anchorElementRef.current === null ? null : (
        <LexicalMenu
            anchorElementRef={anchorElementRef}
            close={closeTypeahead}
            commandPriority={COMMAND_PRIORITY_LOW}
            editor={editor.getLexicalEditor()!}
            menuRenderFn={props.menuRenderFn ?? ReactSlashPlugin.defaultProps.menuRenderFn}
            onSelectOption={(option) => {
                console.log('Selected option:', option);
            }}
            options={options}
            resolution={resolution}
            shouldSplitNodeWithQuery={true}
        />)
    );
}

ReactSlashPlugin.defaultProps = {
    menuRenderFn: ((
        anchorElementRef,
        { selectOptionAndCleanUp, setHighlightedIndex, options },
    ) =>
        anchorElementRef.current && options.length
            ? ReactDOM.createPortal(
                <div className="typeahead-popover component-picker-menu">
                    <ul>
                        {options.map((option, i: number) => (
                            <div
                                key={option.key}
                                onClick={() => {
                                    setHighlightedIndex(i);
                                    selectOptionAndCleanUp(option);
                                }}
                                onMouseEnter={() => {
                                    setHighlightedIndex(i);
                                }}
                            >{option.label}
                            </div>
                        ))}
                    </ul>
                </div>,
                anchorElementRef.current,
            )
            : null) as MenuRenderFn<MyMenuOption>,
}