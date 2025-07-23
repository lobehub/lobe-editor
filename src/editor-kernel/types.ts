import type { LexicalEditor, LexicalNodeConfig } from "lexical";
import type DataSource from "./data-source";

/**
 * 服务 ID 类型
 */
export type IServiceID<Service> = {
    readonly __serviceId: string;
    __serviceType?: Service;
};


/**
 * 对外提供的 api
 */
export interface IEditor {
    destroy(): void;
    getDocument(type: string): DataSource | undefined;
    registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;
    registerPlugins(plugins: Array<IPlugin>): IEditor;
    requireService<T>(serviceId: IServiceID<T>): T | null;
    setDocument(type: string, content: any): void;
    setRootElement(dom: HTMLElement): void;
}

/**
 * 提供给插件的 api
 */
export interface IEditorKernel extends IEditor {
    registerDataSource(dataSource: DataSource): void;
    registerNodes(nodes: Array<LexicalNodeConfig>): void;
    registerService<T>(serviceId: IServiceID<T>, service: T): void;
    registerThemes(themes: Record<string, any>): void;
}

/**
 * 插件接口
 */
export interface IEditorPlugin<IConfig> {
    config?: IConfig;
    onDestroy?(): void;
    onRegister?(editor: LexicalEditor): Array<() => void>;
}

export interface IEditorPluginConstructor<IConfig> {
    readonly pluginName: string; // 插件名称，必须唯一
    new(kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}

export type IPlugin<T = any> = IEditorPluginConstructor<T> | [IEditorPluginConstructor<T>, T?];