const config = require('@lobehub/lint').stylelint;

module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'custom-property-pattern': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
  },
};
