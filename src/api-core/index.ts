import { createEditor, LexicalEditor, LexicalNodeConfig, EditorState } from "lexical";
import { EventEmitter } from "eventemitter3";
import { mergeRegister } from '@lexical/utils';
import merge from 'lodash/merge';
import DataSource from "./data-source";

const noop = () => { };

/**
 * 对外提供的 api
 */
export interface IEditor {
    setRootElement(dom: HTMLElement): void;
    setDocument(type: string, content: any): void;
    getDocument(type: string): DataSource | undefined;
    registerPlugin(plugin: new (core: ApiCore) => IEditorPlugin): IEditor;
    registerPlugins(...plugins: Array<new (core: ApiCore) => IEditorPlugin>): IEditor;
    destroy(): void;
}

/**
 * 提供给插件的 api
 */
export interface IEditorCore extends IEditor {
    registerDataSource(dataSource: DataSource): void;
    registerNodes(nodes: Array<LexicalNodeConfig>): void;
    registerThemes(themes: Record<string, any>): void;
}

/**
 * 插件接口
 */
export interface IEditorPlugin {
    name: string; // 插件名称，必须唯一
    onInit?(apiCore: IEditorCore): void;
    onRegister?(editor: LexicalEditor): Array<() => void>;
    onDestroy?(): void;
}

function createEmptyEditorState() {
    return new EditorState(new Map(), null);
}

export class ApiCore extends EventEmitter {
    private dataTypeMap: Map<string, DataSource>;
    private plugins: IEditorPlugin[];
    private nodes: Array<LexicalNodeConfig> = [];
    private themes: Record<string, any> = {}; // 用于存储主题配置

    public editor?: LexicalEditor;

    constructor() {
        super();
        this.dataTypeMap = new Map<string, DataSource>();
        this.plugins = [];
    }

    destroy() {
        this.editor?.setEditorState(createEmptyEditorState());
        this.dataTypeMap.clear();
        this.plugins.forEach(plugin => {
            if (plugin.onDestroy) {
                plugin.onDestroy();
            }
        });
        this.plugins = [];
    }

    setRootElement(dom: HTMLElement) {
        for (const plugin of this.plugins) {
            if (plugin.onInit) {
                plugin.onInit(this);
            }
        }
        const editor = this.editor = createEditor({
            nodes: this.nodes,
            theme: this.themes,
            onError: (error: Error) => {
                this.emit('error', error);
            },
        });
        this.editor.setRootElement(dom);

        /**
         * Merge plugin registration
         */
        mergeRegister(...this.plugins.map(plugin => {
            return plugin.onRegister?.(editor) || noop;
        }).flat());
    }

    setDocument(type: string, content: any) {
        const datasource = this.dataTypeMap.get(type);
        if (!datasource) {
            throw new Error(`DataSource for type "${type}" is not registered.`);
        }
        if (!this.editor) {
            throw new Error(`Editor is not initialized.`);
        }
        return datasource.read(this.editor, content);
    }

    getDocument(type: string): DataSource | undefined {
        const datasource = this.dataTypeMap.get(type);
        if (!datasource) {
            throw new Error(`DataSource for type "${type}" is not registered.`);
        }
        if (!this.editor) {
            throw new Error(`Editor is not initialized.`);
        }
        return datasource.write(this.editor);
    }

    /**
     * 支持注册目标数据源
     * @param dataSource 数据源
     */
    registerDataSource(dataSource: DataSource) {
        this.dataTypeMap.set(dataSource.type, dataSource);
    }

    registerThemes(themes: Record<string, any>) {
        this.themes = merge(this.themes, themes);
    }

    registerPlugin(plugin: new (core: ApiCore) => IEditorPlugin) {
        const instance = new plugin(this);
        if (this.plugins.some(p => p.name === instance.name)) {
            throw new Error(`Plugin with name "${instance.name}" is already registered.`);
        }
        this.plugins.push(instance);
        return this;
    }

    registerPlugins(...plugins: Array<new (core: ApiCore) => IEditorPlugin>) {
        plugins.forEach(plugin => {
            this.registerPlugin(plugin);
        });
        return this;
    }

    registerNodes(nodes: Array<LexicalNodeConfig>) {
        this.nodes.push(...nodes);
    }
}

/**
 * Editor class to create an instance of the editor
 */
export default class Editor {
    static createEditor(): IEditor {
        return new ApiCore();
    }
}
