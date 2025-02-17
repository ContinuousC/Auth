/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const statusPlugin: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/status",
    schema: {
      response: {
        default: z.object({
          status: z.literal("OK"),
        }),
      },
    },
    handler: function (_req, reply) {
      reply.send({ status: "OK" });
    },
  });
};

export default statusPlugin;
