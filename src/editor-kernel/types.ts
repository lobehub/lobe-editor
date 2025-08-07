import type { CommandPayloadType, DecoratorNode, LexicalCommand, LexicalEditor, LexicalNodeConfig } from "lexical";
import type DataSource from "./data-source";

/**
 * 服务 ID 类型
 */
export type IServiceID<Service> = {
    readonly __serviceId: string;
    __serviceType?: Service;
};

export interface IKernelEventMap {
    error: (error: Error) => void;
    initialized: (editor: LexicalEditor) => void;
}

/**
 * 对外提供的 api
 */
export interface IEditor {
    destroy(): void;
    dispatchCommand<TCommand extends LexicalCommand<unknown>>(
        type: TCommand,
        payload: CommandPayloadType<TCommand>,
    ): boolean,
    getDocument(type: string): DataSource | undefined;
    getLexicalEditor(): LexicalEditor | null;
    getRootElement(): HTMLElement | null;
    off<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
    on<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
    once<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
    registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;
    registerPlugins(plugins: Array<IPlugin>): IEditor;
    requireService<T>(serviceId: IServiceID<T>): T | null;
    setDocument(type: string, content: any): void;
    setRootElement(dom: HTMLElement): LexicalEditor;
}

/**
 * 提供给插件的 api
 */
export interface IEditorKernel extends IEditor {
    getDecorator(name: string): ((_node: DecoratorNode<any>, _editor: LexicalEditor) => any) | undefined;
    registerDataSource(dataSource: DataSource): void;
    registerDecorator(name: string, decorator: (_node: DecoratorNode<any>, _editor: LexicalEditor) => any): void;
    registerNodes(nodes: Array<LexicalNodeConfig>): void;
    registerService<T>(serviceId: IServiceID<T>, service: T): void;
    registerThemes(themes: Record<string, any>): void;
}

/**
 * 插件接口
 */
export interface IEditorPlugin<IConfig> {
    config?: IConfig;
    destroy(): void;
    onInit?(editor: LexicalEditor): void;
}

export interface IEditorPluginConstructor<IConfig> {
    readonly pluginName: string; // 插件名称，必须唯一
    new(kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}

export type IPlugin<T = any> = IEditorPluginConstructor<T> | [IEditorPluginConstructor<T>, T?];