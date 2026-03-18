# Claude Code Instructions

## Git

- **Never bypass branch protection rules.** Do not use `--force`, `--no-verify`, or any flag that bypasses rule violations on `main`.
- **Run all tests before pushing.** Execute `npm test -- --watchAll=false` and push only if every test passes.

## Documentation

- **Keep README in sync with the codebase.** Any change that affects a feature, tech stack entry, or architectural detail described in the README must be accompanied by a README update in the same commit.
