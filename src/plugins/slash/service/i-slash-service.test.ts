import type { IEditorKernel } from '@/types';
import { describe, expect, it } from 'vitest';

import { SlashService } from './i-slash-service';

const createService = () => new SlashService({ isHotReloadMode: () => false } as IEditorKernel);

const registerDefaultTriggers = (service: SlashService) => {
  service.registerSlash({ items: [], trigger: '/' });
  service.registerSlash({ items: [], trigger: '@' });
};

describe('SlashService', () => {
  it('keeps path separators inside a non-slash trigger query', () => {
    const service = createService();
    registerDefaultTriggers(service);

    const resolution = service.resolveTrigger('@src/components/Button');
    const match = service.getSlashTriggerFn('@')?.('@src/components/Button');

    expect(resolution).toEqual({ leadOffset: 0, trigger: '@' });
    expect(match?.matchingString).toBe('src/components/Button');
  });

  it('still recognizes slash commands after allowing path separators', () => {
    const service = createService();
    registerDefaultTriggers(service);

    expect(service.resolveTrigger('run /review')).toEqual({ leadOffset: 4, trigger: '/' });
  });

  it('recovers an existing trigger after backspace removes an invalid boundary', () => {
    const service = createService();
    registerDefaultTriggers(service);

    expect(service.resolveTrigger('@source!')).toBeNull();
    expect(service.resolveTrigger('@source')).toEqual({ leadOffset: 0, trigger: '@' });
  });

  it('does not activate embedded trigger characters', () => {
    const service = createService();
    registerDefaultTriggers(service);

    expect(service.resolveTrigger('mail@example.com')).toBeNull();
  });
});
