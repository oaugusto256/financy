# Architecture and gaps audit — design

**Date:** 2026-08-07
**Baseline:** `main` at `4348600`
**Branch:** `chore/architecture-audit`

## Purpose

Review the repository as an outside reviewer would: find architectural
weaknesses and the gaps a two-workspace monorepo accumulates, rank them by what
they actually cost, and hand the owner a triage list. The audit produces
findings. It does not fix anything until the owner approves a finding.

## Success criteria

- Every finding names a file and line, or is explicitly marked a hypothesis.
- Findings are deduplicated across domains and ranked in one table.
- No source file outside `docs/audits/` changes during the audit phase.
- The owner can read the ranked table and answer "fix / skip / later" per row
  without opening the codebase.

## Non-goals

- Rewriting any slice. The five slices are done; this is not slice six.
- Visual or Figma comparison. Figma is unreachable from the repo and remains
  the owner's job.
- Generic best-practice adoption. See the anti-boilerplate rule below.

## Approach

Four read-only agents run in parallel, one per domain. They share no state and
have no ordering dependency. Each writes exactly one findings file under
`docs/audits/findings/`. The main thread then merges, deduplicates and ranks.

```
                 ┌─ architecture  ─┐
   main thread ──┼─ security       ─┼──▶ merge + dedupe ──▶ ranked table ──▶ owner triage
   (dispatch)    ├─ tooling        ─┤     (main thread)      (one file)      (gate)
                 └─ testing        ─┘
```

### Why parallel agents rather than one pass

The four domains ask different questions of the same 237 files. Run
sequentially, each pass re-reads the same code to ask its own question. Run as
one agent, the domains blur and the weakest checklist gets the least attention.
Parallel agents also keep the raw file dumps out of the main thread's context,
which matters because the merge step needs room to hold all four findings sets
at once.

### Agents are read-only

Audit agents may write only their own file in `docs/audits/findings/`. They may
not edit source, config or specs. A fix that lands before the owner has seen
the finding removes the owner's decision, and an agent that starts fixing stops
auditing.

## Domain charters

Boundaries are drawn so overlap is predictable and the merge step knows where
duplicates will appear.

### 1. Architecture and boundaries

Module boundaries and layering inside `backend/src/modules/`; whether
`schema.ts` / `resolvers.ts` / `service.ts` / `validation.ts` hold their stated
responsibilities or leak into each other. Coupling between the two workspaces.
Duplication that has no owner — most visibly, zod validation exists in both
`backend/src/modules/*/validation.ts` and `frontend/src/features/*/validation.ts`
with no shared package to hold the rules. Dependency direction. Files that have
grown past the point of being understandable in one read.

### 2. Security and data integrity

Per-user scoping in the `where` clause of every query and mutation, and whether
a cross-user test asserting `NOT_FOUND` actually exists for each. JWT issuing,
verification and expiry. Token storage on the frontend. Absence of rate
limiting on the auth mutations. How money is represented, given SQLite has no
decimal type. Whether the two committed Prisma migrations still reconcile with
`schema.prisma`, or whether the schema has drifted ahead of them.

### 3. Tooling and repo hygiene

The manual gate. Nothing runs `test`, `typecheck`, `lint`, `format:check` or
`codegen:check` on push, and there is no pre-commit hook, so every green claim
is a local one. Node version is declared as `engines: >=20` with no pinning
file. Script duplication across the two workspace `package.json` files. Whether
the pinned majors called out in `CLAUDE.md` (`prisma` 6, `@apollo/server` 4,
`express` 4) are still pinned and still correct.

### 4. Testing and observability

Shape of the test pyramid across `backend/tests/unit`, `backend/tests/integration`
and the co-located frontend tests. Blind spots — behaviour with no test at all.
Drift between the MSW handlers in `frontend/src/test/msw/` and the real
`backend/schema.graphql`, which nothing currently compares. Absence of
structured logging and error reporting on the backend.

## Rules the agents work under

### Evidence

Every finding carries a `file:line` citation. Any claim resting on command
output must cite output from a command run as `rtk proxy "<cmd>"` — the RTK
hook filters output and has previously reported a pass for a command that
failed. A claim from a filtered run is not evidence.

A finding with neither a citation nor command output is tagged
`confidence: hypothesis` and ranks below every verified finding. It is not
discarded; it is flagged as needing verification before anyone acts on it.

### Anti-boilerplate

A finding must name a cost observed in this repository. "Monorepos should have
CI" is not admissible. "No CI, and two slice-2 tasks were sent back for
skipping `format:check`" is. Findings that recommend adopting a tool
(Turborepo, Nx, Docker, a monitoring vendor) are admissible only when the
finding first establishes the concrete problem the tool would solve here.

### Finding schema

Every agent emits the same record, so the merge is mechanical:

| Field | Meaning |
|---|---|
| `id` | `<domain>-NN`, e.g. `arch-03` |
| `severity` | high / medium / low |
| `confidence` | verified / hypothesis |
| `evidence` | `file:line` references, plus command output where relevant |
| `cost` | what it breaks now, or what it will break, concretely |
| `fix` | sketch of the change, plus effort S / M / L |

## Merge

The main thread owns the merge; no agent sees another agent's output. The
domains overlap by design and duplicates are expected in known places:
per-user `where`-clause scoping surfaces under both architecture and security;
MSW drift surfaces under both testing and boundaries; validation duplication
surfaces under both architecture and testing. Duplicates collapse into a single
row carrying the union of their evidence and the higher of their severities.

Output is one ranked table at `docs/audits/2026-08-07-findings.md`, ordered by
severity then by effort ascending, so the cheapest high-severity work sits at
the top.

## Spec drift is in scope

`docs/specs/backend.md` and `docs/specs/frontend.md` are the stated source of
truth, and `CLAUDE.md` requires the spec be corrected in the same PR when the
implementation proves it wrong. A divergence between spec and code is therefore
a finding. The finding must state which side is wrong — the code, or the spec —
rather than only noting they differ. Section 12 of `frontend.md` records
deliberate deviations; anything listed there is not a finding.

## Triage gate

The audit stops at the ranked table. The owner marks each row fix / skip /
later. Nothing is fixed before that.

## Fix phase

Work happens on `chore/architecture-audit`, branched from `main` at `4348600`,
never on `main` directly.

One commit per approved finding, Conventional Commits, English message. Each
commit runs the full gate before it lands — `test`, `typecheck`, `lint`,
`format:check`, and `codegen:check` in both workspaces — every command through
`rtk proxy`, because nothing on push will run them afterwards.

Any approved finding whose fix touches more than roughly three files is
re-planned on its own before code is written, rather than being folded into the
audit's fix list. Large architectural changes are their own piece of work and
deserve their own design.
