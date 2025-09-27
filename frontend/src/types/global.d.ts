export {};

declare global {
  interface Worker {
    postMessage: (...args: unknown[]) => void;
    terminate: () => void;
  }
}
