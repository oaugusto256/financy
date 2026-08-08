# <Domain> findings

**Agent:** <domain>
**Baseline:** `main` at `4348600`
**Date:** 2026-08-07

Every finding below uses this record. Fields are mandatory. A finding missing
`evidence` must set `confidence: hypothesis`.

---

## <domain>-01 — <one-line title>

- **severity:** high | medium | low
- **confidence:** verified | hypothesis
- **evidence:**
  - `path/to/file.ts:42` — what is on that line and why it matters
  - command: `rtk proxy "npm run lint"` → paste the relevant output lines
- **cost:** What this breaks now, or what it will break, concretely. Not "this
  is bad practice" — name the failure.
- **fix:** Sketch of the change. Which files. Effort: S (< 1 file, mechanical) |
  M (2–3 files) | L (4+ files, or changes a public contract).

---
