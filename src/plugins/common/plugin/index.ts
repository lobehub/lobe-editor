import { LexicalEditor } from "lexical/LexicalEditor";
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { selectionAlwaysOnDisplay } from '@lexical/utils';
import { IEditorKernel, IEditorPlugin } from "@/editor-kernel";
import JSONDataSource from "../data-source/json-data-source";
import { IEditorPluginConstructor } from "@/editor-kernel/types";
import { KernelPlugin } from "@/editor-kernel/plugin";

import './index.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CommonPluginOptions { }

export const CommonPlugin: IEditorPluginConstructor<CommonPluginOptions> =
    class extends KernelPlugin implements IEditorPlugin<CommonPluginOptions> {
        static pluginName = "CommonPlugin";

        constructor(protected kernel: IEditorKernel) {
            super();
            // Register the JSON data source
            kernel.registerDataSource(new JSONDataSource("json"));
            // Register common nodes and themes
            kernel.registerNodes([HeadingNode, QuoteNode]);
            kernel.registerThemes({
                text: {
                    bold: 'editor_textBold',
                    capitalize: 'editor_textCapitalize',
                    code: 'editor_textCode',
                    highlight: 'editor_textHighlight',
                    italic: 'editor_textItalic',
                    lowercase: 'editor_textLowercase',
                    strikethrough: 'editor_textStrikethrough',
                    subscript: 'editor_textSubscript',
                    superscript: 'editor_textSuperscript',
                    underline: 'editor_textUnderline',
                    underlineStrikethrough: 'editor_textUnderlineStrikethrough',
                    uppercase: 'editor_textUppercase',
                },
            });

        }

        onInit(editor: LexicalEditor): void {
            this.registerClears(
                registerRichText(editor),
                registerDragonSupport(editor),
                registerHistory(editor, createEmptyHistoryState(), 300),
                selectionAlwaysOnDisplay(editor),
            )
        }

        destroy(): void {
            // Cleanup logic
            super.destroy();
        }
    };