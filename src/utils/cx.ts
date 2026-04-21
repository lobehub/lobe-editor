type ClassNameValue = false | null | string | undefined;

export const cx = (...classNames: ClassNameValue[]) => classNames.filter(Boolean).join(' ');
