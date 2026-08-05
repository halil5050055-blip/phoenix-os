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
