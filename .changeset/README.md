# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one markdown file per
change that should appear in a release.

Add one whenever you touch a published package:

```sh
pnpm changeset
```

Pick the affected packages and the bump (patch / minor / major), then describe the change in one
sentence — it becomes the changelog entry. Docs-only and CI-only changes do not need a changeset.

All `@agnox/*` packages are versioned together (`fixed` in `config.json`), so a bump to one bumps
them all. On merge to `main`, the release workflow opens a version pull request; merging that
publishes to npm.
