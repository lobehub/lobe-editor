import { TextModeType } from 'lexical';

import { INode } from './i-node';

/**
 * 文本节点
 */
export interface ITextNode extends INode {
  detail: number;
  mode: TextModeType;
  style: string;
  text: string;
  type: 'text';
}
