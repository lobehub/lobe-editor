/** Stable data exposed by mention events and the mention query command. */
export interface MentionDescriptor {
  label: string;
  metadata: Record<string, unknown>;
}
