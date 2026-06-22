export const bytesToBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

export const base64ToBytes = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));
