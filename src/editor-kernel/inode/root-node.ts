import { IElementNode } from './i-element-node';

/**
 * 根节点
 */
export interface IRootNode extends IElementNode {
  type: 'root';
}
