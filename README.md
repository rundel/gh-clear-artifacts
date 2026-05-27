# Clear Artifacts

A GitHub Action that deletes workflow artifacts in a repository. By default it
removes every artifact, but it includes optional scoping by branch, artifact name, and age, plus a
dry-run mode.

## Quick start

```yaml
- name: Clear artifacts
  uses: rundel/gh-clear-artifacts@v1
```

The action needs permission to delete artifacts. The default `GITHUB_TOKEN`
works as long as the job grants `actions: write`:

```yaml
permissions:
  actions: write
```

## Examples

Delete artifacts only for the branch that triggered the run:

```yaml
- uses: rundel/gh-clear-artifacts@v1
  with:
    branch: current
```

Delete artifacts for a specific branch:

```yaml
- uses: rundel/gh-clear-artifacts@v1
  with:
    branch: main
```

Delete only artifacts whose name matches a glob, older than a week, and preview
first:

```yaml
- uses: rundel/gh-clear-artifacts@v1
  with:
    name: 'hw1-*'
    older-than: 7
    dry-run: true
```

Use the outputs:

```yaml
- id: clear
  uses: rundel/gh-clear-artifacts@v1
- run: echo "Removed ${{ steps.clear.outputs.deleted-count }} artifacts"
```

## Inputs

| Input        | Default               | Description |
| ------------ | --------------------- | ----------- |
| `token`      | `${{ github.token }}` | Token used for the API. Needs `actions: write`. |
| `repository` | `${{ github.repository }}` | Target repository in `owner/repo` form. |
| `branch`     | `''`                  | `''`/`all` = every branch; `current` = the triggering branch; any other value matches `workflow_run.head_branch`. |
| `name`       | `''`                  | Glob pattern for artifact names (e.g. `hw1-*`). Empty matches all. |
| `older-than` | `''`                  | Only delete artifacts created more than this many days ago. Empty/`0` disables the age filter. |
| `dry-run`    | `false`               | Log what would be deleted without deleting. |

## Outputs

| Output          | Description |
| --------------- | ----------- |
| `deleted-count` | Number of artifacts deleted (or that would be deleted in a dry run). |
| `deleted-names` | JSON array of deleted artifact names. |

## How branch filtering works

The GitHub REST API for listing repository artifacts does not accept a branch
parameter, so branch scoping is applied client-side by comparing each artifact's
`workflow_run.head_branch`. Artifacts created without an associated workflow run
branch are only removed when `branch` is left empty (all branches).

## Development

See [CLAUDE.md](CLAUDE.md). In short:

```bash
npm ci
npm run all   # build (ncc) + lint + test
```

`dist/index.js` is the committed runtime bundle and must be rebuilt and
committed after any change under `src/`.

## License

[MIT](LICENSE)
