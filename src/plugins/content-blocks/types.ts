export interface TextContentBlock {
  text: string;
  type: 'text';
}

export interface ImageContentBlock {
  alt: string;
  height?: number;
  type: 'image';
  url: string;
  width?: number;
}

export interface FileContentBlock {
  name: string;
  size?: number;
  type: 'file';
  url: string;
}

export type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

export interface ExtractContentBlocksOptions {
  /**
   * When an image/file is in `loading` / `pending` / `error` state and thus has no
   * usable URL, emit a textual placeholder into the surrounding text block instead
   * of dropping the node silently.
   * @default true
   */
  emitPlaceholderForUnuploaded?: boolean;
}

export interface ImageListItem {
  alt: string;
  id: string;
  url: string;
}

export interface FileListItem {
  fileType: string;
  id: string;
  name: string;
  size: number;
  url: string;
}

export interface MediaLists {
  fileList: FileListItem[];
  imageList: ImageListItem[];
}

export const CONTENT_BLOCKS_DATA_TYPE = 'content-blocks';
