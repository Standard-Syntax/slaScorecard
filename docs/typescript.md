---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TypeScript 6 Coding Standards

Standards for all TypeScript files in this project. These rules reflect TypeScript 6.0
(March 2026) defaults and the modern professional consensus on tooling, type safety, and
code structure. When in doubt, prefer explicitness over inference and correctness over brevity.

---

## Toolchain

| Tool                | Version | Role                                          |
| ------------------- | ------- | --------------------------------------------- |
| TypeScript          | `^6.0`  | Compiler and type checker                     |
| ESLint              | `^9.0`  | Linting (flat config, `eslint.config.ts`)     |
| `typescript-eslint` | `^8.0`  | TypeScript-aware ESLint rules                 |
| Prettier            | `^3.0`  | Formatting (single source of truth for style) |
| Vitest              | `^3.0`  | Unit and integration tests                    |
| `tsx`               | latest  | Dev-time script runner                        |
| `tsup` or `Rollup`  | latest  | Library bundling                              |
| Vite                | `^6.0`  | Web app bundling                              |

**Package manager:** Use `pnpm` as the default. Use `npm` only when the deployment target
requires it. Never mix lock files.

---

## `tsconfig.json` — Required Settings

Every project MUST include a `tsconfig.json`. Use these settings as the baseline.

### Web app (Vite / bundler)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    // "DOM.Iterable" and "DOM.AsyncIterable" are now included in "DOM" as of TS 6.
    // Add "esnext" (or the granular "esnext.temporal" / "esnext.disposable") to get
    // Temporal API types and Symbol.dispose / Symbol.asyncDispose types.
    "lib": ["ES2025", "DOM", "esnext.temporal", "esnext.disposable"],
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "types": [],
  },
  "include": ["src"],
}
```

### Node.js library (ESM)

```jsonc
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    // Add "esnext.temporal" for Temporal API types (ships in Node.js 26).
    // Add "esnext.disposable" for Symbol.dispose / Symbol.asyncDispose (using / await using).
    "lib": ["ES2025", "esnext.temporal", "esnext.disposable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "types": ["node"],
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
}
```

### Node.js app (CommonJS)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "bundler",
    "lib": ["ES2025", "esnext.temporal", "esnext.disposable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "types": ["node"],
  },
  "include": ["src"],
}
```

### Rules on compiler options

- `strict: true` is the default in TS 6. Never set `strict: false`.
- `noUncheckedIndexedAccess: true` — array and index signature access returns `T | undefined`.
  Handle it. Do not suppress with `!`.
- `exactOptionalPropertyTypes: true` — `{ a?: string }` means `{ a: string } | {}`, not
  `{ a: string | undefined }`. Add `| undefined` explicitly when you mean it.
- `verbatimModuleSyntax: true` — import types with `import type`. The compiler enforces it.
- `types: []` is the TS 6 default. Declare every `@types/*` package explicitly.
- Never use `baseUrl`. Use `#/` subpath imports (Node.js `imports` field in `package.json`)
  or relative imports.
- Never use `paths` to alias application source directories. Use subpath imports.
- `outFile` is removed in TS 6. Use a bundler.
- `noUncheckedSideEffectImports: true` is a TS 6 default. It catches typos in side-effect
  imports like `import "./missspelled-setup.js"`. Leave it on.
- `libReplacement: false` is a TS 6 default. Only enable it if you have a custom lib
  replacement setup — most projects don't.
- **`module` default:** The announcement states `esnext`, but the actual computed default
  is `ES2022` (since `target` defaults to `ES2025`, and `module` is inferred from `target`).
  Always set `module` explicitly in production tsconfigs to avoid relying on computed defaults.
- **`lib` and Temporal / `using`:** `ES2025` lib does NOT include Temporal API types or
  `Symbol.dispose`/`Symbol.asyncDispose`. Add `"esnext.temporal"` and `"esnext.disposable"`
  explicitly. For web apps, `"DOM.Iterable"` and `"DOM.AsyncIterable"` are now merged into
  `"DOM"` in TS 6 — remove them from your `lib` array.

---

## Imports

### Use `import type` for type-only imports

```typescript
// ✅
import type { User } from "./types.js";
import { createUser } from "./api.js";

// ✅ inline type modifier
import { type Config, parseConfig } from "./config.js";

// ❌ — verbatimModuleSyntax will error if User is type-only
import { User } from "./types.js";
```

### Use `#/` subpath imports for internal aliases

Define aliases in `package.json`:

```json
{
  "imports": {
    "#/*": "./src/*.js"
  }
}
```

Then import:

```typescript
// ✅
import { db } from "#/lib/db.js";

// ❌ — fragile relative path
import { db } from "../../../lib/db.js";
```

### Import ordering (enforced by ESLint)

1. Node.js built-ins (`node:fs`, `node:path`)
2. External packages
3. Internal packages (`#/`)
4. Relative imports (`./`, `../`)
5. Type-only imports last within each group, or use the inline `type` modifier

---

## Type Safety

### Never use `any`

`any` disables the type checker for that value and everything downstream. Use `unknown` and
narrow it. If you receive `any` from a third-party API, cast to `unknown` at the boundary
and validate before use.

```typescript
// ❌
function parseJson(raw: any) {
  return raw.name;
}

// ✅
function parseJson(raw: unknown): string {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "name" in raw &&
    typeof (raw as { name: unknown }).name === "string"
  ) {
    return (raw as { name: string }).name;
  }
  throw new TypeError("Expected { name: string }");
}
```

ESLint rule: `@typescript-eslint/no-explicit-any: error`.

### Narrow with type guards, not assertions

```typescript
// ❌ — silences the compiler, blows up at runtime
const user = getUser() as User;

// ✅ — narrow it
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v && "name" in v;
}
const raw = getUser();
if (!isUser(raw)) throw new TypeError("Not a User");
const user = raw; // typed as User
```

When a type assertion is genuinely correct (for example, after a `filter` that the compiler
cannot narrow), add an inline comment explaining why.

### Use `satisfies` to preserve literal types with shape checking

```typescript
// ❌ — type annotation widens literals
const config: Record<string, string | number> = {
  endpoint: "https://api.example.com",
  retries: 3,
};
// config.endpoint is string — literal is lost

// ✅ — satisfies checks shape, preserves literals
const config = {
  endpoint: "https://api.example.com",
  retries: 3,
} satisfies Record<string, string | number>;
// config.endpoint is "https://api.example.com"
```

### Model state as discriminated unions

Give every union member a `kind` (or `type`) discriminant field. Use `assertNever` in the
`default` branch for exhaustiveness — TypeScript itself does not error on missing cases
without it. The ESLint rule `@typescript-eslint/switch-exhaustiveness-check` also enforces this.

```typescript
// Shared utility — define once, import everywhere
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "err"; error: Error }
  | { kind: "loading" };

function render<T>(result: ApiResult<T>): string {
  switch (result.kind) {
    case "ok":
      return JSON.stringify(result.data);
    case "err":
      return `Error: ${result.error.message}`;
    case "loading":
      return "…";
    default:
      // If a new union member is added without a case here, TypeScript
      // will error: "Argument of type '...' is not assignable to type 'never'"
      return assertNever(result);
  }
}
```

Add to ESLint config:

```typescript
"@typescript-eslint/switch-exhaustiveness-check": "error",
```

### Use `NoInfer<T>` to anchor inference

When one parameter should anchor a generic and others should conform to it without contributing
to inference:

```typescript
// Without NoInfer: default may widen T
declare function createState<T>(initial: T, fallback: T): T;

// With NoInfer: fallback conforms to T but does not widen it
declare function createState<T>(initial: T, fallback: NoInfer<T>): T;
```

### Use `const` type parameters to preserve literal types in generics

```typescript
declare function makeRoute<const T extends string>(path: T): T;
const r = makeRoute("/users/:id"); // r: "/users/:id" — not widened to string
```

---

## Functions and Control Flow

### Prefer function declarations for top-level exports

Function declarations hoist, appear in stack traces by name, and are easier to tree-shake.
Arrow functions are correct for callbacks, closures, and when `this` binding matters.

```typescript
// ✅ — named declaration for exported functions
export function computeTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ — arrow for callbacks
const doubled = [1, 2, 3].map((n) => n * 2);
```

### Use `using` / `await using` for resource cleanup

Any object implementing `Symbol.dispose` or `Symbol.asyncDispose` should be declared with
`using`. Disposal is guaranteed even on throw, in LIFO order.

**Required lib:** `"esnext.disposable"` (or `"esnext"`). `Symbol.dispose` and
`Symbol.asyncDispose` are not in `"ES2025"`. Add `"esnext.disposable"` to your `lib` array.

```typescript
// ✅
async function exportReport(): Promise<void> {
  await using conn = await db.connect();
  await using file = await createTempFile();
  const rows = await conn.query("SELECT ...");
  await file.write(rows);
  // conn and file are both disposed here, file first
}

// ❌ — manual cleanup is error-prone and skipped on throw
async function exportReport(): Promise<void> {
  const conn = await db.connect();
  try {
    const file = await createTempFile();
    try {
      // ...
    } finally {
      await file.close();
    }
  } finally {
    await conn.close();
  }
}
```

Implement `Disposable` or `AsyncDisposable` on any class that owns a resource:

```typescript
class DbConnection implements AsyncDisposable {
  async [Symbol.asyncDispose](): Promise<void> {
    await this.pool.release(this.client);
  }
}
```

### Return early; avoid deep nesting

```typescript
// ❌
function process(user: User | null) {
  if (user !== null) {
    if (user.isActive) {
      // ...
    }
  }
}

// ✅
function process(user: User | null): void {
  if (user === null) return;
  if (!user.isActive) return;
  // ...
}
```

### Use `filter()` without `as` casts — TS 6 narrows correctly

```typescript
const items = [{ kind: "a" as const }, null, { kind: "b" as const }, null];

// ✅ TS 6 narrows correctly:
const defined = items.filter((x): x is NonNullable<typeof x> => x !== null);
// defined: { kind: "a" | "b" }[]

// Also correct for discriminated unions in TS 6:
const aItems = items.filter((x) => x?.kind === "a");
// aItems: ({ kind: "a" } | null)[] — narrow further if needed
```

---

## Classes

Use classes when you need:

- Stateful objects with a clear lifecycle (especially with `Disposable`)
- Inheritance that models a real is-a relationship
- Decorators (native TC39 decorators, not `experimentalDecorators`)

Prefer plain functions and objects for stateless logic.

### Native decorators (no `experimentalDecorators`)

Remove `experimentalDecorators: true` and `emitDecoratorMetadata: true` from `tsconfig.json`.
Replace `Reflect.getMetadata()` with `Symbol.metadata`.

```typescript
// ✅ Native decorator
function Validate(_: undefined, ctx: ClassFieldDecoratorContext) {
  const fields = ((ctx.metadata.required as string[]) ??= []);
  fields.push(String(ctx.name));
}

class CreateUserDto {
  @Validate name!: string;
  @Validate email!: string;
}

const required = CreateUserDto[Symbol.metadata]?.required as string[];
// ["name", "email"]
```

Angular 18+, NestJS 11+, and MobX 7+ all support native decorators. Remove `reflect-metadata`
from dependencies when migrating.

---

## Error Handling

### Define typed error hierarchies

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "AppError";
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, "NOT_FOUND");
  }
}
```

### Type catch clause variables as `unknown`

`useUnknownInCatchVariables` is on by default in TS 6 strict mode. Always narrow.

```typescript
// ✅
try {
  await fetch(url);
} catch (err: unknown) {
  if (err instanceof AppError) {
    logger.error(err.code, err.message);
  } else {
    logger.error("UNEXPECTED", String(err));
  }
}
```

### Use `Promise.try()` for sync-to-async conversion

`Promise.try()` ships in `lib: "ES2025"`. Wraps synchronous code that might throw into a
`Promise`, preventing unhandled mixed sync/async error paths.

```typescript
// ✅
const result = await Promise.try(() => computeValue(input));

// ❌ — synchronous throw escapes the promise chain
const result = await Promise.resolve(computeValue(input));
```

---

## Naming Conventions

| Construct                | Convention                                                     | Example                        |
| ------------------------ | -------------------------------------------------------------- | ------------------------------ |
| Variables and functions  | `camelCase`                                                    | `getUserById`                  |
| Classes and interfaces   | `PascalCase`                                                   | `UserService`                  |
| Type aliases             | `PascalCase`                                                   | `ApiResult<T>`                 |
| Enums                    | `PascalCase` (enum), `SCREAMING_SNAKE_CASE` (members)          | `HttpMethod.GET`               |
| Constants (module-level) | `SCREAMING_SNAKE_CASE` for primitives, `camelCase` for objects | `MAX_RETRIES`, `defaultConfig` |
| Files                    | `kebab-case.ts`                                                | `user-service.ts`              |
| Test files               | `*.test.ts` or `*.spec.ts`                                     | `user-service.test.ts`         |
| React components         | `PascalCase.tsx`                                               | `UserCard.tsx`                 |
| Generic type parameters  | Single uppercase letter or descriptive `PascalCase`            | `T`, `TKey`, `TValue`, `TItem` |

### Avoid Hungarian notation

Do not prefix types onto names. The type system carries that information.

```typescript
// ❌
const strName = "Alice";
const arrUsers: User[] = [];
const bIsActive = true;

// ✅
const name = "Alice";
const users: User[] = [];
const isActive = true;
```

### Prefix booleans with `is`, `has`, `can`, `should`

```typescript
const isLoading = true;
const hasPermission = checkAccess(user);
const canRetry = attempts < MAX_RETRIES;
const shouldRefresh = staleSince > STALE_THRESHOLD;
```

---

## Enums

Prefer `const` objects over `enum` for public API surfaces. `enum` emits runtime JavaScript;
`const` objects do not when using `verbatimModuleSyntax`.

```typescript
// ✅ — no runtime emission, fully tree-shakeable
export const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

// ❌ — emits a runtime object and bidirectional lookup table
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
}
```

Use `enum` only when you need auto-incrementing numeric values and a non-public API.

---

## Async Code

### Prefer `async`/`await` over raw `.then()` chains

```typescript
// ✅
async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new HttpError(response.status);
  return response.json() as Promise<User>;
}

// ❌
function getUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then((r) => {
    if (!r.ok) throw new HttpError(r.status);
    return r.json();
  });
}
```

### Parallelize independent async operations

```typescript
// ✅ — concurrent
const [user, posts] = await Promise.all([getUser(userId), getPosts(userId)]);

// ❌ — sequential, twice as slow
const user = await getUser(userId);
const posts = await getPosts(userId);
```

### Validate API response shapes at the boundary

Do not trust `response.json()`. Parse and validate at the network boundary.

```typescript
import { z } from "zod"; // or use valibot, arktype, etc.

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new HttpError(response.status, response.statusText);
  return UserSchema.parse(await response.json());
}
```

---

## Collections

### Use `Map` and `Set` over plain objects for dynamic keys

```typescript
// ✅
const cache = new Map<string, CacheEntry>();

// ❌ — untyped, no has/get/set API, prototype pollution risk
const cache: Record<string, CacheEntry> = {};
```

### Use `getOrInsert` for Map default values (TS 6)

```typescript
// ✅ TS 6
const counts = new Map<string, number>();
const current = counts.getOrInsert("key", 0);
counts.set("key", current + 1);

// ✅ getOrInsertComputed — lazy factory, avoids computing default when key exists
const arr = map.getOrInsertComputed("key", (k) => expensiveInit(k));

// ❌ verbose pre-TS6 pattern
if (!counts.has("key")) counts.set("key", 0);
counts.set("key", counts.get("key")! + 1);
```

> **Runtime note:** `Map.prototype.getOrInsert` and `getOrInsertComputed` shipped in
> Node.js 26 (May 2026). Types live in `esnext.collection`, included via `esnext` lib.
> Add `"esnext.collection"` to your `lib` array or use the polyfill on older runtimes.

### Prefer immutable operations on arrays

```typescript
// ✅ — non-mutating
const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
const updated = items.map((item) =>
  item.id === targetId ? { ...item, active: true } : item,
);

// ❌ — mutates the original
items.sort((a, b) => a.name.localeCompare(b.name));
items[index].active = true;
```

---

## Modules

### One export per file for classes and major types

```typescript
// user.ts
export class UserService { ... }

// user-repository.ts
export class UserRepository { ... }
```

Group closely related small utilities in a single file when they form a cohesive unit.

### Explicit public API via barrel files

For library packages, expose a single `src/index.ts` that re-exports only the public API.
Mark internal modules with `@internal` JSDoc. Do not export implementation details.

```typescript
// src/index.ts
export type { User, CreateUserInput } from "./types.js";
export { UserService } from "./user-service.js";
// NOT exported: InternalCache, dbClient, etc.
```

### Avoid circular imports

Circular imports cause initialization-order bugs. If a circular import is necessary, it
almost always signals a design issue — extract the shared dependency into a third module.

---

## Formatting (Prettier)

Formatting is handled exclusively by Prettier. Do not write ESLint rules that conflict with it.

Recommended `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

Run `prettier --check .` in CI. Run `prettier --write .` locally. Never commit unformatted code.

---

## Linting (ESLint flat config)

Use ESLint 9+ flat config (`eslint.config.ts`). The `tseslint.config()` helper is deprecated
as of typescript-eslint v8 — use `defineConfig` from `eslint/config` instead.

```typescript
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      // Enforces assertNever in switch default branches on discriminated unions
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  // Disable type-aware linting on plain JS files
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
```

Run `eslint .` in CI. Treat all errors as build failures.

---

## Testing

Use Vitest. Write tests in `*.test.ts` files co-located with source.

### Test structure

```typescript
import { describe, expect, it, vi } from "vitest";
import { computeTotal } from "./pricing.js";

describe("computeTotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(computeTotal([])).toBe(0);
  });

  it("sums all line item prices", () => {
    const items = [
      { id: "a", price: 10 },
      { id: "b", price: 25 },
    ];
    expect(computeTotal(items)).toBe(35);
  });

  it("throws on negative price", () => {
    expect(() => computeTotal([{ id: "x", price: -1 }])).toThrow(RangeError);
  });
});
```

### Rules

- Each test asserts one behavior. One `expect` per `it` when possible.
- Test names complete the sentence "it …": `it("returns the user by ID")`.
- Mock at the boundary (network, filesystem, time). Do not mock the module under test.
- Use `vi.spyOn` to observe calls without replacing behavior when the side effect matters.
- Never use `any` in test code. Type all mocks explicitly.
- Aim for 80% branch coverage on business logic. Do not measure lines.

### `vitest.config.ts` baseline

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { branches: 80, functions: 80 },
    },
  },
});
```

---

## ES2025 Standard Library

`lib: "ES2025"` ships these types in TS 6. Prefer them over third-party equivalents.

### Iterator helpers

Types live in `esnext.iterator` (included via `esnext` lib). Add `"esnext.iterator"` to your
`lib` array if you're not already using `"esnext"`.

```typescript
// ✅ — native Iterator methods (no lodash needed for simple pipelines)
const result = [1, 2, 3, 4, 5]
  .values()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 10)
  .toArray(); // [20, 40]

// Drop and take
const page = items.values().drop(offset).take(pageSize).toArray();
```

> **Runtime note:** Iterator helpers require Node.js 22+ (V8 12.2+).

### Set methods

Available in `lib: "ES2025"` — no extra lib entry needed.

```typescript
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

a.union(b); // Set {1, 2, 3, 4}
a.intersection(b); // Set {2, 3}
a.difference(b); // Set {1}
a.symmetricDifference(b); // Set {1, 4}
```

> **Runtime note:** Set methods require Node.js 22+.

### `RegExp.escape`

Available in `lib: "ES2025"`. Escapes special regex characters in a string literal.

```typescript
function matchWholeWord(word: string, text: string) {
  const escaped = RegExp.escape(word);
  const regex = new RegExp(`\\b${escaped}\\b`, "g");
  return text.match(regex);
}
```

> **Runtime note:** `RegExp.escape` is available in Chrome 144+, Firefox 139+, and
> Node.js 26+. Polyfill for older environments.

---

## Date and Time

Use the `Temporal` API for all new date/time code. `Date` is deprecated for new use.

**Required lib:** `"esnext.temporal"` (or `"esnext"`). Temporal types are NOT included in
`"ES2025"` — they live in `esnext.temporal` and are included by the `esnext` umbrella lib.

```typescript
// ✅ — Temporal (requires "esnext.temporal" in lib)
const now = Temporal.Now.plainDateTimeISO();
const deadline = Temporal.PlainDate.from("2026-12-31");
const daysLeft = now.toPlainDate().until(deadline).days;

// Using Duration arithmetic
const meeting = Temporal.PlainDateTime.from("2026-12-01T14:00:00");
const diff = now.until(meeting, { largestUnit: "hours" });
console.log(`${diff.hours} hours until meeting`);

// ❌ — Date for new code
const now = new Date();
```

> **Runtime support:** Temporal shipped natively in Firefox 139 (May 2025), Chrome 144
> (Jan 2026), and Node.js 26 (May 2026). Safari has not yet shipped it as of mid-2026.
> Use `temporal-polyfill` (fullcalendar/temporal-polyfill) for broader compatibility —
> `@js-temporal/polyfill` is alpha and has known incompatibilities with TS 6's type definitions.

---

## What Not to Do

These patterns are prohibited. ESLint or the compiler enforces most of them.

| Prohibited                                       | Reason                                          | Use instead                                                          |
| ------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| `any`                                            | Disables type checking                          | `unknown` + narrowing                                                |
| `!` non-null assertion (without comment)         | Hides null at runtime                           | Optional chaining, early return                                      |
| `// @ts-ignore`                                  | Silences the compiler                           | Fix the type; or `// @ts-expect-error` with explanation              |
| `as SomeType` without comment                    | Incorrect casts cause runtime crashes           | Type guard or parse at boundary                                      |
| `var`                                            | Function-scoped, hoists                         | `const` or `let`                                                     |
| `import ... assert {}`                           | Deprecated in TS 6 (errors)                     | `import ... with {}`                                                 |
| `baseUrl` in tsconfig                            | Deprecated in TS 6                              | `#/` subpath imports or explicit `paths` prefixes                    |
| `outFile`                                        | Removed in TS 6                                 | Bundler                                                              |
| `moduleResolution: "node"` / `"node10"`          | Deprecated in TS 6                              | `"bundler"` or `"nodenext"`                                          |
| `moduleResolution: "classic"`                    | Removed in TS 6 (hard error)                    | `"bundler"` or `"nodenext"`                                          |
| `module: "amd"` / `"umd"` / `"systemjs"`         | Removed in TS 6 (hard error)                    | ESM + bundler                                                        |
| `module Foo {}` namespace syntax                 | Removed in TS 6 (hard error)                    | `namespace Foo {}`                                                   |
| `target: "ES5"`                                  | Deprecated in TS 6                              | `"ES2022"` minimum; Babel for ES5 post-processing                    |
| `downlevelIteration`                             | Deprecated in TS 6 (ES5-only, meaningless)      | Remove entirely                                                      |
| `experimentalDecorators`                         | Replaced by TC39 native decorators              | Remove; use `Symbol.metadata`                                        |
| `reflect-metadata`                               | Replaced by native decorator metadata           | Remove                                                               |
| `switch` on union with no `default: assertNever` | Missing cases go undetected at compile time     | Add `assertNever` in `default`; enable `switch-exhaustiveness-check` |
| `"DOM.Iterable"` in `lib` array                  | Redundant — merged into `"DOM"` in TS 6         | Remove; use `"DOM"` only                                             |
| `lib: ["ES2025"]` for Temporal / `using`         | Temporal and `Symbol.dispose` are NOT in ES2025 | Add `"esnext.temporal"` and `"esnext.disposable"`                    |
| Mutating function arguments                      | Invisible side effects                          | Return a new value                                                   |
| `console.log` in production code                 | Use structured logging                          | `pino`, `winston`, or a structured logger                            |
| Circular imports                                 | Initialization bugs                             | Extract shared dependency                                            |
