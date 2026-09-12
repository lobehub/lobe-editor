import type { LexicalNode } from 'lexical';

import type { AnnotationMap } from '@/plugins/properties/service/annotation';
import type {
  PropertiesAnnotationStorage,
  PropertiesCollaborationProvider,
} from '@/plugins/properties/service/properties';

import type { YjsService } from '../service';

/**
 * Yjs-owned adapter for the narrow collaboration surface consumed by
 * PropertiesPlugin. The private shared-item lookup stays on this side of the
 * boundary, as does translating a Y.Doc into the annotation map port.
 */
export class YjsPropertiesProvider implements PropertiesCollaborationProvider {
  private annotationAttachment: AnnotationAttachment | null = null;

  constructor(private readonly yjsService: YjsService) {}

  attachAnnotationStorage(storage: PropertiesAnnotationStorage): () => void {
    if (this.annotationAttachment) {
      throw new Error('YjsPropertiesProvider already has an annotation storage.');
    }

    const attachment: AnnotationAttachment = {
      map: null,
      storage,
      token: {},
      unsubscribe: null,
    };
    this.annotationAttachment = attachment;
    const onState = (state: ReturnType<YjsService['getState']>) => {
      if (this.annotationAttachment !== attachment) return;
      const nextMap = state?.doc?.getMap('lobe:annotations') as unknown as
        AnnotationMap | undefined;
      if (nextMap === attachment.map) return;

      if (attachment.map) {
        storage.detachMap(attachment.map, attachment.token);
      }
      attachment.map = nextMap ?? null;
      if (attachment.map) {
        storage.attachMap(attachment.map, attachment.token);
      }
    };

    attachment.unsubscribe = this.yjsService.subscribe(onState);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (this.annotationAttachment !== attachment) return;

      attachment.unsubscribe?.();
      if (attachment.map) {
        storage.detachMap(attachment.map, attachment.token);
      }
      attachment.map = null;
      this.annotationAttachment = null;
    };
  }

  getNodeIdentity(node: LexicalNode): string | undefined {
    if (!this.yjsService.isReady()) return undefined;

    const state = this.yjsService.getState();
    const collabNode = state?.binding.collabNodeMap.get(node.getKey());
    if (!collabNode) return undefined;

    const item = (
      collabNode.getSharedType() as unknown as {
        _item?: { id?: { client?: number; clock?: number } } | null;
      }
    )._item;
    if (
      !item?.id ||
      !Number.isSafeInteger(item.id.client) ||
      !Number.isSafeInteger(item.id.clock)
    ) {
      return undefined;
    }
    return `${item.id.client}:${item.id.clock}`;
  }

  getReadiness(): 'initializing' | 'ready' {
    return this.yjsService.isReady() ? 'ready' : 'initializing';
  }

  subscribe(listener: () => void): () => void {
    const unsubscribeState = this.yjsService.subscribe(() => listener());
    const unsubscribeReadiness = this.yjsService.subscribeReadiness(() => listener());

    return () => {
      unsubscribeState();
      unsubscribeReadiness();
    };
  }
}

interface AnnotationAttachment {
  map: AnnotationMap | null;
  storage: PropertiesAnnotationStorage;
  token: object;
  unsubscribe: (() => void) | null;
}
