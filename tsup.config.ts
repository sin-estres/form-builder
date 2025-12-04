import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    // Bundle all dependencies - no externals
    noExternal: [/.*/],
    injectStyle: false, // We export a separate CSS file
});
