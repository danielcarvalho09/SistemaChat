/// <reference types="vite/client" />

// Declarações mínimas para Node.js APIs usadas no vite.config.ts
declare const __dirname: string;
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

declare module 'path' {
  export function resolve(...paths: string[]): string;
}
