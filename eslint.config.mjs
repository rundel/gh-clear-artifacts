import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'lib/**', 'node_modules/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
);
