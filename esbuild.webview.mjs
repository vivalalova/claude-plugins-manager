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
  ...(!watch && { drop: ['console'] }),
  metafile: !watch,
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[webview] watching...');
} else {
  const result = await esbuild.build(config);
  if (result.metafile) {
    const { writeFile } = await import('fs/promises');
    await writeFile('dist/webview/meta.json', JSON.stringify(result.metafile));
  }
  console.log('[webview] build complete');
}
