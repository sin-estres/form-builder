import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/web-components.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ['react', 'react-dom'],
    injectStyle: false, // We will export a separate CSS file
});
