import { ElementDOMSlot } from 'lexical';
import { LexicalPrivateDOM } from 'lexical/LexicalNode';

export class MElementDOMSlot extends ElementDOMSlot {
  override setManagedLineBreak(lineBreakType: null | 'empty' | 'line-break' | 'decorator') {
    super.setManagedLineBreak(lineBreakType);
  }

  override insertManagedLineBreak(webkitHack: boolean): void {
    const prevBreak = this.getManagedLineBreak();
    if (prevBreak) {
      if (webkitHack === (prevBreak.nodeName === 'IMG')) {
        return;
      }
      this.removeManagedLineBreak();
    }
    const element: HTMLElement & LexicalPrivateDOM = this.element;
    const before = this.before;
    const br = document.createElement('br');
    // eslint-disable-next-line unicorn/prefer-modern-dom-apis
    element.insertBefore(br, before);
    if (webkitHack) {
      const img = document.createElement('img');
      // eslint-disable-next-line unicorn/prefer-dom-node-dataset
      img.setAttribute('data-lexical-linebreak', 'true');
      img.style.cssText =
        'display: inline !important; border: 0px !important; margin: 0px !important;';
      img.alt = '';
      // eslint-disable-next-line unicorn/prefer-modern-dom-apis
      element.insertBefore(img, br);
      element.__lexicalLineBreak = img;
    } else {
      element.__lexicalLineBreak = br;
    }
  }
}
