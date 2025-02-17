/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync } from "fastify";
import Fp from "fastify-plugin";
import { CookieSerializeOptions } from "@fastify/cookie";

declare module "fastify" {
  interface FastifyInstance {
    cookieConfig: {
      COOKIE_BASE_CONFIG: CookieSerializeOptions;
      COOKIE_OIDC_SESSION_CONFIG: CookieSerializeOptions;
    };
  }
}

const cookieKeysPlugin: FastifyPluginAsync = async (app) => {
  const COOKIE_BASE_CONFIG = {
    domain: app.config.domain,
    httpOnly: true,
    sameSite: true,
    secure: true,
    path: "/",
  };
  const COOKIE_OIDC_SESSION_CONFIG = {
    ...COOKIE_BASE_CONFIG,
    signed: true,
  };
  app.decorate("cookieConfig", {
    COOKIE_BASE_CONFIG,
    COOKIE_OIDC_SESSION_CONFIG,
  });
};

export default Fp(cookieKeysPlugin);
