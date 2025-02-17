/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { fastify } from "fastify";
import Sensible from "@fastify/sensible";
import AutoLoad from "@fastify/autoload";
import Cookie from "@fastify/cookie";
import { join } from "desm";
import crypto from "crypto";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { Config } from "./program.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
  }
}

export default async function (config: Config) {
  const app = fastify({
    logger: {
      level: config.verbosity,
    },
  }).withTypeProvider<ZodTypeProvider>();
  app.log.info(
    { config: { ...config, oidcClientSecret: "***" } },
    "Configuration"
  );
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("config", config);
  await app.register(Sensible);
  await app.register(Cookie, {
    secret: crypto.randomBytes(20),
    parseOptions: {
      httpOnly: true,
      sameSite: true,
      secure: true,
      domain: config.domain,
      path: "/",
    },
  });
  await app.register(AutoLoad, {
    dir: join(import.meta.url, "plugins"),
    dirNameRoutePrefix: false,
  });
  await app.register(AutoLoad, {
    dir: join(import.meta.url, "routes"),
    dirNameRoutePrefix: false,
  });
  return app;
}
