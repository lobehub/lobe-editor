import EventEmitter from 'eventemitter3';

import type { IEditorKernel } from '@/types/kernel';

export abstract class KernelPlugin extends EventEmitter {
  protected clears: Array<() => void> = [];
  protected registeredDecorators: Set<string> = new Set();

  protected register(clear: () => void): void {
    this.clears.push(clear);
  }

  protected registerClears(...clears: Array<() => void>): void {
    clears.forEach((clear) => this.register(clear));
  }

  /**
   * Register a decorator and track it for cleanup
   */
  protected registerDecorator(
    kernel: IEditorKernel,
    name: string,
    decorator: (node: any, editor: any) => any,
  ): void {
    kernel.registerDecorator(name, decorator);
    this.registeredDecorators.add(name);
  }

  /**
   * Unregister a specific decorator
   */
  protected unregisterDecorator(kernel: IEditorKernel, name: string): boolean {
    const result = kernel.unregisterDecorator(name);
    if (result) {
      this.registeredDecorators.delete(name);
    }
    return result;
  }

  /**
   * Get all decorator names registered by this plugin
   */
  public getRegisteredDecorators(): string[] {
    return Array.from(this.registeredDecorators);
  }

  public destroy(): void {
    this.clears.forEach((clear) => clear());
    // Note: Decorators will be cleaned up when kernel.destroy() is called
    // Individual decorator cleanup should be handled by the kernel itself
    this.registeredDecorators.clear();
  }
}
