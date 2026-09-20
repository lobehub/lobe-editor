// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { BoundedSessionRetention } from './session-retention';

describe('BoundedSessionRetention', () => {
  it('counts reservations before commit and never evicts admitted entries', () => {
    const retention = new BoundedSessionRetention<string>(2);

    expect(retention.reserve('active')).toBe(true);
    expect(retention.reserve('terminal')).toBe(true);
    expect(retention.reserve('late')).toBe(false);
    expect(retention.commit('active', 'active-state')).toBe(true);
    expect(retention.commit('terminal', 'terminal-state')).toBe(true);
    expect(retention.get('active')).toBe('active-state');
    expect(retention.get('terminal')).toBe('terminal-state');
    expect(retention.commit('late', 'late-state')).toBe(false);
    expect(retention.get('late')).toBeUndefined();
  });

  it('rejects a late commit after teardown clears reservations', () => {
    const retention = new BoundedSessionRetention<string>(1);

    expect(retention.reserve('in-flight')).toBe(true);
    retention.clear();

    expect(retention.commit('in-flight', 'must-not-admit')).toBe(false);
    expect(retention.size).toBe(0);
    expect(retention.reserve('after-teardown')).toBe(true);
  });
});
