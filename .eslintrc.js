module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Custom rules for better code quality
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  ],
};
