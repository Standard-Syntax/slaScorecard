
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
    plugins: [svelte({ compilerOptions: { dev: false } })],
    test: {
        globals: false,
        environment: 'jsdom',
        include: ['src/components/SlaTable.behavior.test.ts'],
        coverage: { provider: 'v8', reporter: ['text'], include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts'] },
    },
});
