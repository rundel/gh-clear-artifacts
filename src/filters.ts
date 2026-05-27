import { minimatch } from 'minimatch';

/**
 * The subset of an artifact that the filtering logic depends on. Kept minimal
 * and structural so the pure functions below can be unit tested without the
 * Octokit response types.
 */
export interface ArtifactLike {
  id: number;
  name: string;
  created_at?: string | null;
  workflow_run?: { head_branch?: string | null } | null;
}

export interface SelectOptions {
  /** Branch to match against `workflow_run.head_branch`; `null` matches all branches. */
  branch: string | null;
  /** Glob pattern for artifact names; empty matches all names. */
  namePattern: string;
  /** Only select artifacts older than this many days; `0` disables the age filter. */
  olderThanDays: number;
  /** Reference time for the age filter; defaults to now. Injectable for testing. */
  now?: Date;
}

/**
 * Resolve the `branch` input into a concrete branch name (or `null` for all).
 * Empty or `all` means every branch; `current` resolves the triggering ref
 * (e.g. `refs/heads/main` -> `main`); anything else is used verbatim.
 */
export function resolveBranch(input: string, ctxRef: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'all') {
    return null;
  }
  if (trimmed.toLowerCase() === 'current') {
    return ctxRef.replace(/^refs\/heads\//, '');
  }
  return trimmed;
}

export function matchesBranch(artifact: ArtifactLike, branch: string | null): boolean {
  if (branch === null) {
    return true;
  }
  return artifact.workflow_run?.head_branch === branch;
}

export function matchesName(artifact: ArtifactLike, pattern: string): boolean {
  if (pattern.trim() === '') {
    return true;
  }
  return minimatch(artifact.name, pattern);
}

/**
 * Whether the artifact is older than `days`. With `days <= 0` the age filter is
 * disabled and everything passes. An artifact with an unknown creation time is
 * excluded when an age filter is active (safer to keep than to delete).
 */
export function isOlderThan(
  createdAt: string | null | undefined,
  days: number,
  now: Date,
): boolean {
  if (days <= 0) {
    return true;
  }
  if (!createdAt) {
    return false;
  }
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return false;
  }
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return created < cutoff;
}

/** Select the artifacts that match every active filter. */
export function selectArtifacts<T extends ArtifactLike>(
  artifacts: T[],
  opts: SelectOptions,
): T[] {
  const now = opts.now ?? new Date();
  return artifacts.filter(
    (a) =>
      matchesBranch(a, opts.branch) &&
      matchesName(a, opts.namePattern) &&
      isOlderThan(a.created_at, opts.olderThanDays, now),
  );
}
