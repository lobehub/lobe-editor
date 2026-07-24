import { stylelint } from '@lobehub/lint';

export default {
  ...stylelint,
  rules: {
    ...stylelint.rules,
    'custom-property-pattern': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
  },
};
