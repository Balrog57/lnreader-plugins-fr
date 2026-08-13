# Remove WorldNovel from the French catalog

## Decision

Remove WorldNovel from `lnreader-plugins-fr` and keep it excluded from future
automatic upstream synchronizations.

Victorian Novel House still serves public catalog and work metadata, but its
chapter reader requires a user account. A public LNReader source that cannot
return chapter text without authentication does not satisfy this repository's
working-plugin contract.

## Scope

The change removes the `worldnovel` record from the Madara multi-source input
and deletes its generated French plugin and retained icon. It does not change
other Madara sources or the remaining French plugins.

The repository's explicit non-publishable French providers become:

- MassNovel;
- MTL Novel (FR);
- PhenixScans, whose current site no longer publishes light novels;
- WorldNovel, whose chapters require an account.

## Synchronization behavior

The upstream synchronization must not restore WorldNovel merely because it
still exists in `LNReader/lnreader-plugins`.

The French multi-source projection will apply an explicit denylist after
selecting French records. `worldnovel`, `massnovel`, and `mtlnovel-fr` belong to
that denylist. Keeping this rule in the projection layer makes it apply both to
normal pruning and to three-way conflict resolution during scheduled syncs.

The retained multi-source asset map will no longer retain WorldNovel's Madara
icon. An upstream conflict involving that icon can therefore be removed
automatically.

PhenixScans remains represented by its `.broken.ts` source and continues to be
excluded by the existing broken-file publication rule.

## Generated output

After pruning and multi-source generation:

- `plugins/french/WorldNovel[madara].ts` must not exist;
- `.js/plugins/french/WorldNovel[madara].js` must not exist after a clean build;
- the generated manifest must not contain the `worldnovel` ID;
- the published catalog count decreases by one.

Generated files and distribution artifacts are refreshed through the existing
build and publication workflow rather than edited as the source of truth.

## Validation

Unit tests will verify that:

- French projection rejects each permanently excluded source ID;
- upstream merge resolution cannot restore an excluded source;
- WorldNovel's retained Madara icon is classified for removal;
- publishable French plugin discovery no longer lists a generated WorldNovel
  file after regeneration.

The implementation is accepted when unit tests, French linting, a clean
multi-source build, manifest validation, and live checks for all remaining
publishable French plugins pass. Only then may the change be committed, pushed
to `master`, and published by the existing workflow.

## Alternatives rejected

- Keeping WorldNovel with a warning was rejected because chapter retrieval is
  the core plugin function and currently requires authentication.
- Storing user credentials or session tokens in the plugin was rejected for
  security, maintenance, and portability reasons.
- Removing only the generated file was rejected because the daily upstream
  synchronization would recreate it.
