import { INode } from './i-node';

export interface IElementNode extends INode {
  children: INode[];
  type: string;
}
