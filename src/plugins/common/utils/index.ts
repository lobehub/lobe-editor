import { ElementTransformer } from "@/plugins/markdown/service/shortcut";
import { ElementNode } from "lexical";

export const createBlockNode = (
  createNode: (match: Array<string>) => ElementNode,
): ElementTransformer['replace'] => {
  return (parentNode, children, match, isImport) => {
    const node = createNode(match);
    node.append(...children);
    parentNode.replace(node);
    if (!isImport) {
      node.select(0, 0);
    }
  };
};
