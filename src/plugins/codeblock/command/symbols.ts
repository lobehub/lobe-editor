import { createCommand } from 'lexical';

export const UPDATE_CODEBLOCK_LANG = createCommand<{
  lang: string;
}>('UPDATE_CODEBLOCK_LANG');
