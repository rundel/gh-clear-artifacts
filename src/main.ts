import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveBranch, selectArtifacts } from './filters';

interface SummaryInfo {
  owner: string;
  repo: string;
  branch: string | null;
  namePattern: string;
  olderThanDays: number;
  dryRun: boolean;
  total: number;
  deletedNames: string[];
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const repository =
      core.getInput('repository') ||
      `${github.context.repo.owner}/${github.context.repo.repo}`;
    const branchInput = core.getInput('branch');
    const namePattern = core.getInput('name');
    const olderThanRaw = core.getInput('older-than');
    const dryRun = core.getBooleanInput('dry-run');

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository "${repository}"; expected "owner/repo".`);
    }

    const olderThanDays = olderThanRaw.trim() === '' ? 0 : Number(olderThanRaw);
    if (Number.isNaN(olderThanDays) || olderThanDays < 0) {
      throw new Error(
        `Invalid older-than value "${olderThanRaw}"; expected a non-negative number of days.`,
      );
    }

    const branch = resolveBranch(branchInput, github.context.ref);
    const octokit = github.getOctokit(token);

    core.info(
      `Listing artifacts for ${owner}/${repo} ` +
        `(branch: ${branch ?? 'all'}, name: ${namePattern || '*'}, ` +
        `older-than: ${olderThanDays || 'any'} day(s), dry-run: ${dryRun})`,
    );

    const all = await octokit.paginate(octokit.rest.actions.listArtifactsForRepo, {
      owner,
      repo,
      per_page: 100,
    });

    const toDelete = selectArtifacts(all, { branch, namePattern, olderThanDays });
    core.info(`Found ${all.length} artifact(s); ${toDelete.length} match the filters.`);

    const deletedNames: string[] = [];
    for (const artifact of toDelete) {
      if (dryRun) {
        core.info(`Would delete: ${artifact.name} (${artifact.id})`);
        deletedNames.push(artifact.name);
        continue;
      }
      try {
        core.info(`Deleting: ${artifact.name} (${artifact.id})`);
        await octokit.rest.actions.deleteArtifact({
          owner,
          repo,
          artifact_id: artifact.id,
        });
        deletedNames.push(artifact.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to delete ${artifact.name} (${artifact.id}): ${message}`);
      }
    }

    core.setOutput('deleted-count', deletedNames.length);
    core.setOutput('deleted-names', JSON.stringify(deletedNames));

    await writeSummary({
      owner,
      repo,
      branch,
      namePattern,
      olderThanDays,
      dryRun,
      total: all.length,
      deletedNames,
    });

    core.info(`${dryRun ? 'Would delete' : 'Deleted'} ${deletedNames.length} artifact(s).`);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

async function writeSummary(info: SummaryInfo): Promise<void> {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  const summary = core.summary
    .addHeading(info.dryRun ? 'Clear Artifacts (dry run)' : 'Clear Artifacts', 2)
    .addRaw(`Scanned ${info.total} artifact(s) in \`${info.owner}/${info.repo}\`.`, true)
    .addList([
      `Branch: ${info.branch ?? 'all'}`,
      `Name pattern: ${info.namePattern || '*'}`,
      `Older than: ${info.olderThanDays ? `${info.olderThanDays} day(s)` : 'any'}`,
    ]);

  if (info.deletedNames.length === 0) {
    summary.addRaw('No artifacts matched the filters.', true);
  } else {
    summary.addTable([
      [
        { data: '#', header: true },
        { data: info.dryRun ? 'Would delete' : 'Deleted', header: true },
      ],
      ...info.deletedNames.map((name, i) => [String(i + 1), name]),
    ]);
  }

  await summary.write();
}
