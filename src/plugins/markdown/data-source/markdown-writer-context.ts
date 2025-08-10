import { IMarkdownWriterContext } from '../service/shortcut';

export class MarkdownWriterContext implements IMarkdownWriterContext {
  private lines: string[] = [];
  private before = '';
  private after = '';
  private children: MarkdownWriterContext[] = [];

  appendLine(line: string): void {
    this.lines.push(line);
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

  toString(): string {
    return (
      this.before +
      this.lines.join('') +
      this.children.map((child) => child.toString()).join('') +
      this.after
    );
  }
}
