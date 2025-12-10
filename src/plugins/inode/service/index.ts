import { genServiceId } from '@/editor-kernel';
import { IRootNode } from '@/editor-kernel/inode';

export interface INodeService {
  processNodeTree(inode: { root: IRootNode }): void;
  registerProcessNodeTree(process: (inode: { root: IRootNode }) => void): void;
}

/**
 * Service ID for Node service
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const INodeService = genServiceId<INodeService>('INodeService');

/**
 * Default implementation of INodeService
 */
export class NodeService implements INodeService {
  private processNodeTreeHandlers: Array<(inode: { root: IRootNode }) => void> = [];

  registerProcessNodeTree(process: (inode: { root: IRootNode }) => void): void {
    this.processNodeTreeHandlers.push(process);
  }

  processNodeTree(inode: { root: IRootNode }): void {
    for (const handler of this.processNodeTreeHandlers) {
      handler(inode);
    }
  }
}
