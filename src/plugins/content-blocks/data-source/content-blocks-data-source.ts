import type { LexicalEditor } from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';

import type { ContentBlock, ExtractContentBlocksOptions } from '../types';
import { CONTENT_BLOCKS_DATA_TYPE } from '../types';
import { extractContentBlocks } from '../utils/extract';

export class ContentBlocksDataSource extends DataSource {
  constructor(
    private getMarkdownService: () => IMarkdownShortCutService | null,
    private defaultOptions: ExtractContentBlocksOptions = {},
  ) {
    super(CONTENT_BLOCKS_DATA_TYPE);
  }

  override read(): void {
    throw new Error("'content-blocks' data source is write-only (editor → blocks).");
  }

  override write(editor: LexicalEditor): ContentBlock[] {
    const service = this.getMarkdownService();
    if (!service) {
      throw new Error(
        'ContentBlocksPlugin requires MarkdownPlugin to be registered first; markdown writer service is missing.',
      );
    }
    return extractContentBlocks(editor, service, this.defaultOptions);
  }
}
