import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StaticFeature,
  Uri,
  workspace,
} from 'coc.nvim';
import {
  ClientCapabilities,
  CodeAction,
  CodeActionParams,
  CodeActionRequest,
  Command,
} from 'vscode-languageserver-protocol';
import * as lsp from './lsp_ext';

class ExperimentalFeatures implements StaticFeature {
  fillClientCapabilities(capabilities: ClientCapabilities): void {
    const caps: any = capabilities.experimental ?? {};
    caps.codeActionGroup = true;
    caps.hoverActions = true;
    caps.snippetTextEdit = false;
    caps.resolveCodeAction = true;
    caps.statusNotification = true;
    capabilities.experimental = caps;
  }
  initialize(): void {}
}
function isCodeActionWithoutEditsAndCommands(value: any): boolean {
  const candidate: CodeAction = value;
  return (
    candidate &&
    (candidate.diagnostics === void 0 ||
      Array.isArray(candidate.diagnostics)) &&
    (candidate.kind === void 0 || typeof candidate.kind === 'string') &&
    candidate.edit === void 0 &&
    candidate.command === void 0
  );
}

export function createClient(bin: string, args: string[]): LanguageClient {
  let folder = '.';
  if (workspace.workspaceFolder?.uri.length > 0) {
    folder = Uri.parse(workspace.workspaceFolder.uri).fsPath;
  }
  const run: Executable = {
    command: bin,
    args: args,
    options: { cwd: folder },
  };

  const serverOptions: ServerOptions = run;
  const outputChannel = workspace.createOutputChannel(
    'taplo Language Server Trace'
  );
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'toml' },
      // { pattern: '*.toml' },
      { scheme: 'file', language: 'cargoLock' },
    ],
    initializationOptions: workspace.getConfiguration('coc-toml'),
    synchronize: {
      configurationSection: 'coc-toml',
      fileEvents: [
        workspace.createFileSystemWatcher('**/.toml'),
        workspace.createFileSystemWatcher('**/Cargo.lock'),
      ],
    },
    middleware: {
      async provideCodeActions(document, range, context, token) {
        const params: CodeActionParams = {
          textDocument: { uri: document.uri },
          range,
          context,
        };
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const values = await client.sendRequest(
          CodeActionRequest.type,
          params,
          token
        );
        if (values === null) return undefined;
        const result: (CodeAction | Command)[] = [];
        for (const item of values) {
          // In our case we expect to get code edits only from diagnostics
          if (CodeAction.is(item)) {
            const command: Command = {
              command: 'taplo.applySnippetWorkspaceEdit',
              title: item.title,
              arguments: [item.edit],
            };
            result.push(CodeAction.create(item.title, command));
            continue;
          }

          if (!isCodeActionWithoutEditsAndCommands(item)) {
            console.error('isCodeActionWithoutEditsAndCommands:', item.title);
            continue;
          }

          const resolveParams: lsp.ResolveCodeAction.Params = {
            id: (item as any).id,
            codeActionParams: params,
          };
          const command: Command = {
            command: 'taplo.resolveCodeAction',
            title: item.title,
            arguments: [resolveParams],
          };
          result.push(CodeAction.create(item.title, command));
        }
        return result;
      },
    },
    outputChannel,
    initializationFailedHandler: (e) => {
      console.error(e);
      return true;
    },
    progressOnInitialization: true,
  };

  const client = new LanguageClient(
    'taplo-lsp',
    'Toml Language Server',
    serverOptions,
    clientOptions
  );
  // HACK: This is an awful way of filtering out the decorations notifications
  // However, pending proper support, this is the most effecitve approach
  // Proper support for this would entail a change to vscode-languageclient to allow not notifying on certain messages
  // Or the ability to disable the serverside component of highlighting (but this means that to do tracing we need to disable hihlighting)
  // This also requires considering our settings strategy, which is work which needs doing
  // @ts-ignore The tracer is private to vscode-languageclient, but we need access to it to not log publishDecorations requests
  client._tracer = {
    log: (messageOrDataObject: string | unknown, data?: string) => {
      if (typeof messageOrDataObject === 'string') {
        // @ts-ignore This is just a utility function
        client.logTrace(messageOrDataObject, data);
      } else {
        // @ts-ignore
        client.logObjectTrace(messageOrDataObject);
      }
    },
  };
  client.registerProposedFeatures();
  client.registerFeature(new ExperimentalFeatures());

  return client;
}
