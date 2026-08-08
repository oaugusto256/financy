# Typing the MSW fixtures — plan

**Row:** 6 of `docs/audits/2026-08-07-findings.md` (source finding `test-03`)
**Severity:** high · **Effort:** L
**Branch to cut from:** `chore/architecture-audit` once merged, or `main`

This row was split out of the audit's fix loop because its effort is L: it
touches every frontend test file with an MSW handler. A change that wide gets
its own plan and its own review rather than being folded in beside eight small
fixes.

## The problem

`frontend/src/test/msw/api.ts` hand-writes GraphQL responses. Nothing compares
them to `backend/schema.graphql`.

- `msw`'s `GraphQLRequestHandler` is generic over `Query` and `Variables` and
  falls back to untyped defaults when no type argument is given.
- `grep -rn "api\.\(query\|mutation\)<" frontend/src` → **0** matches.
  The same grep with `(` → **105**.
- The schema-accurate generated types already exist —
  `frontend/src/graphql/generated/graphql.ts` exports `MeQuery` /
  `MeQueryVariables` and the equivalent for every operation — and no call site
  references them.
- `codegen:check -w @financy/frontend` diffs only `src/graphql/generated`
  against `graphql/operations/*.graphql`. It never reads `src/test/msw/api.ts`
  or any test file, so it gives the mocks zero protection.

Every mock matches the schema **today** — the audit compared them by hand and
found no live mismatch. Nothing enforces that going forward. Rename a field,
change a nullability, or rename an enum value and neither `typecheck`, `lint`
nor `codegen:check` fails on the test side: the mocks keep returning the old
shape and the frontend's green suite certifies a response the real backend can
no longer produce.

## Why this is not a mechanical find-and-replace

Two things make it more than adding a generic at 105 sites.

1. **The helpers are the real gap.** `ok` and `graphqlError` in
   `frontend/src/test/msw/api.ts:10-14` are bound as
   `T extends Record<string, unknown>`, which accepts anything. Typing the call
   sites while the helpers stay loose buys much less than it looks like —
   tighten the helpers first, or the generics are decorative.
2. **Some fixtures are deliberately partial.** A test that only cares about one
   field of a response should not be forced to construct a complete one. Decide
   the policy before touching 105 sites: either fixtures are complete and a
   builder supplies defaults, or the type is `DeepPartial` and the guarantee is
   weaker than it appears. Pick one and say which in the commit.

## Approach

1. **Tighten `ok` and `graphqlError` first**, in their own commit, and see what
   breaks. The breakage is the real inventory — it tells you which fixtures are
   partial and which are complete, which is the input to decision 2 above. Do
   not guess at that list up front.
2. **Decide the partial-fixture policy** from what step 1 surfaced. Record it in
   `frontend/src/test/msw/api.ts` as a comment, since the next person adding a
   handler needs to know it.
3. **Convert the call sites**, in batches by feature directory rather than all
   at once, so a review can follow it. A codemod is the realistic path — 105
   manual edits will drift. Write the codemod, run it per directory, and read
   the diff of each batch.
4. **Prove the guarantee holds.** Deliberately break one field's nullability in
   a copy of the schema, regenerate, and confirm `typecheck` now fails where it
   previously passed. Without this step the row is not closed — the whole point
   is a check that fires, and an untested check is the bug being fixed.

## Definition of done

- `grep -rn "api\.\(query\|mutation\)(" frontend/src` returns no call site
  without a type argument.
- `ok` and `graphqlError` no longer accept an arbitrary object.
- A schema change that contradicts a fixture fails `npm run verify` —
  demonstrated, not asserted.
- `npm run verify` passes on the branch head.
- The partial-fixture policy is written down where a handler author will see it.

## Explicitly out of scope

Fixing any mismatch this work uncovers. There are none today; if the typing
surfaces one, it is a new finding with its own row, not a silent fix folded into
a 105-file diff.
