# Workspace Rules & Guidelines

## Implementation Plan & Execution Control
- **Always Require Plan Approval**: For non-trivial code changes, major features, or multi-step tasks, always create or update an implementation plan (`implementation_plan.md`) with feedback requested (`RequestFeedback: true`).
- **Strict Stop & Wait**: Never execute changes or proceed automatically after proposing a plan. Stop immediately and wait for explicit user approval (or click of the "Proceed" button) before making any code modifications.

## Git & Workflow Guardrails
- **NEVER use or suggest `git rebase`**: Under no circumstances should `git rebase`, `git pull --rebase`, or any rebase operation be executed or recommended. Always use standard merging (`git merge`, `git pull --no-rebase`) or feature branches instead.

