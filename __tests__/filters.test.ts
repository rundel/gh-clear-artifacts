import {
  ArtifactLike,
  isOlderThan,
  matchesBranch,
  matchesName,
  resolveBranch,
  selectArtifacts,
} from '../src/filters';

function artifact(overrides: Partial<ArtifactLike> = {}): ArtifactLike {
  return {
    id: 1,
    name: 'artifact',
    created_at: '2026-05-01T00:00:00Z',
    workflow_run: { head_branch: 'main' },
    ...overrides,
  };
}

describe('resolveBranch', () => {
  it('treats empty and "all" as all branches (null)', () => {
    expect(resolveBranch('', 'refs/heads/main')).toBeNull();
    expect(resolveBranch('   ', 'refs/heads/main')).toBeNull();
    expect(resolveBranch('all', 'refs/heads/main')).toBeNull();
    expect(resolveBranch('ALL', 'refs/heads/main')).toBeNull();
  });

  it('resolves "current" from the triggering ref', () => {
    expect(resolveBranch('current', 'refs/heads/feature/x')).toBe('feature/x');
    expect(resolveBranch('CURRENT', 'refs/heads/main')).toBe('main');
  });

  it('uses any other value verbatim', () => {
    expect(resolveBranch('develop', 'refs/heads/main')).toBe('develop');
  });
});

describe('matchesBranch', () => {
  it('matches all branches when branch is null', () => {
    expect(matchesBranch(artifact({ workflow_run: { head_branch: 'x' } }), null)).toBe(true);
  });

  it('matches only the named branch', () => {
    expect(matchesBranch(artifact({ workflow_run: { head_branch: 'main' } }), 'main')).toBe(true);
    expect(matchesBranch(artifact({ workflow_run: { head_branch: 'dev' } }), 'main')).toBe(false);
  });

  it('does not match when head_branch is missing and a branch is requested', () => {
    expect(matchesBranch(artifact({ workflow_run: null }), 'main')).toBe(false);
  });
});

describe('matchesName', () => {
  it('matches all names when the pattern is empty', () => {
    expect(matchesName(artifact({ name: 'anything' }), '')).toBe(true);
  });

  it('matches glob patterns', () => {
    expect(matchesName(artifact({ name: 'hw1-html' }), 'hw1-*')).toBe(true);
    expect(matchesName(artifact({ name: 'hw2-html' }), 'hw1-*')).toBe(false);
    expect(matchesName(artifact({ name: 'hw1-md' }), 'hw1-{html,md}')).toBe(true);
  });
});

describe('isOlderThan', () => {
  const now = new Date('2026-05-27T00:00:00Z');

  it('passes everything when days <= 0', () => {
    expect(isOlderThan('2026-05-26T00:00:00Z', 0, now)).toBe(true);
  });

  it('selects artifacts older than the cutoff', () => {
    expect(isOlderThan('2026-05-19T00:00:00Z', 7, now)).toBe(true);
    expect(isOlderThan('2026-05-25T00:00:00Z', 7, now)).toBe(false);
  });

  it('excludes artifacts with an unknown or invalid date when filtering', () => {
    expect(isOlderThan(null, 7, now)).toBe(false);
    expect(isOlderThan('not-a-date', 7, now)).toBe(false);
  });
});

describe('selectArtifacts', () => {
  const now = new Date('2026-05-27T00:00:00Z');
  const artifacts: ArtifactLike[] = [
    { id: 1, name: 'hw1-html', created_at: '2026-05-01T00:00:00Z', workflow_run: { head_branch: 'main' } },
    { id: 2, name: 'hw1-md', created_at: '2026-05-26T00:00:00Z', workflow_run: { head_branch: 'main' } },
    { id: 3, name: 'hw2-html', created_at: '2026-05-01T00:00:00Z', workflow_run: { head_branch: 'dev' } },
  ];

  it('returns everything with no active filters', () => {
    const result = selectArtifacts(artifacts, { branch: null, namePattern: '', olderThanDays: 0, now });
    expect(result.map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it('combines branch, name, and age filters', () => {
    const result = selectArtifacts(artifacts, {
      branch: 'main',
      namePattern: 'hw1-*',
      olderThanDays: 7,
      now,
    });
    expect(result.map((a) => a.id)).toEqual([1]);
  });

  it('scopes to a single branch', () => {
    const result = selectArtifacts(artifacts, { branch: 'dev', namePattern: '', olderThanDays: 0, now });
    expect(result.map((a) => a.id)).toEqual([3]);
  });
});
