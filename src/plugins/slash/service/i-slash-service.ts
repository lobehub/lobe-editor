/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import { genServiceId, type IEditorKernel, type IServiceID } from "@/editor-kernel";

export interface SlashOptions {
    // 触发符号
    items: Array<{
        // 实际的值
        icon?: string; 
        label: string; 
        // 显示的标签
        value: string; // 可选的图标
    }>; 
    trigger: string;
}

export interface ISlashService {
    registerSlash(options: SlashOptions): void;
}

export const ISlashService: IServiceID<ISlashService> = genServiceId<ISlashService>('SlashService');

export class SlashService implements ISlashService {

    private triggerMap: Map<string, SlashOptions> = new Map();

    constructor(private kernel: IEditorKernel) {
        console.log('SlashService initialized');
    }
    // 这里可以添加具体的服务方法

    registerSlash(options: SlashOptions): void {
        if (this.triggerMap.has(options.trigger)) {
            throw new Error(`Slash trigger "${options.trigger}" is already registered.`);
        }
        this.triggerMap.set(options.trigger, options);
    }

    getSlashOptions(trigger: string): SlashOptions | undefined {
        return this.triggerMap.get(trigger);
    }
}
