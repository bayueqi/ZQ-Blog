// The parts of `bun:sqlite` that scripts use. The project does not load Bun's
// typings, which would add Bun globals to the Worker code.
declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { readonly?: boolean });
    query(sql: string): {
      get(...params: Array<unknown>): unknown;
      all(...params: Array<unknown>): Array<unknown>;
    };
    run(sql: string, params?: Array<unknown>): { changes: number };
    transaction(fn: () => void): () => void;
    close(): void;
  }
}
