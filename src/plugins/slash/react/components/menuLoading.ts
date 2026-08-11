import type { ISlashOption } from '../../service/i-slash-service';

export const shouldShowLoadingPlaceholder = (
  loading: boolean | undefined,
  options: ISlashOption[],
): boolean => Boolean(loading && options.length === 0);
