import { Item, Status } from '../types';
import { today } from './util';

/**
 * Date bookkeeping that rides along with a status change, shared by the store
 * and the edit dialog so both behave identically. Existing dates are kept.
 */
export function statusDatePatch(
  item: Pick<Item, 'startedAt' | 'finishedAt'>,
  status: Status,
): Pick<Item, 'startedAt' | 'finishedAt'> {
  if (status === 'backlog') return { startedAt: undefined, finishedAt: undefined };
  const startedAt = item.startedAt ?? today();
  if (status === 'completed') return { startedAt, finishedAt: item.finishedAt ?? today() };
  return { startedAt, finishedAt: item.finishedAt };
}
