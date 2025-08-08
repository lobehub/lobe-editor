import { IElementNode } from './i-element-node';

export interface IParagraphNode extends IElementNode {
  textFormat: number;
  textStyle: string;
  type: 'paragraph';
}
