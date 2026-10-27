export function textToSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\s\w\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF-]/g, '')
    .replaceAll(/[\s_]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

export function claimHeadingSlug(text: string, slugs: Map<string, number>): string {
  const baseSlug = textToSlug(text);
  if (!baseSlug) return '';

  let count = slugs.get(baseSlug);
  if (count === undefined) {
    slugs.set(baseSlug, 1);
    return baseSlug;
  }

  let slug = `${baseSlug}-${count}`;
  while (slugs.has(slug)) {
    count += 1;
    slug = `${baseSlug}-${count}`;
  }
  slugs.set(baseSlug, count + 1);
  slugs.set(slug, 1);
  return slug;
}
