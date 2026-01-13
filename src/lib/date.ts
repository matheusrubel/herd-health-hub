import { differenceInDays, format, parseISO, startOfDay } from 'date-fns';

/**
 * Parse de uma coluna `date` (YYYY-MM-DD) de forma segura (sem shift de timezone).
 * Usamos meio-dia local (T12:00:00) para evitar cair no dia anterior em UTC.
 */
export const parseDateOnly = (dateStr: string): Date => {
  return parseISO(`${dateStr}T12:00:00`);
};

/** Retorna a data de hoje no formato YYYY-MM-DD (timezone local). */
export const todayISO = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

/**
 * Dias decorridos entre uma data `date` (YYYY-MM-DD) e uma data final (padrão: hoje).
 * Sempre retorna no mínimo 1 para evitar divisões por zero.
 */
export const daysBetweenDateOnly = (startDateStr: string, end: Date = new Date()): number => {
  const start = startOfDay(parseDateOnly(startDateStr));
  const endDay = startOfDay(end);
  return Math.max(1, differenceInDays(endDay, start));
};
