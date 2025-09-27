export {};

declare global {
  class Worker {
    constructor(stringUrl: string | URL, options?: { type?: 'classic' | 'module'; credentials?: 'omit' | 'same-origin' | 'include'; name?: string });
    postMessage(message: unknown, transfer?: unknown[]): void;
    terminate(): void;
  }
}
