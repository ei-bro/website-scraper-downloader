/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2020: true, jest: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: null,
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs'],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.property.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-control-regex': 'off',
      },
    },
  ],
};
