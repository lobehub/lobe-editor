import {
  InfoIcon,
  LightbulbIcon,
  type LucideIcon,
  MessageSquareWarningIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import type { AlertType } from '../node/AlertNode';

export const ALERT_ICONS: Record<AlertType, LucideIcon> = {
  caution: OctagonAlertIcon,
  important: MessageSquareWarningIcon,
  note: InfoIcon,
  tip: LightbulbIcon,
  warning: TriangleAlertIcon,
};
