/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { z } from "zod";

export const RESPONSE_ERRORS = {
  "4xx": z.object({
    name: z.string(),
    message: z.string(),
    // status: z.number(),
    // statusCode: z.number(),
    // expose: z.boolean(),
    // headers: z.record(z.string()).optional(),
    // cause: z.unknown(),
  }),
  "5xx": z.object({
    name: z.string(),
    message: z.string(),
    // status: z.number(),
    // statusCode: z.number(),
    // expose: z.boolean(),
    // headers: z.record(z.string()).optional(),
    // cause: z.unknown(),
  }),
};
