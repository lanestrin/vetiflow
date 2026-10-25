# Finished features

`/complete` archives each finished build-plan item here as
`<id>-<short-name>.md`, for example `2.3-board-query.md`. The file is the spec as
it was when the work finished, plus a `## Result` section: the PR, the Verify
output, findings closed and follow-ups added.

These files are the project's memory. Read the matching one before changing an
earlier feature.

A file is final once its PR merges. Before that, changes asked for in review are
made on the same branch and update the file's `## Result`. After the merge,
never edit it; if a feature is changed later, the later item gets its own file.
