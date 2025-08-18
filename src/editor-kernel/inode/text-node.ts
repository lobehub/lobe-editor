import { TextModeType } from 'lexical';

import { INode } from './i-node';

/**
 * Text node
 */
export interface ITextNode extends INode {
  detail: number;
  mode: TextModeType;
  style: string;
  text: string;
  type: 'text';
}
