import {
  commands,
  ConfigurationChangeEvent,
  workspace,
  WorkspaceConfiguration,
} from 'coc.nvim';

// Config for extension
export class Config {
  private readonly rootSection = 'coc-toml';
  private readonly requiresReloadOpts = [
    'taploConfig',
    'taploConfigEnabled',
    'schema',
    'updates',
    'serverPath',
  ].map((opt) => `${this.rootSection}.${opt}`);
  private cfg: WorkspaceConfiguration;

  constructor() {
    workspace.onDidChangeConfiguration((event) => this.onConfigChange(event));
    this.cfg = workspace.getConfiguration(this.rootSection);
  }

  private async onConfigChange(event: ConfigurationChangeEvent) {
    this.cfg = workspace.getConfiguration(this.rootSection);

    const requiresReloadOpt = this.requiresReloadOpts.find((opt) =>
      event.affectsConfiguration(opt)
    );
    if (!requiresReloadOpt) return;

    const msg = `Changing "${requiresReloadOpt}" requires a reload`;
    const prompt = await workspace.showPrompt(`${msg}. Reload now?`);
    if (prompt) {
      await commands.executeCommand(`workbench.action.reloadWindow`);
    }
  }

  get serverPath() {
    return this.cfg.get<null | string>('serverPath')!;
  }

  get prompt() {
    return this.cfg.get<boolean>('updates.prompt');
  }
}
