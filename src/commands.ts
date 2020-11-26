import { spawnSync } from 'child_process';
import { Terminal, workspace } from 'coc.nvim';
import {
  Position,
  Range,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { Cmd, Ctx, isTomlDocument } from './ctx';
import * as lsp from './lsp_ext';

let terminal: Terminal | undefined;

function isInRange(range: Range, position: Position): boolean {
  const lineWithin =
    range.start.line <= position.line && range.end.line >= position.line;
  const charWithin =
    range.start.character <= position.character &&
    range.end.line >= position.character;
  return lineWithin && charWithin;
}

function countLines(text: string): number {
  return (text.match(/\n/g) || []).length;
}

export function serverVersion(ctx: Ctx): Cmd {
  return async () => {
    const bin = ctx.resolveBin();
    if (!bin) {
      const msg = `toml lsp is not found`;
      workspace.showMessage(msg, 'error');
      return;
    }

    const version = spawnSync(bin, ['--version'], { encoding: 'utf-8' }).stdout;
    workspace.showMessage(version);
  };
}

export function syntaxTree(ctx: Ctx): Cmd {
  return async () => {
    const doc = await workspace.document;
    if (!isTomlDocument(doc.textDocument)) return;

    // const mode = await workspace.nvim.call('visualmode');
    // let range: Range | null = null;
    // if (mode) {
    //   range = await workspace.getSelectedRange(mode, doc);
    // }
    const param: lsp.SyntaxTree.Params = {
      uri: doc.uri,
      // range,
    };

    const ret = await ctx.client.sendRequest(lsp.syntaxTree, param);
    await workspace.nvim.command('tabnew').then(async () => {
      const buf = await workspace.nvim.buffer;
      buf.setLines(ret.text.split('\n'), { start: 0, end: -1 });
    });
  };
}

export function tomlToJson(ctx: Ctx): Cmd {
  return async () => {
    const doc = await workspace.document;
    if (!isTomlDocument(doc.textDocument)) return;

    const mode = await workspace.nvim.call('visualmode');
    // let range: Range | null = null;
    // if (mode) {
    //   range = await workspace.getSelectedRange(mode, doc);
    // }
    const param: lsp.TomlToJson.Params = {
      text: doc.content,
    };

    const ret = await ctx.client.sendRequest(lsp.tomlToJson, param);
    await workspace.nvim.command('tabnew').then(async () => {
      const buf = await workspace.nvim.buffer;
      if (ret.errors?.length ?? 0 !== 0) {
        let errLines = `Clipboard Parse Errors:`;
        for (const err of ret.errors!) {
          errLines += `\n\t${err}`;
        }
        buf.setLines(errLines.split('\n'), { start: 0, end: -1 });
        return;
      } else {
        if (ret.text) {
          buf.setLines(ret.text.split('\n'), { start: 0, end: -1 });
        }
      }
    });
  };
}

export function upgrade(ctx: Ctx) {
  return async () => {
    await ctx.checkUpdate(false);
  };
}

export function resolveCodeAction(ctx: Ctx): Cmd {
  return async (params: lsp.ResolveCodeAction.Params) => {
    const edit: WorkspaceEdit = await ctx.client.sendRequest(
      lsp.resolveCodeAction,
      params
    );
    if (!edit) return;
    await applySnippetWorkspaceEdit(edit);
  };
}

export async function applySnippetWorkspaceEdit(edit: WorkspaceEdit) {
  if (!edit?.documentChanges?.length) {
    return;
  }

  let selection: Range | undefined = undefined;
  let position: Position | undefined = undefined;
  let lineDelta = 0;
  const change = edit.documentChanges[0];
  if (TextDocumentEdit.is(change)) {
    const newEdits: TextEdit[] = [];

    for (const edit of change.edits) {
      let { newText } = edit;
      const parsed = parseSnippet(edit.newText);
      if (parsed) {
        const [insert, [placeholderStart, placeholderLength]] = parsed;
        const prefix = insert.substr(0, placeholderStart);
        const lastNewline = prefix.lastIndexOf('\n');

        const startLine =
          edit.range.start.line + lineDelta + countLines(prefix);
        const startColumn =
          lastNewline === -1
            ? edit.range.start.character + placeholderStart
            : prefix.length - lastNewline - 1;
        if (placeholderLength) {
          selection = Range.create(
            startLine,
            startColumn,
            startLine,
            startColumn + placeholderLength
          );
        } else {
          position = Position.create(startLine, startColumn);
        }

        newText = insert;
      } else {
        lineDelta =
          countLines(edit.newText) -
          (edit.range.end.line - edit.range.start.line);
      }
      newEdits.push(TextEdit.replace(edit.range, newText));
    }

    const wsEdit: WorkspaceEdit = {
      changes: {
        [change.textDocument.uri]: newEdits,
      },
    };
    await workspace.applyEdit(wsEdit);

    const current = await workspace.document;
    if (current.uri !== change.textDocument.uri) {
      await workspace.loadFile(change.textDocument.uri);
      await workspace.jumpTo(change.textDocument.uri);
    }

    if (selection) {
      await workspace.selectRange(selection);
    } else if (position) {
      await workspace.moveTo(position);
    }
  }
}

function parseSnippet(snip: string): [string, [number, number]] | undefined {
  const m = snip.match(/\$(0|{0:([^}]*)})/);
  if (!m) return undefined;
  const placeholder = m[2] ?? '';
  const range: [number, number] = [m.index!, placeholder.length];
  const insert = snip.replace(m[0], placeholder);
  return [insert, range];
}

export function applySnippetWorkspaceEditCommand(): Cmd {
  return async (edit: WorkspaceEdit) => {
    await applySnippetWorkspaceEdit(edit);
  };
}
