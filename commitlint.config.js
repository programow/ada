/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 100],
        'body-max-line-length': [2, 'always', 200],
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'chore',
                'docs',
                'test',
                'build',
                'ci',
                'refactor',
                'perf',
                'style',
                'revert',
            ],
        ],
    },
};
