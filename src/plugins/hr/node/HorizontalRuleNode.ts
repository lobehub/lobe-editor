/* eslint-disable @typescript-eslint/no-use-before-define */
import { 
    $applyNodeReplacement, 
    DecoratorNode, 
    DOMConversionMap, 
    DOMConversionOutput, 
    DOMExportOutput, 
    EditorConfig, 
    IConfig, 
    LexicalEditor, 
    SerializedLexicalNode 
} from "lexical";
import {
  addClassNamesToElement,
} from '@lexical/utils';

export type SerializedHorizontalRuleNode = SerializedLexicalNode;

export class HorizontalRuleNode extends DecoratorNode<any> {
  static getType(): string {
    return 'horizontalrule';
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedHorizontalRuleNode,
  ): HorizontalRuleNode {
    return $createHorizontalRuleNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: $convertHorizontalRuleElement,
        priority: 0,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    return {element: document.createElement('hr')};
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('hr');
    addClassNamesToElement(element, config.theme.hr);
    return element;
  }

  getTextContent(): string {
    return '\n';
  }

  isInline(): false {
    return false;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor, config: EditorConfig): any {
    return (config as IConfig).decorators?.horizontalrule?.(this, editor) || null;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new HorizontalRuleNode());
}

function $convertHorizontalRuleElement(): DOMConversionOutput {
  return {node: $createHorizontalRuleNode()};
}
