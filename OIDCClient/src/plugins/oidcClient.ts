/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync } from "fastify";
import Fp from "fastify-plugin";
import { Issuer, Client } from "openid-client";
import jwksClient from "jwks-rsa";
import { OIDCError } from "../errors.js";

declare module "fastify" {
  interface FastifyInstance {
    oidc: {
      issuer: Issuer;
      client: Client;
    };
    jwks: {
      client: jwksClient.JwksClient;
    };
  }
}

const oidcClientPlugin: FastifyPluginAsync = async (app, _opts) => {
  const issuer = await Issuer.discover("https://" + app.config.oidcIssuer);
  const oidcClient = new issuer.Client({
    client_id: app.config.oidcClientId,
    client_secret: app.config.oidcClientSecret,
  });
  app.decorate("oidc", { issuer, client: oidcClient });
  if (issuer.metadata.jwks_uri === undefined) {
    throw new OIDCError("No jwks uri found at issuer");
  }
  app.decorate("jwks", {
    client: jwksClient({
      // Rate limit is disabled because this implementation makes DDoS
      // attacks extremely easy. Rate limit could be implemented on
      // ingress instead.
      // rateLimit: true,
      jwksUri: issuer.metadata.jwks_uri,
    }),
  });
};

export default Fp(oidcClientPlugin);
