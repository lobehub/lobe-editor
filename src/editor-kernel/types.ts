import type {
  CommandPayloadType,
  DecoratorNode,
  LexicalCommand,
  LexicalEditor,
  LexicalNodeConfig,
} from 'lexical';

import type DataSource from './data-source';

/**
 * 服务 ID 类型
 */
export type IServiceID<Service> = {
  readonly __serviceId: string;
  __serviceType?: Service;
};

export interface IKernelEventMap {
  /**
   * 编辑器错误事件
   */
  error: (error: Error) => void;
  /**
   * 初始化事件
   * @param editor lexical 编辑器实例
   * @returns
   */
  initialized: (editor: LexicalEditor) => void;
}

/**
 * 对外提供的 api
 */
export interface IEditor {
  /**
   * 失去焦点
   */
  blur(): void;
  /**
   * 销毁编辑器实例
   */
  destroy(): void;
  /**
   * 执行编辑器的命令，对编辑器内容进行操作
   * @param type
   * @param payload
   */
  dispatchCommand<TCommand extends LexicalCommand<unknown>>(
    type: TCommand,
    payload: CommandPayloadType<TCommand>,
  ): boolean;
  /**
   * 聚焦编辑器
   */
  focus(): void;
  /**
   * 获取编辑器对应的 type 的内容
   */
  getDocument(type: string): DataSource | undefined;
  /**
   * 获取 Lexical 编辑器实例
   */
  getLexicalEditor(): LexicalEditor | null;
  /**
   * 获取文档编辑器根节点
   */
  getRootElement(): HTMLElement | null;
  /**
   * 取消编辑器事件监听
   * @param event
   * @param listener
   */
  off<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * 对编辑器进行事件监听
   * @param event
   * @param listener
   */
  on<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * 一次性监听事件，触发后自动移除监听
   * @param event
   * @param listener
   */
  once<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * 注册编辑器插件
   */
  registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;
  /**
   * 注册多个编辑器插件
   */
  registerPlugins(plugins: Array<IPlugin>): IEditor;
  /**
   * 获取编辑器的 Service，一般由插件提供，实现对某些功能的扩展
   * @param serviceId
   */
  requireService<T>(serviceId: IServiceID<T>): T | null;
  /**
   * 设置编辑器内容，type 为内容类型，content 为内容数据
   * @param type
   * @param content
   */
  setDocument(type: string, content: any): void;

  /**
   * 设置文档编辑器根节点
   * @param dom
   */
  setRootElement(dom: HTMLElement): LexicalEditor;
}

/**
 * 提供给插件的 api
 */
export interface IEditorKernel extends IEditor {
  /**
   * 获取编辑器的 Node 的装饰器，实现对 Node 的特定渲染
   * @param name
   */
  getDecorator(
    name: string,
  ): ((_node: DecoratorNode<any>, _editor: LexicalEditor) => any) | undefined;
  /**
   * 注册数据源，方便实现多装数据的转换
   * @param dataSource
   */
  registerDataSource(dataSource: DataSource): void;
  /**
   * 注册编辑器的节点装饰器
   * @param name
   * @param decorator
   */
  registerDecorator(
    name: string,
    decorator: (_node: DecoratorNode<any>, _editor: LexicalEditor) => any,
  ): void;
  /**
   * 注册 Lexical 的 Node
   * @param nodes
   */
  registerNodes(nodes: Array<LexicalNodeConfig>): void;
  /**
   * 注册服务
   * @param serviceId
   * @param service
   */
  registerService<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * 注册主题
   * @param themes
   */
  registerThemes(themes: Record<string, any>): void;
}

/**
 * 插件接口
 */
export interface IEditorPlugin<IConfig> {
  config?: IConfig;
  /**
   * 编辑器销毁
   */
  destroy(): void;
  /**
   * lexical 编辑器实例化后
   * @param editor lexical 编辑器实例
   */
  onInit?(editor: LexicalEditor): void;
}

/**
 * 插件类的接口
 */
export interface IEditorPluginConstructor<IConfig> {
  readonly pluginName: string; // 插件名称，必须唯一
  new (kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}

export type IPlugin<T = any> = IEditorPluginConstructor<T> | [IEditorPluginConstructor<T>, T?];
