import type { RendererRegistry } from '../types';
import { renderAlert } from './alert';
import { renderChart } from './chart';
import { renderCodeBlock } from './codeblock';
import { renderFile } from './file';
import { renderFootnote, renderFootnoteDefinition, renderFootnoteSection } from './footnote';
import { renderHR } from './horizontalrule';
import { renderBlockImage, renderImage } from './image';
import { renderMath } from './math';
import { renderMention } from './mention';

export function createDefaultRenderers(): RendererRegistry {
  return new Map([
    ['image', renderImage],
    ['block-image', renderBlockImage],
    ['math', renderMath],
    ['mathBlock', renderMath],
    ['code', renderCodeBlock],
    ['horizontalrule', renderHR],
    ['mention', renderMention],
    ['file', renderFile],
    ['chart', renderChart],
    ['alert', renderAlert],
    ['footnote', renderFootnote],
    ['footnote-section', renderFootnoteSection],
    ['footnote-definition', renderFootnoteDefinition],
  ]);
}
