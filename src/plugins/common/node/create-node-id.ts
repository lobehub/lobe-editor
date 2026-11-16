/** Generate a compact opaque ID for newly created nodes. */
export function createNodeId(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  const id: string[] = [];

  if (typeof cryptoObject?.getRandomValues === 'function') {
    while (id.length < 10) {
      const bytes = cryptoObject.getRandomValues(new Uint8Array(16));
      for (const byte of bytes) {
        // 252 is the largest multiple of 36 below 256. Rejecting the tail
        // keeps every base-36 character equally likely.
        if (byte >= 252) continue;
        id.push(alphabet[byte % 36]);
        if (id.length === 10) break;
      }
    }
    return id.join('');
  }

  for (let index = 0; index < 10; index++) {
    id.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }
  return id.join('');
}
