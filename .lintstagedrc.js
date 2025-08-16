module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix --max-warnings=20', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
