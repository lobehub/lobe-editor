import { $isElementNode, LexicalNode } from 'lexical';

import { IMarkdownWriterContext, MarkdownShortCutService } from '../service/shortcut';

export class MarkdownWriterContext implements IMarkdownWriterContext {
  private before = '';
  private after = '';
  private children: Array<MarkdownWriterContext | string> = [];
  private markdownService: MarkdownShortCutService;
  private processor?: (before: string, content: string, after: string) => string;

  constructor(markdownService?: MarkdownShortCutService) {
    this.markdownService = markdownService!;
  }

  appendLine(line: string): void {
    this.children.push(line);
  }

  newChild(): MarkdownWriterContext {
    const child = new MarkdownWriterContext(this.markdownService);
    this.children.push(child);
    return child;
  }

  wrap(before: string, after: string): void {
    this.before = before;
    this.after = after;
  }

  addProcessor(processor: (before: string, content: string, after: string) => string): void {
    this.processor = processor;
  }

  toString(): string {
    const content =
      this.before + this.children.map((child) => child.toString()).join('') + this.after;
    return this.processor
      ? this.processor(
          this.before,
          this.children.map((child) => child.toString()).join(''),
          this.after,
        )
      : content;
  }

  processChild(parentCtx: IMarkdownWriterContext, child: LexicalNode) {
    const writer = this.markdownService.markdownWriters[child.getType()];
    let currentCtx = parentCtx as MarkdownWriterContext;
    if ($isElementNode(child)) {
      currentCtx = currentCtx.newChild();
    }
    let skipChildren: boolean | undefined = false;
    if (writer) {
      skipChildren = writer(currentCtx, child) as boolean | undefined;
    }
    if (skipChildren) {
      return;
    }
    if ($isElementNode(child)) {
      child.getChildren().forEach((child) => this.processChild(currentCtx, child));
    }
  }
}
