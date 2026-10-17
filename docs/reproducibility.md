# Reproduce a reviewed Agentyx harness

Agentyx reproducibility is a project-local contract. It lets another checkout verify the same
resolved harness and restore a narrowly permitted missing Skill from the same inputs.

## What to commit

Commit these files together:

- `package.json`, with an **exact** `@agentyx/cli` development dependency;
- your package-manager lockfile (for pnpm, `pnpm-lock.yaml`);
- `.agentyx.json`, the desired harness;
- `.agentyx.lock.json`, Agentyx's ownership records and reviewed resolution snapshot;
- selected project-local Skill sources, local pack definitions, and any referenced local assets.

`package.json` selects the CLI version. The package-manager lockfile pins that package and its
dependency graph. The Agentyx lock is not a dependency lockfile: it records which outputs Agentyx
owns and a provider-neutral snapshot of the resolved harness. The config expresses desired state.
The snapshot stores hashes and metadata, not local Skill source bodies. Commit project-owned sources
so a fresh checkout can resolve them again.

Pin an exact version when adding the CLI (substitute the chosen version):

```sh
pnpm add --save-dev --save-exact @agentyx/cli@<exact-version>
```

The version must be the one recorded by the committed snapshot. `pnpm dlx` is convenient for trying
Agentyx, but it can select a different CLI on a later run. Use the project-local `pnpm exec agentyx`
for every locked, frozen, migration, or other reproducibility workflow below.

## Create or intentionally change a lock

For a new project, add the exact CLI dependency, then create and review the desired configuration
and installed plan:

```sh
pnpm exec agentyx init --pack technical --target codex --yes
pnpm exec agentyx sync --dry-run
pnpm exec agentyx sync
pnpm exec agentyx doctor --locked --check
```

Review and commit `.agentyx.json`, `.agentyx.lock.json`, `package.json`, the package-manager lockfile,
and any selected local sources. For an intentional configuration change, edit the config (or use
`pnpm exec agentyx configure ...`), review `sync --dry-run`, run normal `sync`, then run
`doctor --locked --check` and commit the new config and lock. Normal sync establishes a newly
reviewed locked state. Frozen mode never approves a change.

## Fresh checkout

The checkout must already contain the files and sources listed above. Run:

```sh
pnpm install --frozen-lockfile
pnpm exec agentyx install --frozen
pnpm exec agentyx doctor --locked --check
```

The package-manager command restores the pinned CLI and dependency graph without changing its
lockfile. `install --frozen` checks the config, selected sources, and exact CLI version against the
reviewed snapshot. It may restore an absent Skill file already owned by the lock. It is not general
convergence: it does not update, delete, adopt, or overwrite managed content. The final Doctor
command checks both the locked comparison and ordinary Doctor warnings and errors.

Ownership and resolution are separate. Lock `entries` authorize Agentyx ownership operations on
recorded provider outputs. `resolution` records the reviewed provider-neutral harness. A capability
in `resolution` does not authorize overwriting or deleting a file. A locked comparison can be
`matching` while ordinary installation readiness is `not-ready`, for example when an owned Skill
output is absent. Matching means the current inputs match the snapshot, not that every installed
output is present.

## Upgrade the CLI

The CLI version is part of the snapshot. To upgrade intentionally, select a new exact
`@agentyx/cli` version, update the package-manager lockfile, and install dependencies. Then use
normal reviewed convergence:

```sh
pnpm exec agentyx sync --dry-run
pnpm exec agentyx sync
pnpm exec agentyx doctor --locked --check
```

Review and commit both lockfiles and `package.json`. Do not use frozen mode to approve an upgrade or
edit `resolution.agentyxVersion` manually.

## Migrate a version-1 Agentyx lock

Version 1 records ownership only. Migrate through a reviewed full-project install, not by editing
the lock JSON:

```sh
pnpm exec agentyx install --migrate-lock --dry-run
pnpm exec agentyx install --migrate-lock
pnpm exec agentyx doctor --locked --check
```

The dry run previews the migration without writes. Existing unmanaged or edited content can still
conflict; migration does not adopt it. Doctor and uninstall can inspect/use a v1 lock before
migration.

## Recovery

- **Missing owned Skill output:** if the complete v2 lock still matches the config, selected source,
  and CLI version, `pnpm exec agentyx install --frozen` can restore that absent owned Skill. It does
  not restore Agent files, MCP or Hook config, tool executables, or missing source files.
- **Edited managed output:** frozen mode refuses to overwrite it; normal sync reports a conflict.
  Preserve and review the edit, then resolve the conflict through a reviewed normal workflow. Do
  not use blanket `--force` or delete provider configuration blindly; force is an explicit reviewed
  plan choice, not automatic recovery.
- **Missing local Skill source:** the lock stores hashes, not source bodies, and has no remote
  recovery. Restore the source from version control or another reviewed project copy, verify the
  locked comparison, then use frozen mode only if its managed output is also absent.
- **Config or selected-source mismatch:** if accidental, restore the reviewed inputs from version
  control. If intentional, run normal `sync --dry-run`, review, run normal `sync`, then verify and
  commit a new snapshot. Frozen mode never accepts the mismatch.
- **Missing lock or null snapshot:** create a complete reviewed state with normal config-based
  `sync` (or `install`), then verify it. A null snapshot can follow a partial/manual operation.
- **Stale ownership:** review the planned cleanup with normal `sync --dry-run`, then use normal sync
  according to the desired config.

## What is and is not reproduced

The snapshot records the exact Agentyx CLI version, desired config hash, selected targets, canonical
selected Skill content hashes and provenance, provider-neutral MCP/Tool/Hook/Agent definitions and
provenance. The ownership manifest records hashes of Agentyx-owned provider output. It excludes
secrets, environment values, and source bodies.

This is configuration and managed-output reproducibility, not a hermetic build. It does not pin or
guarantee provider CLI versions, model versions, provider runtime behavior, network availability,
authentication or authorization, OAuth state, external process behavior, or undocumented host
semantics. For example, if an MCP definition runs `npx -y @playwright/mcp@<version>`, Agentyx hashes
the definition string but does not independently hash the package artifact fetched from the npm
registry. An HTTP MCP definition can be locked while its remote server changes. Agentyx does not
fetch sources or contact remote MCP servers during frozen restore.
