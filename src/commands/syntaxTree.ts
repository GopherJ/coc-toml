// Various debug commands

import * as requestExt from '../requestExt';
import { LanguageClient, workspace } from 'coc.nvim';

export function syntaxTree(client: LanguageClient): any {
  return async () => {
    const doc = await workspace.document;
    const params: requestExt.SyntaxTree.Params = {
      uri: doc.uri.toString(),
    };

    const res = await client.sendRequest<requestExt.SyntaxTree.Response>(
      requestExt.SyntaxTree.METHOD,
      params
    );
    await workspace.nvim.command('tabnew').then(async () => {
      const buf = await workspace.nvim.buffer;
      buf.setLines(res.text.split('\n'), { start: 0, end: -1 });
    });
  };
}