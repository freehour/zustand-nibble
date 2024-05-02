import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { EsLinter, linterPlugin } from 'vite-plugin-linter';
import tsConfigPaths from 'vite-tsconfig-paths';

import * as packageJson from './package.json';

export default defineConfig(configEnv => ({
    plugins: [
        tsConfigPaths(),
        linterPlugin({
            include: ['./src/**/*.{ts}'],
            linters: [new EsLinter({ configEnv })],
        }),
        dts({
            include: ['src/'],
        }),
    ],
    build: {
        lib: {
            entry: resolve('src', 'index.ts'),
            name: 'Zustand Nibble',
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            external: Object.keys(packageJson.dependencies || {}),
            output: {
                globals: Object.fromEntries(Object.keys(packageJson.dependencies || {}).map(dep => [dep, dep])),
            },
        },
    },
}));
