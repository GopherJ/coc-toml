// Wrapper over the WASM module.
//
// Proxies all messages between the IPC
// channel and the WASM module.
//
// And provides some utilities.

// @ts-ignore
import loadTaplo from '../taplo/taplo-ide/Cargo.toml';

import * as fs from 'fs';
import * as path from 'path';
import fetch, { Headers, Request, Response } from 'node-fetch';

// For reqwest
(global as any).Headers = Headers;
(global as any).Request = Request;
(global as any).Response = Response;
(global as any).Window = Object;
(global as any).fetch = fetch;

// Needed for taplo-cli's glob matching
(global as any).isWindows = () => {
  return process.platform == 'win32';
};

(global as any).sendMessage = (msg: any) => {
  if (process.send) {
    process.send(msg);
  }
};

(global as any).readFile = (path: string): Uint8Array => {
  return fs.readFileSync(path);
};

(global as any).isAbsolutePath = (p: string): boolean => {
  return (
    path.resolve(p) === path.normalize(p).replace(RegExp(path.sep + '$'), '')
  );
};

(global as any).fileExists = (p: string): boolean => {
  return fs.existsSync(p);
};

let taplo: any;

process.on('message', async (d) => {
  if (typeof taplo === 'undefined') {
    taplo = await loadTaplo();
    await taplo.initialize();
  }
  taplo.message(d);
});

// These are panics from rust
process.on('unhandledRejection', (up) => {
  console.error('[Taplo Error]', up);
  throw up;
});
