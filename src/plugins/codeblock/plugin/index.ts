import { KernelPlugin } from "@/editor-kernel/plugin";
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from "@/editor-kernel/types";
import { IMarkdownShortCutService } from "@/plugins/markdown";
import { CodeNode, CodeHighlightNode, $createCodeNode, registerCodeHighlighting } from "@lexical/code";
import { LexicalEditor } from "lexical";
import { getCodeLanguageByInput } from "../utils/language";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodeblockPluginOptions { 
    theme?: {
        code?: string;
        codeHighlight?: {
            atrule?: string;
            attr?: string;
            boolean?: string;
            builtin?: string;
            cdata?: string;
            char?: string;
            class?: string;
            'class-name'?: string;
            comment?: string;
            constant?: string;
            deleted?: string;
            doctype?: string;
            entity?: string;
            function?: string;
            important?: string;
            inserted?: string;
            keyword?: string;
            namespace?: string;
            number?: string;
            operator?: string;
            prolog?: string;
            property?: string;
            punctuation?: string;
            regex?: string;
            selector?: string;
            string?: string;
            symbol?: string;
            tag?: string;
            url?: string;
            variable?: string;
        };
    }
}

export const CodeblockPlugin: IEditorPluginConstructor<CodeblockPluginOptions> =
    class extends KernelPlugin implements IEditorPlugin<CodeblockPluginOptions> {
        static pluginName = "CodeblockPlugin";

        constructor(protected kernel: IEditorKernel, config: CodeblockPluginOptions = {}) {
            super();
            // Register the code block plugin
            kernel.registerNodes([CodeNode, CodeHighlightNode])
            kernel.registerThemes({
                code: config.theme?.code || 'editor-code',
                codeHighlight: {
                    atrule: config.theme?.codeHighlight?.atrule || 'editor-tokenAttr',
                    attr: config.theme?.codeHighlight?.attr || 'editor-tokenAttr',
                    boolean: config.theme?.codeHighlight?.boolean || 'editor-tokenProperty',
                    builtin: config.theme?.codeHighlight?.builtin || 'editor-tokenSelector',
                    cdata: config.theme?.codeHighlight?.cdata || 'editor-tokenComment',
                    char: config.theme?.codeHighlight?.char || 'editor-tokenSelector',
                    class: config.theme?.codeHighlight?.class || 'editor-tokenFunction',
                    'class-name': config.theme?.codeHighlight?.['class-name'] || 'editor-tokenFunction',
                    comment: config.theme?.codeHighlight?.comment || 'editor-tokenComment',
                    constant: config.theme?.codeHighlight?.constant || 'editor-tokenProperty',
                    deleted: config.theme?.codeHighlight?.deleted || 'editor-tokenProperty',
                    doctype: config.theme?.codeHighlight?.doctype || 'editor-tokenComment',
                    entity: config.theme?.codeHighlight?.entity || 'editor-tokenOperator',
                    function: config.theme?.codeHighlight?.function || 'editor-tokenFunction',
                    important: config.theme?.codeHighlight?.important || 'editor-tokenVariable',
                    inserted: config.theme?.codeHighlight?.inserted || 'editor-tokenSelector',
                    keyword: config.theme?.codeHighlight?.keyword || 'editor-tokenAttr',
                    namespace: config.theme?.codeHighlight?.namespace || 'editor-tokenVariable',
                    number: config.theme?.codeHighlight?.number || 'editor-tokenProperty',
                    operator: config.theme?.codeHighlight?.operator || 'editor-tokenOperator',
                    prolog: config.theme?.codeHighlight?.prolog || 'editor-tokenComment',
                    property: config.theme?.codeHighlight?.property || 'editor-tokenProperty',
                    punctuation: config.theme?.codeHighlight?.punctuation || 'editor-tokenPunctuation',
                    regex: config.theme?.codeHighlight?.regex || 'editor-tokenVariable',
                    selector: config.theme?.codeHighlight?.selector || 'editor-tokenSelector',
                    string: config.theme?.codeHighlight?.string || 'editor-tokenSelector',
                    symbol: config.theme?.codeHighlight?.symbol || 'editor-tokenProperty',
                    tag: config.theme?.codeHighlight?.tag || 'editor-tokenProperty',
                    url: config.theme?.codeHighlight?.url || 'editor-tokenOperator',
                    variable: config.theme?.codeHighlight?.variable || 'editor-tokenVariable',
                },
            });

            kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
                regExp: /^(```|···)(.+)?$/,
                replace: (parentNode, _, match) => {
                    const code = $createCodeNode(getCodeLanguageByInput(match[2]));

                    parentNode.replace(code);

                    code.selectStart();
                },
                trigger: 'enter',
                type: 'element',
            });
        }

        onInit(editor: LexicalEditor): void {
            this.register(registerCodeHighlighting(editor));
        }
    }
