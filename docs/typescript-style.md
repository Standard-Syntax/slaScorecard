---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TypeScript 6 Style, Patterns, and Project Structure

Companion to `typescript.md`. That file covers toolchain, compiler options, type safety
primitives, and the standard library. This file covers line length rationale, project
layout, type system patterns, code organisation principles, and complexity limits.
Nothing here repeats `typescript.md`.

---

## Line Length

**Hard limit: 100 characters.** Enforced by Prettier (`printWidth: 100`) and ESLint
(`max-len: 100`). No exceptions for production code; strings and template literals that
cannot wrap are the only practical exemption.

### Why 100, not 80 or 120

The 80-column rule descends from IBM punched cards and the DEC VT100 terminal — neither
of which any living developer has touched in production. It persists because it happens to
align with human reading research (optimal prose CPL is 45–95), but TypeScript identifiers
and type annotations eat horizontal budget faster than prose does. At 8 spaces of
indentation (class → method → conditional), a 80-char limit forces line breaks on
straightforward expressions.

120 goes the other direction: it permits deeply nested code to hide. A function that
wraps at 120 characters is almost never a function that should be 120 characters wide — it
is usually a function that should be split.

100 is the Google style guide limit, the JetBrains default for new TypeScript projects,
and the most common choice across the 60,000+ repositories that the `typescript-eslint`
team analysed when setting `strictTypeChecked` defaults. It fits two editor panes
side-by-side on a 1440p monitor, keeps diffs reviewable, and still allows fluent method
chains and long type annotations without forced mid-expression breaks.

### ESLint enforcement

```typescript
// In eslint.config.ts, add to your rules object:
"max-len": ["error", {
  code: 100,
  ignoreUrls: true,
  ignoreStrings: true,
  ignoreTemplateLiterals: true,
  ignoreRegExpLiterals: true,
  ignoreComments: false,
}],
```

Long strings, URLs, and template literals are exempted because auto-wrapping them changes
runtime behaviour. Comments are not exempted — a comment that exceeds 100 characters is
usually a comment that should be shorter.

### Wrapping conventions

Prefer breaking at operators and argument lists, not inside expressions:

```typescript
// ✅ — break at argument boundary
const result = await repository.findMany({
  where: { status: "active", tenantId },
  orderBy: { createdAt: "desc" },
  take: pageSize,
});

// ✅ — break at union boundary
type ApiResponse<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string; code: number };

// ❌ — mid-expression break is harder to read
const result = await repository.findMany({
  where: { status: "active", tenantId },
  orderBy: { createdAt: "desc" },
  take: pageSize,
});
```

---

## Project Structure

### The governing principle

Group by **feature boundary**, not by technical role. A developer who has never seen the
codebase should be able to locate any file in under 60 seconds using only directory
browsing. If they cannot, the structure is too clever.

Horizontal layers (`controllers/`, `services/`, `repositories/`) scatter a single feature
across the tree. Adding a billing feature requires touching four directories. Vertical
slices keep everything for one feature in one place; adding a feature means adding one
folder.

### Application (Node.js / web service)

```
src/
├── features/                  # One folder per bounded domain
│   ├── billing/
│   │   ├── index.ts           # Public API — the ONLY import surface for other modules
│   │   ├── commands/          # State-mutating operations
│   │   │   ├── create-subscription.ts
│   │   │   └── cancel-subscription.ts
│   │   ├── queries/           # Read operations
│   │   │   ├── get-subscription.ts
│   │   │   └── list-invoices.ts
│   │   ├── events/            # Domain events emitted by this module
│   │   │   └── subscription-created.event.ts
│   │   ├── internal/          # Implementation details — never imported externally
│   │   │   ├── stripe-client.ts
│   │   │   └── proration-calculator.ts
│   │   ├── db/
│   │   │   ├── billing.schema.ts
│   │   │   └── billing.repository.ts
│   │   └── billing.types.ts
│   │
│   └── identity/
│       ├── index.ts
│       ├── commands/
│       ├── queries/
│       └── identity.types.ts
│
├── shared/                    # Genuinely cross-cutting: no business logic
│   ├── db.ts                  # Database client singleton
│   ├── logger.ts              # Structured logger instance
│   ├── errors.ts              # Base error classes
│   ├── result.ts              # Result<T, E> type and helpers (if used)
│   └── middleware/
│       ├── auth.ts
│       └── rate-limit.ts
│
├── config/                    # Environment validation (Zod / Pydantic-style)
│   └── env.ts
│
└── main.ts                    # Composition root — wires everything together
```

### Web app (React / Next.js)

```
src/
├── features/                  # Domain-specific composites (have data dependencies)
│   ├── users/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   └── UserCard.tsx
│   │   ├── hooks/
│   │   │   └── use-user.ts
│   │   ├── api/
│   │   │   └── user-client.ts
│   │   └── users.types.ts
│   └── orders/
│       ├── index.ts
│       └── ...
│
├── ui/                        # Design system atoms — dumb, no data fetching
│   ├── button.tsx
│   ├── input.tsx
│   └── modal.tsx
│
├── lib/                       # Pure utilities — no React, no framework deps
│   ├── format.ts
│   └── validators.ts
│
├── hooks/                     # Truly global hooks (auth state, theme, i18n)
├── stores/                    # Global state (Zustand, Jotai)
├── types/                     # Shared domain types used across features
│   ├── api.ts
│   └── domain.ts
│
└── app/                       # Routing and layout (Next.js App Router / Remix)
```

### Monorepo

```
├── apps/                      # Deployable applications — consumers
│   ├── web/
│   └── api/
│
├── packages/                  # Published or shareable libraries — providers
│   ├── ui/                    # Design system
│   ├── contracts/             # Shared schemas and API types
│   └── config/                # Shared ESLint / TSConfig / Vitest presets
│
└── shared/                    # Imported via path alias, never published
    ├── domain/                # Domain models shared by web + api
    └── utils/                 # Pure functions
```

Dependency direction is strict and one-way: `shared → packages → apps`. An `apps/`
package MUST NOT be imported by another `apps/` package. A `packages/` package MUST NOT
import from `apps/`. Enforce with `eslint-plugin-boundaries` or Nx module constraints.

### Rules for every structure

- Every feature/module exposes exactly one `index.ts`. External code imports only from
  that file, never from `internal/` or `db/` subdirectories.
- Tests live next to the file they test: `user-service.test.ts` beside `user-service.ts`.
  Do not create a top-level `tests/` mirror of `src/`.
- `shared/` contains cross-cutting technical concerns only. Business logic that appears in
  two features should stay duplicated until a stable pattern is confirmed; premature
  abstraction into `shared/` creates hidden coupling.
- A feature module MUST NOT import from another feature module's internals. If module A
  needs data from module B, it calls B's public API (`billing/index.ts`), not
  `billing/internal/stripe-client.ts`.

### `ARCHITECTURE.md` — required artifact

Every repository MUST include an `ARCHITECTURE.md` at the root. It MUST document:

1. The top-level directory structure with a one-line description of each folder's purpose.
2. The dependency direction rule (which layer may import from which).
3. How to add a new feature (step-by-step, referencing the folder conventions above).
4. Any bounded contexts, domain boundaries, or team ownership assignments.

One paragraph per section. It does not need to be long — it needs to be accurate and
maintained alongside code changes.

### Enforcing boundaries with `eslint-plugin-boundaries`

```typescript
// eslint.config.ts — add alongside the existing config
import boundaries from "eslint-plugin-boundaries";

// In your defineConfig(...) call:
{
  plugins: { boundaries },
  settings: {
    "boundaries/elements": [
      { type: "shared",   pattern: "src/shared/**" },
      { type: "feature",  pattern: "src/features/**" },
      { type: "app",      pattern: "src/app/**" },
    ],
  },
  rules: {
    "boundaries/no-unknown": "error",
    "boundaries/element-types": ["error", {
      default: "disallow",
      rules: [
        // features may import from shared
        { from: "feature", allow: ["shared"] },
        // app may import from features and shared
        { from: "app",     allow: ["feature", "shared"] },
        // features MUST NOT import from other features
        { from: "feature", allow: [], disallow: ["feature"] },
      ],
    }],
  },
}
```

---

## Compiler Flags Not in `typescript.md`

Two additional strict flags belong in every project `tsconfig.json`:

### `noImplicitOverride: true`

Requires explicit `override` keyword when a subclass method shadows a base class method.
Without it, renaming a base class method silently orphans the subclass override.

```typescript
class Base {
  greet(): string {
    return "Hello";
  }
}

// ❌ — TS 6 with noImplicitOverride: error if Base.greet is renamed
class Child extends Base {
  greet(): string {
    return "Hi";
  }
}

// ✅ — override is explicit; rename of Base.greet causes a compile error
class Child extends Base {
  override greet(): string {
    return "Hi";
  }
}
```

### `isolatedModules: true`

Ensures every file can be transpiled independently by Vite, esbuild, Babel, or SWC
without full type information. Required when using any build tool other than `tsc` alone.
Catches patterns that break fast transpilers:

```typescript
// ❌ — const enum cannot be erased by isolatedModules transpilers
const enum Direction {
  Up,
  Down,
}

// ✅ — use a regular enum or a const object (see typescript.md § Enums)
const Direction = { Up: 0, Down: 1 } as const;
```

Add both to your baseline `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "noImplicitOverride": true,
    "isolatedModules": true,
  },
}
```

---

## File Size and Complexity Limits

### The core principle: cohesion first, line count second

Line count is a _symptom_, not a cause. A 600-line file implementing one well-bounded
algorithm is fine. A 200-line file that imports from billing, auth, analytics, and HTTP
helpers is already wrong. The question to ask is never "how many lines?" but "does
everything in this file belong together?"

That said, line count is a reliable _proxy_ for cohesion loss. SonarSource data across
200,000+ real-world classes shows that files over 400 lines contain 3.2× more bugs per
line than files under 200 lines. The growth in defect density is not linear — it
accelerates as files grow, because each new line in a large file is more likely to interact
with unrelated concerns already present.

The limits below are early-warning thresholds, not bureaucratic caps. When a limit fires,
ask "what should be extracted?" not "how do I silence the lint rule?".

---

### File length

**Target: under 200 lines. Warning at 300. Hard review required above 400.**

These three bands map to different actions:

| Band                   | Lines (source only) | Action                                                               |
| ---------------------- | ------------------- | -------------------------------------------------------------------- |
| Healthy                | < 200               | No action                                                            |
| Watch                  | 200–300             | Monitor; no action unless cohesion is slipping                       |
| Warning                | 300–400             | Identify what can be extracted; add a `// TODO: split` if blocked    |
| Requires justification | > 400               | File MUST either be split or have a documented exception (see below) |

ESLint enforcement — warn at 300, which prompts review before the 400 hard zone:

```typescript
"max-lines": ["warn", {
  max: 300,
  skipBlankLines: true,
  skipComments: true,
}],
```

#### Why 300 and not 200 or 500?

- **200** is the right _target_ but too strict as a lint error. Legitimate non-trivial
  modules (a repository with 15 methods, a complex validator, a multi-step transformer)
  regularly reach 200–300 lines while still being perfectly cohesive.
- **500** is widely cited as a maximum in older style guides but the empirical data
  (SonarSource, CodeScene) shows the defect-density inflection happens at 400, not 500.
  Waiting until 500 means the file is already problematic.
- **300** as the warning threshold catches files before they cross the 400 inflection point
  and prompts the split conversation while the code is still tractable.

---

### When a file exceeds 400 lines — the split decision

Before splitting, answer these four questions:

1. **Does the file have more than one reason to change?** List every distinct
   responsibility. If there are more than two, it is a split candidate regardless of size.
2. **Do functions A, B, and C always change together?** If a typical change touches 60%+
   of the functions, splitting adds import overhead with no coordination benefit.
3. **Who owns this file?** A file edited by one person rarely has the coordination cost
   that large files impose on teams. A file touched by three or more people weekly is
   actively generating merge conflicts.
4. **Is there a natural seam?** If you cannot name the extracted module clearly, the
   seam may not exist yet. Duplication or further design work may come first.

If the answer to question 1 is "yes" and question 4 has a clean answer, split. If
question 1 is "no" (genuinely one cohesion unit), document it as an exception.

#### How to split: find the seam, not the line count

Extract by _responsibility_, not by reaching a line target. Common seams in TypeScript:

```
// ❌ — splitting by line count, not by concept
// user-service-part1.ts (lines 1–300)
// user-service-part2.ts (lines 301–600)

// ✅ — splitting by responsibility
// user-service.ts         — orchestration: findUser, createUser, deleteUser
// user-validator.ts       — validation logic: validateEmail, validateRole
// user-formatter.ts       — presentation: toDisplayName, toApiResponse
// user-repository.ts      — persistence: findById, save, delete
```

Each extracted file should have a name that makes its purpose immediately obvious. If you
cannot name it without "and" or "or", the split boundary is wrong.

---

### Legitimate exceptions to the 400-line limit

Some file categories are exempt from the size limit. Add an `eslint-disable` comment with
a reason when disabling for these:

```typescript
/* eslint-disable max-lines -- generated Prisma schema types, do not hand-edit */
```

| Exception category                                       | Reason                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Generated code (Prisma, GraphQL codegen, OpenAPI client) | Machines write it; humans never maintain it line-by-line                    |
| Database migration files                                 | Represent a single atomic schema change; splitting is unsafe                |
| Comprehensive test fixtures                              | Test data for one domain; splitting creates false modularity                |
| Single-algorithm implementations                         | One coherent algorithm that cannot be decomposed without losing correctness |
| Config/schema files (Zod schemas, tsconfig)              | Declarative; complexity is data, not logic                                  |

Never disable `max-lines` without a comment. The comment makes the exception visible
in code review and searchable when auditing technical debt.

---

### God file detection checklist

A god file is identified by _responsibility count_, not line count. Run this checklist
when reviewing any file over 200 lines:

- [ ] The file imports from more than 4 unrelated domain namespaces
      (e.g., billing + auth + analytics + email in one file)
- [ ] The file contains both route handlers and business logic
- [ ] The file contains both data-fetching and presentation/formatting
- [ ] The file exports more than one primary entity (class, service, or major type group)
- [ ] A change to one responsibility frequently causes merge conflicts with changes to another
- [ ] Naming the file requires "and": `user-and-auth-and-email-service.ts`
- [ ] The file has more than 5 `import` groups from different parts of the codebase

Two or more checked boxes = god file. Split by responsibility, not by line count.

---

### Function length ≤ 50 lines

A function longer than 50 lines is almost always doing more than one thing. 50 lines is
the upper boundary of what fits in a typical editor viewport — once a function exceeds
screen height, the reader cannot hold its full context in working memory simultaneously.

The limit excludes blank lines and comments (these are communication, not complexity).
`IIFEs: false` means immediately-invoked function expressions inside module scope are
not counted separately — they are counted as part of their enclosing file instead.

```typescript
"max-lines-per-function": ["warn", {
  max: 50,
  skipBlankLines: true,
  skipComments: true,
  IIFEs: false,
}],
```

When a function approaches 50 lines, look for these extraction opportunities:

- A block of lines that could be named (extract to a helper with a descriptive name)
- A conditional branch that has its own data flow (extract to a separate function)
- Validation logic mixed with business logic (extract validator)
- Formatting or serialisation mixed with computation (extract formatter)

The goal is not shorter functions per se — it is _functions where the name describes the
entire body_, so a reader can understand the caller without reading the callee.

---

### Cyclomatic complexity ≤ 10

Each `if`, `for`, `while`, `switch case`, `&&`, `||`, and `??` adds 1 to cyclomatic
complexity. A function reaching 10 has 10 independent execution paths — at minimum 10
test cases to achieve branch coverage. Functions with cyclomatic complexity above 10 are
empirically more defect-prone and significantly harder to test exhaustively.

```typescript
"complexity": ["error", { max: 10 }],
```

When a function hits this limit, look first for guard clauses that flatten nested `if`
chains, then for extracted sub-functions that handle one branch cleanly.

---

### Cognitive complexity ≤ 15

Cognitive complexity (SonarSource metric, confirmed at the default threshold of 15 by
peer-reviewed IEEE research) weights nested control flow more heavily than flat control
flow. A loop inside an `if` inside another loop scores higher than three sequential `if`
blocks. It more closely predicts "how hard is this to read?" than cyclomatic complexity.

SonarQube's own data shows that reducing methods from cognitive complexity > 15 to ≤ 15
eliminates a measurable fraction of downstream defects. The threshold is not arbitrary.

```typescript
"@typescript-eslint/cognitive-complexity": ["error", 15],
```

---

### Parameter count ≤ 3

Functions with more than three parameters are hard to call correctly (argument order is
easy to swap) and hard to test exhaustively (parameter combinations grow combinatorially).
Consolidate into a typed options object when you exceed this.

```typescript
"max-params": ["error", { max: 3 }],
```

```typescript
// ❌ — four positional parameters, easy to swap silently
function createUser(
  name: string,
  email: string,
  role: string,
  tenantId: string,
) {}

// ✅ — named options object; order is irrelevant at call sites; easy to extend
interface CreateUserOptions {
  name: string;
  email: string;
  role: string;
  tenantId: string;
}
function createUser(options: CreateUserOptions): Promise<User> {}
```

The options object pattern has a secondary benefit: adding a new parameter later is a
non-breaking change to existing call sites, because callers use named keys.

---

### Nesting depth ≤ 4

Deeply nested code forces the reader to track multiple open conditional scopes
simultaneously. Each level of nesting adds one frame to working memory. At four levels,
most readers lose track of which conditions are still active.

```typescript
"max-depth": ["error", { max: 4 }],
```

Use early returns (guard clauses), extracted helpers, or `Array` methods to flatten
nesting before reaching four levels. A nested ternary counts as nesting — prefer an
explicit `if`/`else` or a named helper.

---

### Complete ESLint size and complexity ruleset

All size and complexity rules in one block for `eslint.config.ts`:

```typescript
// Size and complexity — add inside your rules object
"max-lines": ["warn", {
  max: 300,
  skipBlankLines: true,
  skipComments: true,
}],
"max-lines-per-function": ["warn", {
  max: 50,
  skipBlankLines: true,
  skipComments: true,
  IIFEs: false,
}],
"complexity": ["error", { max: 10 }],
"@typescript-eslint/cognitive-complexity": ["error", 15],
"max-params": ["error", { max: 3 }],
"max-depth": ["error", { max: 4 }],
```

---

## `interface` vs `type` Alias

Use the right tool for the job. Default to `interface` for object shapes; use `type` for
everything else. Apply `@typescript-eslint/consistent-type-definitions` with `interface`
as the default.

### Decision rule

| Situation                                                              | Use         |
| ---------------------------------------------------------------------- | ----------- |
| Named object shape — an entity, DTO, service contract, component props | `interface` |
| Public API surface that consumers might need to extend or augment      | `interface` |
| Class `implements` target                                              | `interface` |
| Union type                                                             | `type`      |
| Discriminated union                                                    | `type`      |
| Tuple                                                                  | `type`      |
| Mapped type                                                            | `type`      |
| Conditional type                                                       | `type`      |
| Template literal type                                                  | `type`      |
| Branded / opaque primitive                                             | `type`      |
| Type alias for a primitive or function signature                       | `type`      |

### `interface` for object contracts

```typescript
// ✅ — interface: extends produces clear conflict errors; supports declaration merging
interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface AdminRepository extends UserRepository {
  findAll(): Promise<User[]>;
}
```

### `type` for computation and unions

```typescript
// ✅ — type: the only way to express these shapes
type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type NonEmptyArray<T> = [T, ...T[]];

type EventName = `on${Capitalize<string>}`;
```

### `interface` vs `&` for composition

Prefer `extends` over `&` when building object hierarchies. Interface `extends` checks for
property conflicts at declaration time and produces actionable errors. Intersection `&`
silently resolves property conflicts to `never`, which surfaces errors far from the source.

```typescript
interface A {
  id: string;
}
interface B {
  id: number;
}

// ✅ — caught immediately: "Types of property 'id' are incompatible"
interface C extends A, B {}

// ❌ — silently produces { id: never }, error appears at use sites
type C = A & B;
```

### ESLint enforcement

```typescript
// In your eslint.config.ts rules:
"@typescript-eslint/consistent-type-definitions": ["error", "interface"],
```

---

## Branded Types

TypeScript's structural type system assigns the same type to `UserId` and `OrderId` when
both are `string`. A branded type makes them nominally distinct at compile time with zero
runtime overhead.

### The pattern

```typescript
// Base brand utility — define once in shared/types.ts
type Brand<T, Tag extends string> = T & { readonly __brand: Tag };

// One line per domain primitive
type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;
type Cents = Brand<number, "Cents">;
type Slug = Brand<string, "Slug">;

// Smart constructor — the only way to produce a branded value
function asUserId(raw: string): UserId {
  return raw as UserId; // cast is internal to the constructor; callers never cast
}
```

```typescript
// ✅ — compiler catches the swap
function getOrder(userId: UserId, orderId: OrderId): Promise<Order> { ... }

const uid = asUserId("user-123");
const oid = asOrderId("order-456");

getOrder(uid, oid);  // ✅
getOrder(oid, uid);  // ❌ — "Argument of type 'OrderId' is not assignable to 'UserId'"
```

### When to brand

Brand a primitive when:

- Two values of the same underlying type are never interchangeable (IDs, monetary amounts,
  slugs, tokens, measurement units).
- A value must be validated or constructed before it can be used safely.

Do not brand a primitive when it is genuinely interchangeable with the base type (for
example, a `string` that represents a display label used uniformly everywhere).

### Brands with Zod at the boundary

If you validate with Zod, use `.brand<"Tag">()` — it attaches the brand to the parsed
output with no extra constructor:

```typescript
import { z } from "zod";

const UserIdSchema = z.string().uuid().brand<"UserId">();
type UserId = z.infer<typeof UserIdSchema>;

// At the network boundary:
const userId = UserIdSchema.parse(req.params.id); // UserId — branded and validated
```

---

## Generics — When and How

### Constrain first, infer second

Every generic should have an `extends` constraint unless it genuinely accepts any type.
An unconstrained `<T>` is a signal that `T` might not need to be generic at all.

```typescript
// ❌ — T is unconstrained; findById works for anything with an id?
function findById<T>(items: T[], id: string): T | undefined {
  return items.find((item) => (item as any).id === id);
}

// ✅ — constrained: T must have an id
function findById<T extends { id: string }>(
  items: T[],
  id: string,
): T | undefined {
  return items.find((item) => item.id === id);
}
```

### Let the argument drive the type, not the caller

Structure generics so TypeScript can infer the type parameter from the call site argument.
Avoid requiring callers to annotate type arguments explicitly.

```typescript
// ❌ — caller must annotate: findFirst<User>(users, ...)
function findFirst<T>(
  items: T[],
  predicate: (item: T) => boolean,
): T | undefined {
  return items.find(predicate);
}

// ✅ — T is inferred from the items array
// findFirst(users, u => u.active) infers T as User
```

### When NOT to use generics

Generics add cognitive cost. Skip them when:

- A concrete union type covers all real call sites.
- The generic parameter appears in only one position (input or output, not both).
- The function always behaves identically regardless of the type.

```typescript
// ❌ — T only appears in one position; not a real generic
function wrap<T>(value: T): { value: T } {
  return { value };
}

// ✅ for this specific case — but only if callers actually need the literal type:
function wrap<const T>(value: T): { value: T } {
  return { value };
}
// Otherwise, just type it concretely if callers always pass the same shape.
```

### Prefer built-in utility types over raw mapped types for common operations

```typescript
// ✅ — built-in utility types are readable and well-understood
type PartialUser = Partial<User>;
type ReadonlyUser = Readonly<User>;
type UserIdFields = Pick<User, "id" | "email">;
type UserWithoutPw = Omit<User, "password">;

// ❌ — rolling your own when a utility type exists
type UserWithoutPw = {
  [K in keyof User as K extends "password" ? never : K]: User[K];
};
```

Use mapped and conditional types when the built-ins are insufficient. Always add a comment
explaining the intent of any type that requires more than 10 seconds to parse.

### Document complex generics with JSDoc

```typescript
/**
 * Extracts the resolved value type from a Promise.
 * @example
 *   type T = Awaited<Promise<string>>; // string
 */
type Awaited<T> = T extends Promise<infer U> ? U : T;
```

---

## JSDoc — When Required

Documentation is load-bearing when a reader cannot understand the intent from the types
and names alone. It is noise when it restates what the signature already says.

### Always document

- Every exported function, class, and type in a library package's public API.
- Functions with non-obvious preconditions, side effects, or performance characteristics.
- Any `// @ts-expect-error` or intentional type assertion — the comment must explain why.
- Complex generic types (see example above).
- Module-level `index.ts` files — one sentence describing what the module provides.

### Never document

- A function whose name and types tell the whole story:
  ```typescript
  // ❌ — redundant
  /** Returns the length of an array. */
  function length<T>(arr: T[]): number {
    return arr.length;
  }
  ```
- Internal implementation details that change frequently.
- Re-exports in barrel files (document the origin, not the re-export).

### Format

Use TSDoc-compatible JSDoc (compatible with TypeDoc, VS Code hover, and AI tooling):

```typescript
/**
 * Finds the first item in `items` that matches `predicate`.
 *
 * Returns `undefined` if no match is found. Does not mutate `items`.
 *
 * @param items - The collection to search. Must be non-empty in practice;
 *   an empty array always returns `undefined`.
 * @param predicate - Called for each element until it returns `true`.
 * @returns The first matching element, or `undefined`.
 *
 * @example
 *   const user = findFirst(users, (u) => u.email === "alice@example.com");
 */
export function findFirst<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): T | undefined {
  return items.find(predicate);
}
```

Required tags: `@param`, `@returns`, `@example` for any public API function.
Optional: `@throws` when the function throws on invalid input, `@deprecated` with a
migration note, `@see` for related functions.

---

## Single Responsibility

Each file, function, and module should have one reason to change.

### Functions: one level of abstraction

A function mixes abstraction levels when it contains both high-level orchestration and
low-level implementation details in the same body. Extract the low-level pieces:

```typescript
// ❌ — orchestration and string manipulation in the same function
async function processOrder(orderId: OrderId): Promise<void> {
  const order = await db.orders.findById(orderId);
  if (!order) throw new NotFoundError("Order", orderId);

  const lines = order.lineItems
    .map(
      (li) =>
        `${li.qty}x ${li.name.trim().toLowerCase()} @ $${li.price.toFixed(2)}`,
    )
    .join("\n");

  await email.send({
    to: order.customer.email,
    subject: `Order ${orderId} confirmed`,
    body: lines,
  });
}

// ✅ — each function handles one abstraction level
function formatLineItem(li: LineItem): string {
  return `${li.qty}x ${li.name.trim().toLowerCase()} @ $${li.price.toFixed(2)}`;
}

function formatOrderBody(order: Order): string {
  return order.lineItems.map(formatLineItem).join("\n");
}

async function processOrder(orderId: OrderId): Promise<void> {
  const order = await db.orders.findById(orderId);
  if (!order) throw new NotFoundError("Order", orderId);
  await email.send({
    to: order.customer.email,
    subject: `Order ${orderId} confirmed`,
    body: formatOrderBody(order),
  });
}
```

### Modules: one domain per file

A module that imports from many unrelated domains (billing + auth + logging + analytics in
one file) is a sign it has grown beyond a single responsibility. The file's imports should
read like a coherent domain vocabulary.

### Avoid flag parameters

A boolean flag that switches between two behaviors is a signal that two functions are
hiding inside one:

```typescript
// ❌ — two behaviors behind a flag
function getUsers(includeInactive: boolean): Promise<User[]> { ... }

// ✅ — two explicit, discoverable functions
function getActiveUsers(): Promise<User[]> { ... }
function getAllUsers(): Promise<User[]> { ... }
```

---

## Code Cohesion and Dependency Direction

### High cohesion within a module

Everything inside a module should serve the same purpose. If you add a class to a file and
find yourself reaching for imports from four different other domains, the class belongs in
its own module.

### Dependency direction

Dependencies MUST flow in one direction only:

```
domain types / value objects
        ↓
  shared utilities
        ↓
   feature modules
        ↓
     entry points (main.ts, routes, handlers)
```

A lower layer MUST NOT import from a higher layer. Domain types MUST NOT import from HTTP
handlers. Shared utilities MUST NOT import from feature modules.

Use ESLint `no-restricted-imports` or `eslint-plugin-boundaries` to enforce this at lint
time. A violation in code review is an architectural smell, not a style preference.

### Prefer composition over inheritance

Inheritance couples the child class permanently to the parent's implementation. Prefer
composing behaviour through interfaces, dependency injection, and function composition:

```typescript
// ❌ — UserService inherits BaseService for retry logic
class UserService extends BaseService {
  async findUser(id: UserId) { ... }
}

// ✅ — retry logic is injected as a dependency
interface RetryPolicy {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

class UserService {
  constructor(
    private readonly db: UserRepository,
    private readonly retry: RetryPolicy,
  ) {}

  async findUser(id: UserId) {
    return this.retry.execute(() => this.db.findById(id));
  }
}
```

---

## Immutability by Default

Prefer immutable data structures. Mutability should be explicit and justified.

### `readonly` on all object properties that should not change

```typescript
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
  readonly retries: number;
}

// For arrays and tuples:
function process(items: readonly string[]): void { ... }
```

### `as const` for literal objects and arrays

```typescript
const SUPPORTED_LOCALES = ["en", "fr", "de"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number]; // "en" | "fr" | "de"
```

### Use `ReadonlyMap` and `ReadonlySet` for read-only collections

```typescript
function getPermissions(role: Role): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS.get(role) ?? new Set();
}
```

---

## Return Type Annotations

Explicit return type annotations are required for:

- Every exported function and method.
- Any function whose return type is not immediately obvious from a one-line glance.
- Async functions (prevents accidentally returning `Promise<void>` when `Promise<User>`
  was intended).
- Overloaded functions.

Inference is acceptable for:

- Short private helper functions where the return type is obvious.
- Arrow functions used inline as callbacks.

```typescript
// ✅ — explicit return type on exported function
export async function getUser(id: UserId): Promise<User | null> {
  return db.users.findById(id);
}

// ✅ — inference acceptable here; type is obvious
const double = (n: number) => n * 2;

// ❌ — inferred return type on a complex exported function is a maintenance hazard
export function buildQueryString(params: Record<string, string>) {
  // ... 20 lines ...
}
```

ESLint rule to enforce this on exported functions:

```typescript
"@typescript-eslint/explicit-module-boundary-types": ["error", {
  allowArgumentsExplicitlyTypedAsAny: false,
  allowDirectConstAssertionInArrowFunctions: true,
  allowHigherOrderFunctions: false,
  allowTypedFunctionExpressions: true,
}],
```
