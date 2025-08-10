import { IMarkdownWriterContext } from '../service/shortcut';

export class MarkdownWriterContext implements IMarkdownWriterContext {
  private before = '';
  private after = '';
  private children: Array<MarkdownWriterContext | string> = [];
  private processor?: (before: string, content: string, after: string) => string;

  appendLine(line: string): void {
    this.children.push(line);
  }

  newChild(): MarkdownWriterContext {
    const child = new MarkdownWriterContext();
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
}
