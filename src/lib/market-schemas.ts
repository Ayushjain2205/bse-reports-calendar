import { z } from "zod";

/** Runtime schemas kept out of the server-fn module (splitting drops siblings). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const calendarInput = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    scripCode: z.string().max(12).optional(),
  })
  .default({});

export const newsInput = z.object({
  company: z.string().min(2).max(160),
  resultDate: isoDate,
});
