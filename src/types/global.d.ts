import type { LobeCustomStylish, LobeCustomToken } from '@lobehub/ui';
import 'antd-style';
import 'lexical/LexicalEditor';
import type { Data, Literal } from 'mdast';

/**
 * Info associated with mdast superscript (flow) nodes by the ecosystem.
 */
export type SuperscriptData = Data;

/**
 * Superscript (flow).
 */
export interface Superscript extends Literal {
  /**
   * Data associated with the mdast superscript (flow).
   */
  data?: SuperscriptData | undefined;

  /**
   * Custom information relating to the node.
   */
  meta?: string | null | undefined;

  /**
   * Node type of superscript (flow).
   */
  type: 'superscript';
}

/**
 * Subscript (flow).
 */
export interface Subscript extends Literal {
  /**
   * Data associated with the mdast superscript (flow).
   */
  data?: SuperscriptData | undefined;

  /**
   * Custom information relating to the node.
   */
  meta?: string | null | undefined;

  /**
   * Node type of subscript (flow).
   */
  type: 'subscript';
}

declare module 'antd-style' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface CustomToken extends LobeCustomToken {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface CustomStylish extends LobeCustomStylish {}
}

declare module '*.png' {
  const content: any;
  export default content;
}

declare module '*.svg' {
  const content: any;
  export default content;
}

declare namespace globalThis {
  let __DEV__: boolean | undefined;
}

// Add nodes to tree.
declare module 'mdast' {
  interface BlockContentMap {
    subscript: Subscript;
    superscript: Superscript;
  }

  interface PhrasingContentMap {
    subscript: Subscript;
    superscript: Superscript;
  }

  interface RootContentMap {
    subscript: Subscript;
    superscript: Superscript;
  }
}
