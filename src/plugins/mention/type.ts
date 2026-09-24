/** Stable data exposed by the mention service query and insertion subscription. */
export interface MentionDescriptor {
  label: string;
  metadata: Record<string, unknown>;
}
