import {
  ClientState,
  commands,
  ExtensionContext,
  LanguageClient,
  services,
  StatusBarItem,
  workspace,
} from 'coc.nvim';
import {
  CancellationToken,
  Disposable,
  ErrorCodes,
  RequestType,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

import executable from 'executable';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import which from 'which';

import { createClient } from './client';
import { Config } from './config';
import { downloadServer, getLatestRelease } from './downloader';

export type TomlDocument = TextDocument & { languageId: 'toml' };

export function isTomlDocument(
  document: TextDocument
): document is TomlDocument {
  return document.languageId === 'toml';
}

export type Cmd = (...args: any[]) => unknown;

export class Ctx {
  client!: LanguageClient;
  private readonly statusBar: StatusBarItem;

  // private statusBar: StatusBarItem;

  constructor(
    private readonly extCtx: ExtensionContext,
    readonly config: Config
  ) {
    this.statusBar = workspace.createStatusBarItem(10);
    this.statusBar.text = 'toml';
    this.extCtx.subscriptions.push(this.statusBar);
  }

  registerCommand(name: string, factory: (ctx: Ctx) => Cmd) {
    const fullName = `toml.${name}`;
    const cmd = factory(this);
    const d = commands.registerCommand(fullName, cmd);
    this.extCtx.subscriptions.push(d);
  }

  async startServer(args: string[] = ['run']) {
    const bin = this.resolveBin();
    if (!bin) {
      return;
    }
    const client = createClient(bin, args);
    // TODO: Enable retry and optimization
    this.statusBar.text = `Register services...`;
    this.statusBar.show();
    this.extCtx.subscriptions.push(services.registLanguageClient(client));

    this.statusBar.text = `Waiting taplo...`;
    this.statusBar.show();
    await this.sleep(5000);
    await client.onReady();
    console.error('OK');
    this.statusBar.hide();
    // @ts-ignore: onReady always not stopped

    // client.onNotification(lsp.updateBuiltInSchemas, async (params) => {
    //   const associations = params.associations;
    //   this.statusBar.text = `taplo ${associations}`;
    //   this.statusBar.show();
    // });
    this.client = client;
  }

  get subscriptions(): Disposable[] {
    return this.extCtx.subscriptions;
  }

  pushCleanup(d: Disposable) {
    this.extCtx.subscriptions.push(d);
  }

  resolveBin(): string | undefined {
    let bin = join(
      this.extCtx.storagePath,
      process.platform === 'win32' ? 'taplo-lsp.exe' : 'taplo-lsp'
    );
    if (this.config.serverPath) {
      bin = this.config.serverPath;
      if (bin.startsWith('~/')) {
        bin = bin.replace('~', homedir());
      }

      bin = which.sync(bin, { nothrow: true }) || bin;
    }
    if (!existsSync(bin)) {
      return;
    }

    if (!executable.sync(bin)) {
      workspace.showMessage(`${bin} is not executable`, 'error');
      return;
    }

    return bin;
  }

  // check update is available on github
  async checkUpdate(auto = true) {
    if (this.config.serverPath) {
      // no update checking if using custom server
      return;
    }

    const latest = await getLatestRelease();
    if (!latest) {
      return;
    }

    const old = this.extCtx.globalState.get('release') || 'unknown release';
    if (old === latest.tag) {
      if (!auto) {
        workspace.showMessage(`Your toml lsp release is updated`);
      }
      return;
    }

    const msg = `taplo has a new release: ${latest.tag}, you're using ${old}. Would you like to download from GitHub`;
    let ret = 0;
    if (this.config.prompt) {
      ret = await workspace.showQuickpick(
        [
          'Yes, download the latest taplo-lsp',
          'Check GitHub releases',
          'Cancel',
        ],
        msg
      );
    }
    if (ret === 0) {
      if (process.platform === 'win32') {
        await this.client.stop();
      }
      try {
        await downloadServer(this.extCtx);
      } catch (e) {
        console.error(e);
        let msg = 'Upgrade toml failed, please try again';
        if (e.code === 'EBUSY' || e.code === 'ETXTBSY' || e.code === 'EPERM') {
          msg =
            'Upgrade taplo failed, other Vim instances might be using it, you should close them and try again';
        }
        workspace.showMessage(msg, 'error');
        return;
      }
      await this.client.stop();
      this.client.start();

      await this.extCtx.globalState.update('release', latest.tag);
    } else if (ret === 1) {
      await commands
        .executeCommand(
          'vscode.open',
          'https://github.com/kkiyama117/coc-toml/releases'
        )
        .catch(() => {});
    }
  }

  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async sendRequestWithRetry<TParam, TRet>(
    reqType: RequestType<TParam, TRet, unknown>,
    param: TParam,
    token?: CancellationToken
  ): Promise<TRet> {
    for (const delay of [2, 4, 6, 8, 10, null]) {
      try {
        return await (token
          ? this.client.sendRequest(reqType, param, token)
          : this.client.sendRequest(reqType, param));
      } catch (error) {
        if (delay === null) {
          throw error;
        }

        if (error.code === ErrorCodes.RequestCancelled) {
          throw error;
        }

        if (error.code !== ErrorCodes.ContentModified) {
          throw error;
        }

        await this.sleep(10 * (1 << delay));
      }
    }
    throw 'unreachable';
  }
}
