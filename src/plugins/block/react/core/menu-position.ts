const TEXT_LINE_BLOCK_TAGS = new Set(['BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P']);

export const BLOCK_MENU_OPTICAL_OFFSET_Y = -2;

interface ResolveBlockMenuTopOptions {
  anchorTop: number;
  blockHeight: number;
  blockTagName: string;
  lineHeight: string;
  menuHeight: number;
}

export const resolveBlockMenuTop = ({
  anchorTop,
  blockHeight,
  blockTagName,
  lineHeight,
  menuHeight,
}: ResolveBlockMenuTopOptions): number => {
  if (!TEXT_LINE_BLOCK_TAGS.has(blockTagName.toUpperCase())) {
    return anchorTop + BLOCK_MENU_OPTICAL_OFFSET_Y;
  }

  const parsedLineHeight = Number.parseFloat(lineHeight);
  if (!Number.isFinite(parsedLineHeight) || parsedLineHeight <= 0) {
    return anchorTop + BLOCK_MENU_OPTICAL_OFFSET_Y;
  }

  const firstLineHeight = Math.min(parsedLineHeight, blockHeight);

  return anchorTop + (firstLineHeight - menuHeight) / 2;
};
