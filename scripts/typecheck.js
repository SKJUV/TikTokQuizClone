const { execFileSync } = require('child_process');

try {
  execFileSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
} catch (error) {
  process.exit(typeof error.status === 'number' ? error.status : 1);
}
