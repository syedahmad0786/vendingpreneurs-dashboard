import { execSync } from 'child_process';

try {
  const output = execSync('npx tsc --noEmit 2>&1', {
    cwd: '/vercel/share/v0-project',
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10,
  });
  console.log('TypeScript check passed!');
  console.log(output);
} catch (e) {
  console.log('TypeScript errors found:');
  console.log(e.stdout || '');
  console.log(e.stderr || '');
}
