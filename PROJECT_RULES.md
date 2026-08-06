# Project Rules

These standards apply across Phoenix OS. Domain-specific rules may extend them in local documentation.

## General Standards

- Optimize for clarity, correctness, security, and maintainability.
- Keep changes focused; avoid unrelated refactors.
- Prefer simple solutions that can evolve over speculative complexity.
- Use English for source code, filenames, technical documentation, and commit messages unless a deliverable requires another language.
- Store configuration outside source code and provide safe example values where useful.

## Architecture

- Organize code by coherent domain or feature boundaries.
- Keep business logic independent of user interfaces and third-party services.
- Access external systems through explicit adapters or clients.
- Define inputs, outputs, errors, and ownership for public interfaces.
- Avoid circular dependencies and hidden global state.
- Document material architectural decisions in `docs/`.

## Coding Standards

- Follow the official formatter and linter for each language.
- Use descriptive names and small, single-purpose functions.
- Prefer explicit types and contracts at module boundaries.
- Handle errors deliberately; never silently discard failures.
- Validate untrusted input and encode output for its destination.
- Add comments to explain intent or tradeoffs, not obvious syntax.
- Remove dead code instead of leaving commented-out implementations.

## Testing and Quality

- Add or update tests for behavior changes and bug fixes.
- Cover normal behavior, important edge cases, and expected failures.
- Keep tests deterministic and independent of production data.
- Run the most relevant available checks before considering work complete.
- Never report a check as passing unless it was actually run successfully.

## Autonomous Tooling

- Work autonomously through safe, in-scope repository tasks and use non-interactive commands.
- Do not request confirmation for ordinary read-only checks or scoped implementation steps. Keep required safety checks and obtain authorization only when a destructive, privileged, or externally consequential action requires it.
- Complete work locally by default. Do not use the GitHub API or CLI, Railway CLI, browser automation, Docker Desktop, interactive editors, or other interactive tooling.
- Do not run `npm audit`, `npm fund`, or `npm outdated` unless the user explicitly requests that exact check in the current task.
- Use an already-running container daemon when available, but never launch or ask to launch Docker Desktop or another desktop container runtime. If no daemon is available, report the image build as unverified and continue with other checks.
- Skip optional network operations automatically. When delivery or production verification requires an external service or approval-gated command, stop at the last successful local step and report exactly what remains instead of requesting approval.

## Security and Privacy

- Never commit secrets, credentials, private keys, or production environment files.
- Use environment variables or an approved secret manager for sensitive configuration.
- Apply least-privilege access to services and data.
- Minimize collection and retention of personal or confidential information.
- Sanitize logs and errors so sensitive values are not exposed.
- Review dependencies and pin versions where reproducibility or security requires it.

## Documentation and Memory

- Keep `README.md` focused on project orientation and setup.
- Put durable technical documentation in `docs/`.
- Put decisions and continuity context in `memory/`.
- Keep reusable operating material in `prompts/` and `templates/`.
- Track work in `TODO.md` and detailed execution records in `tasks/`.
- Update documentation in the same change as implementation.

## Git Conventions

- Use small, coherent commits with imperative, descriptive messages.
- Do not commit generated output, local configuration, caches, or dependencies unless explicitly required.
- Preserve existing work and resolve conflicts intentionally.
- Review staged changes before committing.
- Do not rewrite shared history without explicit authorization.

## Naming

- Use lowercase kebab-case for documentation and general asset filenames unless an ecosystem convention requires otherwise.
- Follow language and framework conventions for source filenames and symbols.
- Name environment variables in uppercase snake case.
- Use ISO 8601 dates (`YYYY-MM-DD`) in filenames and records.

## Completion Checklist

- Requested behavior is present.
- Relevant tests and quality checks pass.
- Security and privacy implications were considered.
- Documentation and memory are current.
- No secrets, debug artifacts, or unrelated changes are included.
- Remaining risks or follow-up work are recorded.

# Policy Precedence

When instructions conflict, apply them in the following order:

1. PROJECT_RULES.md
2. AGENTS.md
3. Project documentation
4. Roadmap and TODO
5. Session instructions

Lower-priority instructions must never override higher-priority policies.

If a conflict cannot be resolved safely, stop and report the conflict.


# Policy Change Rule

Engineering policies are intentionally stable.

Do not create, modify or expand repository-wide engineering policies during normal implementation work.

Policy changes are allowed only when:

- a recurring implementation problem has been observed;
- existing policies demonstrably fail to address it;
- the proposed change is minimal;
- the expected benefit exceeds the additional complexity.

All permanent policy changes require an ADR or explicit owner approval.


# Complexity Budget

Every permanent increase in architectural complexity must provide measurable long-term value.

Whenever practical:

- remove more complexity than you add;
- prefer composition over expansion;
- prefer deletion over accumulation;
- prefer stable abstractions over additional features.

Complexity is a permanent engineering cost.

Business value is the justification for paying it.


# Implementation Priority Policy

Purpose

Maximize delivered product value while maintaining engineering quality.

Priority order:

1. Executable application functionality.
2. Infrastructure, testing, security, observability and quality.
3. Documentation required to implement or operate completed functionality.
4. Strategic documentation, templates and planning artifacts.

When multiple valid milestones exist, select the highest-priority milestone according to this order.

Explicit owner instructions take precedence over automatically selected roadmap work.

Documentation should enable implementation rather than indefinitely precede it.

Create documentation ahead of implementation only when it materially reduces implementation risk, ambiguity, coordination cost or architectural uncertainty.

If executable functionality is not blocked by missing documentation, prefer implementation.

When deviating from roadmap order, explain the reason in the completion report and identify the deferred milestone.


# Phoenix BOS Engineering Policies

Version: 1.0

Status: Frozen

This engineering policy set is considered complete.

Repository-wide engineering policies must remain stable.

New permanent policies require explicit owner approval or an approved ADR and may be introduced only after repeated implementation experience demonstrates that:

- a recurring engineering problem exists;
- existing policies are insufficient;
- the proposed policy is minimal;
- its long-term benefit exceeds its maintenance cost.

Until then:

Improve the product rather than the policy.
