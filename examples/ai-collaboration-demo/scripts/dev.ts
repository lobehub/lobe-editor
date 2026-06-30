import { spawn } from 'node:child_process';

const commands = [
  ['server', ['exec', 'tsx', 'watch', 'server/index.ts']],
  ['client', ['exec', 'vite', '--host', '0.0.0.0', '--port', '5175']],
] as const;

const children = commands.map(([name, args]) => {
  const child = spawn('pnpm', args, {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
});

const stop = () => {
  for (const child of children) {
    child.kill('SIGINT');
  }
};

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
