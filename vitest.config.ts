import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: false,
        environment: "node",
        include: ["src/**/*.test.ts"],
        exclude: [
            "node_modules/**",
            "dist/**",
            ".tmp/**",
            "src/**/*.svelte",
            "src/svelte-entry.ts",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/svelte-entry.ts",
                "src/App.svelte",
                "src/visual.ts",
            ],
        },
    },
});
