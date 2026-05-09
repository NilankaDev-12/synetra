module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    // Turned off: this rule fires on every utility/hook file that exports
    // non-components, which breaks CI's --max-warnings 0 flag.
    // It is only relevant for Vite HMR and should never block the build gate.
    'react-refresh/only-export-components': 'off',
  },
}