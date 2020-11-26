import {
  commands,
  CompleteResult,
  ExtensionContext,
  listManager,
  sources,
  workspace,
} from 'coc.nvim';
import { existsSync, mkdirSync } from 'fs';
import { Config } from './config';
import { Ctx } from './ctx';
import * as cmd from './commands';
import { downloadServer } from './downloader';

export async function activate(context: ExtensionContext): Promise<void> {
  const config = new Config();
  const ctx = new Ctx(context, config);

  const serverRoot = context.storagePath;
  if (!existsSync(serverRoot)) {
    mkdirSync(serverRoot);
  }

  const bin = ctx.resolveBin();
  if (!bin) {
    let msg = 'taplo binary is not found, download from GitHub?';
    let ret = 0;
    if (config.prompt) {
      ret = await workspace.showQuickpick(['Yes', 'Cancel'], msg);
    }
    if (ret === 0) {
      try {
        await downloadServer(context);
      } catch (e) {
        console.error(e);
        msg =
          'Download taplo failed, you can get it from https://github.com/kkiyama117/coc-toml';
        workspace.showMessage(msg, 'error');
        return;
      }
    } else {
      return;
    }
  }
  ctx.registerCommand('tomlToJson', cmd.tomlToJson);
  ctx.registerCommand('syntaxTree', cmd.syntaxTree);
  ctx.registerCommand('upgrade', cmd.upgrade);
  ctx.registerCommand('serverVersion', cmd.serverVersion);
  ctx.registerCommand('resolveCodeAction', cmd.resolveCodeAction);
  ctx.registerCommand(
    'applySnippetWorkspaceEdit',
    cmd.applySnippetWorkspaceEditCommand
  );
  ctx.registerCommand('reload', (ctx) => {
    return async () => {
      workspace.showMessage(`Reloading taplo-lsp...`);

      for (const sub of ctx.subscriptions) {
        try {
          sub.dispose();
        } catch (e) {
          console.error(e);
        }
      }

      await activate(context);

      workspace.showMessage(`Reloaded taplo-lsp`);
    };
  });

  await ctx.startServer();
  await ctx.checkUpdate();
  // activateInlayHints(ctx);
}
