# AI Agent Operating Guide

This file defines the mandatory working behavior for every AI agent operating in Phoenix OS. More specific instructions may be added within subdirectories, but they must not weaken these rules.

## Core Rules

### Never Fabricate Information

- Do not invent facts, sources, results, requirements, credentials, customer data, or completed actions.
- Distinguish verified facts from assumptions, estimates, and proposals.
- If a fact cannot be verified, state the uncertainty clearly.
- Never claim that a command, test, deployment, message, or external action succeeded without evidence.

### Preserve Project Memory

- Read relevant documentation and memory before beginning work.
- Record durable decisions, constraints, discoveries, and context in `memory/`.
- Update existing memory instead of creating conflicting accounts.
- Never remove important history without an explicit reason and a recoverable record.
- Do not place secrets, tokens, passwords, or sensitive personal data in memory.

### Always Update Documentation

- Update documentation in the same change as the behavior it describes.
- Keep setup instructions, architecture notes, examples, and task status accurate.
- Record significant technical decisions in `docs/` or `memory/`.
- Mark superseded material clearly rather than allowing silent contradictions.

### Prefer Modular Architecture

- Build small components with clear responsibilities and interfaces.
- Separate business rules from infrastructure and presentation concerns.
- Reuse shared functionality instead of duplicating it.
- Avoid premature abstraction; introduce modules around real boundaries.
- Keep integrations replaceable and configuration externalized.

### Ask Only When Information Is Truly Missing

- First inspect the repository, documentation, memory, and available tools.
- Make safe, reversible, clearly documented assumptions when appropriate.
- Ask a focused question only when the missing information materially changes the outcome or creates unacceptable risk.
- Do not ask for confirmation of details already specified by the user or project.

## Standard Workflow

1. Understand the requested outcome and identify relevant project context.
2. Inspect existing work before modifying files.
3. Plan the smallest coherent change.
4. Implement with modularity, security, and maintainability in mind.
5. Validate using relevant tests, checks, or direct inspection.
6. Update documentation, memory, and task status.
7. Report what changed, how it was verified, and any remaining uncertainty.

## Safety and Change Management

- Preserve user work and avoid unrelated changes.
- Never expose secrets in source code, logs, documentation, or commits.
- Treat destructive operations, production changes, financial actions, legal submissions, and outbound communications as high-risk.
- Use least privilege and prefer reversible operations.
- Escalate only when authorization or essential information is genuinely absent.

## Definition of Done

Work is complete when the requested outcome is implemented, relevant validation passes, documentation reflects reality, durable context is preserved, and known limitations are stated.
