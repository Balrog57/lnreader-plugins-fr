# LNReader French-only plugin repository design

## Goal

Create a public, independently maintained LNReader plugin repository at
`Balrog57/lnreader-plugins-fr`. Its published catalog must contain only French
plugins, including the fixes already present on `fix/french-plugins-2026`.

The local checkout lives at:

`C:\Users\Marc\Documents\1G1R\_Programmation\lnreader-plugins-fr`

## Repository contents

The `master` branch contains:

- standalone French plugins from `plugins/french`;
- only French source records from the shared multi-source generators;
- shared runtime, TypeScript types, build scripts, public assets, and package
  metadata required to compile those plugins;
- synchronization scripts and GitHub Actions workflows;
- tests that enforce the French-only publishing contract.

Language-specific plugin directories and multi-source records for other
languages are excluded. Files shared by every plugin are retained even when
they are not language-specific.

Plugins marked `.broken.ts` may remain in source history for repair, but are
excluded from the published catalog until they pass the same live checks as
the other plugins.

## Initial import

The initial source snapshot is built from `LNReader/lnreader-plugins` and then
overlaid with the French corrections from
`Balrog57/lnreader-plugins:fix/french-plugins-2026`.

The import keeps both standalone French plugins and French records currently
embedded in the `lightnovelwp`, `madara`, and `mtlnovel` multi-source systems.
This prevents a naive `plugins/french`-only copy from silently dropping French
providers.

## Upstream synchronization

A scheduled GitHub Actions workflow runs daily and can also be launched with
`workflow_dispatch`.

The workflow:

1. fetches the current `LNReader/lnreader-plugins` `master` branch;
2. imports changes to shared build/runtime files;
3. selects only standalone French plugins and French multi-source records;
4. performs a three-way merge against the previous upstream revision so local
   French fixes are preserved;
5. aborts without pushing when a merge conflict occurs;
6. runs the complete validation pipeline;
7. commits and pushes directly to `master` only when every validation passes
   and the generated snapshot changed.

The last successfully synchronized upstream commit is recorded in the
repository. A failed or conflicting synchronization leaves `master` and the
published catalog unchanged; the failed Actions run provides the diagnostics.

## Validation and publication

Before a synchronization can update `master`, CI must verify:

- dependency installation from the lockfile;
- formatting and lint checks for retained source files;
- multi-source generation and production TypeScript compilation;
- manifest generation without duplicate plugin IDs;
- every published manifest entry uses the French language label;
- no non-French plugin directory or source record enters the catalog;
- live smoke checks for every publishable French provider, with bounded retry
  handling for transient network failures;
- exclusion of known broken providers from publication.

After a successful update to `master`, the publishing workflow builds the
orphan distribution branch `plugins/v3.0.0`. LNReader users add this catalog:

`https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json`

## Failure behavior

- Build, catalog, or live-site failure: no synchronization commit and no new
  publication.
- Merge conflict with a locally corrected French plugin: no automatic choice;
  the run fails with the conflicting paths in its logs.
- Upstream adds a French source: it is included automatically when identified
  as French and when all tests pass.
- Upstream removes or marks a French source broken: the generated catalog
  follows that status unless a deliberate local override exists.

## Security and permissions

The repository is public because LNReader downloads its raw JSON and JavaScript
without GitHub authentication. Workflows use the minimal `contents: write`
permission needed to update `master` and the distribution branch. No personal
access token is stored when the repository-scoped `GITHUB_TOKEN` is sufficient.

## Acceptance criteria

- `Balrog57/lnreader-plugins-fr` exists publicly and the requested local clone
  is configured with it as `origin`.
- The initial catalog contains only working French plugins and includes the
  corrections from `fix/french-plugins-2026`.
- A clean local build produces the same French-only manifest contract.
- Scheduled and manual synchronization are enabled.
- Passing synchronization pushes directly; failing synchronization changes
  nothing.
- The raw catalog URL is downloadable and accepted by LNReader.
