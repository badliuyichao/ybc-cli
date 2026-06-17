module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // TypeScript 规则
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-inferrable-types': 'off',

    // 通用规则
    'no-console': 'off', // CLI 工具允许 console
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // Prettier 集成
    'prettier/prettier': 'error',
  },
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    // 生成代码（按 CLAUDE.md 规则不可手改，不做 lint）
    'src/api/generated/**',
    'src/cli/commands/generated/**',
  ],
};