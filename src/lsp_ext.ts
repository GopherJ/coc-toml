// Requests that are not in the LSP spec
import * as lc from 'vscode-languageserver-protocol';

export namespace ResolveCodeAction {
  export interface Params {
    id: string;
    codeActionParams: lc.CodeActionParams;
  }

  export const METHOD = 'experimental/resolveCodeAction';
}
export const resolveCodeAction = new lc.RequestType<
  ResolveCodeAction.Params,
  lc.WorkspaceEdit,
  unknown
>(ResolveCodeAction.METHOD);
//////////////////////////////////////////////////////////////////////////////
// Requests that are not in the LSP spec

export namespace TomlToJson {
  export interface Params {
    // TOML text
    text: string;
  }

  export interface Response {
    // JSON text
    text?: string;
    errors?: string[];
  }

  export const METHOD = 'taplo/tomlToJson';
}

export const tomlToJson = new lc.RequestType<
  TomlToJson.Params,
  TomlToJson.Response,
  void
>(TomlToJson.METHOD);

export namespace SyntaxTree {
  export interface Params {
    // URI of the TOML document
    uri: string;
  }

  export interface Response {
    // Syntax tree to show
    text: string;
  }

  export const METHOD = 'taplo/syntaxTree';
}
export const syntaxTree = new lc.RequestType<
  SyntaxTree.Params,
  SyntaxTree.Response,
  void
>(SyntaxTree.METHOD);

export namespace MessageWithOutput {
  export const enum MessageKind {
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
  }

  export interface Params {
    kind: MessageKind;
    message: string;
  }

  export const METHOD = 'taplo/messageWithOutput';
}

export const messageWithOutput = new lc.NotificationType<MessageWithOutput.Params>(
  MessageWithOutput.METHOD
);

export namespace UpdateBuiltInSchemas {
  export interface Params {
    associations: { [key: string]: string };
  }

  export const METHOD = 'taplo/updateBuiltinSchemas';
}
export const updateBuiltInSchemas = new lc.NotificationType<UpdateBuiltInSchemas.Params>(
  UpdateBuiltInSchemas.METHOD
);

export namespace GetCachedSchema {
  export interface Params {
    schemaUri: string;
  }

  export interface Response {
    schemaJson?: string;
  }

  export const METHOD = 'taplo/getCachedSchema';
}

export namespace CacheSchema {
  export interface Params {
    schemaUri: string;
    schemaJson: string;
  }

  export const METHOD = 'taplo/cacheSchema';
}

export namespace ConfigFileChanged {
  export const METHOD = 'taplo/configFileChanged';
}

export namespace WatchConfigFile {
  export interface Params {
    configPath: string;
  }

  export const METHOD = 'taplo/watchConfigFile';
}
