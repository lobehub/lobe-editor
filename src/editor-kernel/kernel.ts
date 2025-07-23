import EventEmitter from "eventemitter3";
import { mergeRegister } from '@lexical/utils';
import { IEditor, IEditorKernel, IEditorPlugin, IEditorPluginConstructor, IPlugin, IServiceID } from "./types";
import DataSource from "./data-source";
import { createEditor, LexicalEditor, LexicalNodeConfig } from "lexical";
import { createEmptyEditorState, noop } from "./utils";
import merge from "lodash/merge";

export class Kernel extends EventEmitter implements IEditorKernel {
    private dataTypeMap: Map<string, DataSource>;
    private plugins: Array<IEditorPluginConstructor<any> & { __config: any }> = [];
    private pluginsInstances: Array<IEditorPlugin<any>> = [];
    private nodes: Array<LexicalNodeConfig> = [];
    private themes: Record<string, any> = {}; // 用于存储主题配置
    private serviceMap: Map<string, any> = new Map();

    public editor?: LexicalEditor;

    constructor() {
        super();
        this.dataTypeMap = new Map<string, DataSource>();
    }

    destroy() {
        this.editor?.setEditorState(createEmptyEditorState());
        this.dataTypeMap.clear();
        this.pluginsInstances.forEach(plugin => {
            if (plugin.onDestroy) {
                plugin.onDestroy();
            }
        });
        this.pluginsInstances = [];
    }

    setRootElement(dom: HTMLElement) {
        for (const plugin of this.plugins) {
            const instance = new plugin(this, plugin.__config);
            this.pluginsInstances.push(instance);
        }
        const editor = this.editor = createEditor({
            nodes: this.nodes,
            onError: (error: Error) => {
                this.emit('error', error);
            },
            theme: this.themes,
        });
        this.editor.setRootElement(dom);

        /**
         * Merge plugin registration
         */
        mergeRegister(...this.pluginsInstances.flatMap(plugin => {
            return plugin.onRegister?.(editor) || noop;
        }));
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

    registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor {
        const instance = plugin;
        if (this.plugins.some(p => p.pluginName === instance.pluginName)) {
            throw new Error(`Plugin with pluginName "${instance.pluginName}" is already registered.`);
        }
        // @ts-expect-error not error
        instance.__config = config || {};
        // @ts-expect-error not error
        this.plugins.push(instance);
        return this;
    }

    registerPlugins(plugins: Array<IPlugin>): IEditor {
        for (const plugin of plugins) {
            if (Array.isArray(plugin)) {
                this.registerPlugin(plugin[0], plugin[1]);
            } else {
                this.registerPlugin(plugin);
            }
        }
        return this;
    }

    registerNodes(nodes: Array<LexicalNodeConfig>) {
        this.nodes.push(...nodes);
    }

    registerService<T>(serviceId: IServiceID<T>, service: T): void {
        if (this.serviceMap.has(serviceId.__serviceId)) {
            throw new Error(`Service with ID "${serviceId.__serviceId}" is already registered.`);
        }
        this.serviceMap.set(serviceId.__serviceId, service);
    }

    /**
     * 获取服务
     * @param serviceId 服务ID
     */
    requireService<T>(serviceId: IServiceID<T>): T | null {
        const service = this.serviceMap.get(serviceId.__serviceId);
        if (!service) {
            return null;
        }
        return service as T;
    }
}
