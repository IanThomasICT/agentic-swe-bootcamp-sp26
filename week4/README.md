# Week 4 — Skills & Codebase Auditing

Part of the [Agentic SWE Bootcamp (Spring 2026)](../README.md). This week focused on **Agent Skills** — authoring reusable skills and deriving new ones from a live working session.

## What we did

1. **Built a `commit` skill** — codified our git commit workflow as a reusable skill at [`../.agents/skills/commit/`](../.agents/skills/commit/). Demonstrates how recurring agent behavior gets promoted to a named, invokable skill with its own `SKILL.md`.

2. **Derived a skill from a session** — audited the [`speakslice`](speakslice/) codebase for bugs and missing features, then extracted the audit workflow into a reusable `todo-sync` skill at [`speakslice/.agents/skills/todo-sync/`](speakslice/.agents/skills/todo-sync/).

## The speakslice audit

`speakslice` is a real-world audio transcription / speaker-diarization app (Bun + TypeScript server, Python ASR pipeline, YouTube ingestion). We used it as an audit target because it has real bugs and documented-but-unbuilt features.

## Why this matters

The bootcamp exists to teach agentic software engineering — getting agents to do real work on real codebases, not toy demos. Skills are the mechanism by which one-off agent behavior becomes repeatable team infrastructure:

- `commit` → every commit on the project follows the same shape.
- `todo-sync` → any codebase can be audited with the same disciplined FIXME/TODO distinction.

Read [`todo-sync/SKILL.md`](speakslice/.agents/skills/todo-sync/SKILL.md) to see the extracted workflow, and [`ISSUES.md`](speakslice/ISSUES.md) to see the audit output it produced.

## Try it

```bash
cd speakslice
cat ISSUES.md                  # the audit findings
cat agents/skills/todo-sync/SKILL.md   # the derived skill
```

Invoke `/todo-sync` in your Agent (with the skill installed) on any codebase to repeat the audit.
