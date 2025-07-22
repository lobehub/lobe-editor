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
    setRootElement(dom: HTMLElement): void;
    setDocument(type: string, content: any): void;
    getDocument(type: string): DataSource | undefined;
    registerPlugin(plugin: new (core: IEditorKernel) => IEditorPlugin): IEditor;
    registerPlugins(...plugins: Array<new (core: IEditorKernel) => IEditorPlugin>): IEditor;
    destroy(): void;
}

/**
 * 提供给插件的 api
 */
export interface IEditorKernel extends IEditor {
    registerDataSource(dataSource: DataSource): void;
    registerNodes(nodes: Array<LexicalNodeConfig>): void;
    registerThemes(themes: Record<string, any>): void;
    registerService<T>(serviceId: IServiceID<T>, service: T): void;
    requireService<T>(serviceId: IServiceID<T>): T | null;
}

/**
 * 插件接口
 */
export interface IEditorPlugin {
    name: string; // 插件名称，必须唯一
    onInit?(kernel: IEditorKernel): void;
    onRegister?(editor: LexicalEditor): Array<() => void>;
    onDestroy?(): void;
}
