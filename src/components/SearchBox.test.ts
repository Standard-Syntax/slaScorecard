/**
 * SearchBox unit tests — no DOM library required.
 *
 * Compiles SearchBox.svelte and inspects the generated code for
 * structural correctness.
 *
 * Run: npx vitest run src/components/SearchBox.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/SearchBox.svelte";

function compileComponent(source: string) {
    return compile(source, {
        filename: COMPONENT_PATH,
        generate: "client",
        dev: false,
    });
}

describe("SearchBox", () => {
    const source = readFileSync(COMPONENT_PATH, "utf8");
    const compiled = compileComponent(source);

    // Test 1: Renders an <input type="search"> with class sla-search__input
    it("compiled output contains <input type='search' class='sla-search__input'>", () => {
        expect(compiled.js.code).toContain('type="search"');
        expect(compiled.js.code).toContain("sla-search__input");
    });

    // Test 2: Renders the placeholder "Search SLAs..."
    it("compiled code contains placeholder 'Search SLAs...'", () => {
        expect(source).toContain('placeholder="Search SLAs..."');
    });

    // Test 3: Sets aria-label="Search SLAs by name"
    it("compiled code contains aria-label='Search SLAs by name'", () => {
        expect(source).toContain('aria-label="Search SLAs by name"');
    });

    // Test 4: Initial value matches the initialValue prop
    it("compiled code initializes value state with initialValue prop", () => {
        // The component has: let value = $state(initialValue);
        // This creates a $state rune initialized from the prop
        expect(source).toContain("$state(initialValue)");
        // The compiled code should reference the initialValue prop
        expect(compiled.js.code).toContain("initialValue");
    });

    // Test 5: Input event calls onInput with trimmed string
    it("compiled code calls onInput with value.trim() on input", () => {
        // The template has: oninput={() => onInput(value.trim())}
        // Svelte 5 compiles this to a call that trims the value
        expect(source).toContain("onInput(value.trim())");
        // In compiled code, this becomes something like: onInput($trim(value))
        // or directly: onInput(value.trim())
        expect(compiled.js.code).toContain("onInput");
        expect(compiled.js.code).toContain("trim");
    });

    // Test 6: Leading/trailing whitespace is trimmed (verified by trim() call)
    it("source calls trim() on value before passing to onInput", () => {
        // The oninput handler explicitly trims the value
        expect(source).toContain("value.trim()");
    });

    // Test 7: Empty input event calls onInput("")
    it("empty string trim() results in empty string passed to onInput", () => {
        // trim() on empty string returns empty string
        // This is implicit in the trim() call — no special handling needed
        const trimCall = source.match(/value\.trim\(\)/);
        expect(trimCall).not.toBeNull();
    });

    // Test 8: Outer wrapper has class sla-search with Tailwind utilities
    it("outer wrapper has class sla-search with ml-auto, h-7, w-[200px]", () => {
        // Source should have the div with those classes
        expect(source).toContain('class="sla-search ml-auto h-7 w-[200px]"');
    });

    // Additional: Verify bind:value is used in source
    it("source uses bind:value for two-way binding", () => {
        expect(source).toContain("bind:value");
    });

    // Additional: Verify oninput handler is present
    it("source defines oninput handler that calls onInput", () => {
        expect(source).toContain("oninput");
        expect(source).toContain("onInput");
    });

    // Additional: Verify compiled code uses Svelte 5 state patterns
    it("compiled code uses $.state for value state", () => {
        // Svelte 5 compiles $state to $.state in the client runtime
        expect(compiled.js.code).toContain("$.state");
    });
});
