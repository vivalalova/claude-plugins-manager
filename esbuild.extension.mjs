import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outdir: 'dist/extension',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: !watch,
  metafile: !watch,
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[extension] watching...');
} else {
  const result = await esbuild.build(config);
  if (result.metafile) {
    const { writeFile } = await import('fs/promises');
    await writeFile('dist/extension/meta.json', JSON.stringify(result.metafile));
  }
  console.log('[extension] build complete');
}
