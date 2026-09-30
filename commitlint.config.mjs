/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // header-max-length: 100 by default; commits get long when they explain a trade-off
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0],
    'subject-case': [0],
    // No scoped deps updates
    'scope-enum': [
      2,
      'always',
      ['deps', 'docker', 'ci', 'config', 'docs', 'types', 'tests', 'release'],
    ],
  },
};
