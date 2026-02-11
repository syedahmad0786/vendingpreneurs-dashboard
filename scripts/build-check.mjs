import { execSync } from 'child_process';

try {
  const output = execSync('npx next build 2>&1', {
    cwd: '/vercel/share/v0-project',
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10,
    timeout: 120000,
  });
  console.log(output);
} catch (err) {
  console.log('BUILD FAILED');
  console.log(err.stdout || '');
  console.log(err.stderr || '');
}
