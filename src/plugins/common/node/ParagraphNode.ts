import { EditorConfig, ElementDOMSlot, ParagraphNode } from "lexical";
import { MElementDOMSlot } from "./ElementDOMSlot";

export class MParagraphNode extends ParagraphNode {
    static getType(): string {
        return 'paragraph';
    }

    static clone(node: ParagraphNode): ParagraphNode {
        return new MParagraphNode(node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
        console.info('Creating ParagraphNode DOM element');
        return super.createDOM(config);
    }

    getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
        return new MElementDOMSlot(element);
    }
}
