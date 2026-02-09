import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outdir: 'dist/webview',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !watch,
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[webview] watching...');
} else {
  await esbuild.build(config);
  console.log('[webview] build complete');
}
