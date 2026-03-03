import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceGlobals = {
  ...globals.browser,
  ...globals.node,
};

export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: sourceGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...sourceGlobals,
        ...globals.vitest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
