// Node.js global definitions for environments where @types/node might not be available

declare global {
  var process: NodeJS.Process;
  var __dirname: string;
  var __filename: string;
  var console: Console;
  var Buffer: BufferConstructor;
  var require: NodeRequire;
  var module: NodeModule;
  var exports: any;
  var global: any;

  function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
  function clearTimeout(timeoutId: NodeJS.Timeout): void;
  function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
  function clearInterval(intervalId: NodeJS.Timeout): void;
  function setImmediate(callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate;
  function clearImmediate(immediateId: NodeJS.Immediate): void;

  namespace NodeJS {
    interface Process {
      env: ProcessEnv;
      cwd(): string;
      uptime(): number;
    }

    interface ProcessEnv {
      [key: string]: string | undefined;
    }

    interface Timeout {
      ref(): this;
      unref(): this;
    }

    interface Immediate {
      ref(): this;
      unref(): this;
    }
  }

  interface Console {
    log(...data: any[]): void;
    error(...data: any[]): void;
    warn(...data: any[]): void;
    info(...data: any[]): void;
    debug(...data: any[]): void;
  }

  interface BufferConstructor {
    from(data: string | any[] | ArrayBuffer, encoding?: string): Buffer;
    alloc(size: number, fill?: string | number, encoding?: string): Buffer;
  }

  interface Buffer {
    toString(encoding?: string, start?: number, end?: number): string;
    length: number;
  }

  interface NodeRequire {
    (id: string): any;
  }

  interface NodeModule {
    exports: any;
    id: string;
    filename: string;
    loaded: boolean;
    parent: NodeModule | null;
    children: NodeModule[];
  }
}

export {};