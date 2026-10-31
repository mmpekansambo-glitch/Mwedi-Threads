// Stands in for lib/logger in the browser scenario API, which runs bundled
// without pino-pretty's worker. Warnings and errors still show.
export const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
