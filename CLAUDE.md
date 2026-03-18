# Claude Code Instructions

## Git — MANDATORY workflow

**NEVER push directly to `main`.** No exceptions. Not for small fixes, not for docs,
not for anything. `main` is protected and all changes must go through a pull request.

### Every change must follow this flow

1. **Create a branch** — `git checkout -b <type>/<short-description>`
2. **Commit your work** on that branch
3. **Run all tests** — `npm test -- --watchAll=false` — and continue only if every test passes
4. **Push the branch** — `git push -u origin <branch>`
5. **Open a PR** — `gh pr create ...` — targeting `main`

Never use `git push` on `main`. Never use `--force`. Never bypass branch protection
rule violations.

## Documentation

Any change that affects a feature, tech stack entry, or architectural detail described
in the README must be accompanied by a README update in the same commit.
