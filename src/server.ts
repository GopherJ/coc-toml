import { Executable, ServerOptions } from 'coc.nvim';
import { spawn, SpawnOptions } from 'child_process';

export const serverProcessGenerator = (
  executable: Executable
): ServerOptions => async () => {
  const command = executable;
  const args = command.args || [];
  const options: SpawnOptions = Object.assign({}, command.options);
  options.env = options.env
    ? Object.assign({}, process.env, options.env)
    : process.env;
  const serverProcess = spawn(command.command, args, options);
  await sleep(6000);
  return serverProcess;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
