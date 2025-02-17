/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import Fp from "fastify-plugin";
import { TokenSet, IdTokenClaims } from "openid-client";
import jwt from "jsonwebtoken";
import { ClaimParser } from "../utils/claims.js";
import { encode } from "../utils/generic.js";
import {
  parseErrorMessage,
  ClaimParserError,
  OIDCError,
  TokenError,
  LogicError,
} from "../errors.js";

declare module "fastify" {
  interface FastifyInstance {
    authorization: {
      authorized: (
        verifyAccessToken: (accessToken: string) => Promise<true>,
        tokenSource?: "bearer" | "cookie" | "either",
        noRedirect?: boolean,
        extraAuthorizationCheck?: (claims: IdTokenClaims) => void
      ) => (req: FastifyRequest, _reply: FastifyReply) => Promise<void>;
      getTokensFromRequest(req: FastifyRequest): Tokens;
      getTokensFromTokenSet: (tokenSet: TokenSet) => Tokens;
      verifyTokenIntrospection: (accessToken: string) => Promise<true>;
      verifyTokenWithJwks: (accessToken: string) => Promise<true>;
      claimParser: ClaimParser;
    };
  }
  interface FastifyRequest {
    tokens?: Tokens;
  }
}

export interface Tokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
}

const authorizationPlugin: FastifyPluginAsync = async (app, _ops) => {
  const claimParser = new ClaimParser({
    callbackRedirect: {
      claimPath: "active_organization.name",
      pipeParser: [{ func: "Sufix", value: "." + app.config.domain }],
    },
    forwardedHeaders: [
      {
        header: "X-PROXY-USER",
        claimPath: "email",
        pipeParser: [],
      },
      {
        header: "X-PROXY-EMAIL",
        claimPath: "email",
        pipeParser: [],
      },
      {
        header: "X-PROXY-NAME",
        claimPath: "name",
        pipeParser: [],
      },
      {
        header: "X-PROXY-ROLE",
        claimPath: "active_organization.role",
        pipeParser: [
          {
            func: "OneValueFromArrayPrio",
            value: ["admin", "editor", "viewer"],
          },
          { func: "CapitalizeFirstLetter" },
        ],
      },
      {
        header: "X-PROXY-GRAFANA-ROLE",
        claimPath: "active_organization.role",
        pipeParser: [
          {
            func: "OneValueFromArrayPrio",
            value: ["admin", "editor", "viewer"],
          },
          {
            func: "Mapper",
            value: { admin: "editor", editor: "editor", viewer: "viewer" },
          },
          { func: "CapitalizeFirstLetter" },
        ],
      },
      {
        header: "X-Scope-OrgID",
        claimPath: "active_organization.attribute.prometheus_tenant.0",
        pipeParser: [],
      },
    ],
  });

  function authorized(
    verifyAccessToken: (token: string) => Promise<true>,
    tokenSource?: "bearer" | "cookie" | "either",
    noRedirect: boolean = false,
    extraAuthorizationCheck?: (claims: IdTokenClaims) => void
  ) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        let tokens = getTokensFromRequest(req, tokenSource);
        let tokenRefresh = false;
        try {
          await verifyAccessToken(tokens.access_token);
        } catch (error) {
          if (tokens.refresh_token !== undefined) {
            tokens = await refreshAccessTokens(tokens.refresh_token);
            tokenRefresh = true;
          } else {
            throw error;
          }
        }
        const tokenSet = new TokenSet({
          id_token: tokens.id_token || tokens.access_token,
          access_token: tokens.access_token,
        });
        const claims = tokenSet.claims();
        const claimsValid = claimParser.authorizationCheck(claims);
        if (claimsValid === false) {
          throw new ClaimParserError("One or more claims are not valid");
        }
        const forwardedHeaders = claimParser.forwardedHeaders(claims);
        if (forwardedHeaders !== null) {
          reply.headers(forwardedHeaders);
        }
        if (extraAuthorizationCheck !== undefined) {
          extraAuthorizationCheck(claims);
        }
        req.tokens = tokens;
        if (tokenRefresh && tokens.refresh_token !== undefined) {
          reply.setCookie(
            app.config.cookieAccessToken,
            tokens.access_token,
            app.cookieConfig.COOKIE_BASE_CONFIG
          );
          if (tokens.id_token !== undefined) {
            reply.setCookie(
              app.config.cookieIdToken,
              tokens.id_token,
              app.cookieConfig.COOKIE_BASE_CONFIG
            );
          }
          if (tokens.refresh_token !== undefined) {
            reply.setCookie(
              app.config.cookieRefreshToken,
              tokens.refresh_token,
              app.cookieConfig.COOKIE_BASE_CONFIG
            );
          }
        }
      } catch (error) {
        const errorMessage = parseErrorMessage(error);
        app.log.error({ errorMessage });
        reply.headers({ "X-OIDC-LOGOUT": "true" });
        if (noRedirect === true) {
          throw app.httpErrors.unauthorized(errorMessage);
        } else {
          const redirectPath = encode(req.headers["x-forwarded-uri"] || "");
          await reply.redirect(
            302,
            `https://${app.config.domain}/auth/logout?redirectPath=${redirectPath}`
          );
        }
      }
    };
  }

  function getTokensFromRequest(
    req: FastifyRequest,
    tokenSource: "bearer" | "cookie" | "either" = "cookie"
  ): Tokens {
    if (
      (tokenSource === "bearer" || tokenSource === "either") &&
      "authorization" in req.raw.headers &&
      req.raw.headers.authorization !== undefined &&
      req.raw.headers.authorization.slice(0, 7).toLowerCase() === "bearer "
    ) {
      return {
        access_token: req.raw.headers.authorization.slice(7),
      };
    } else if (
      (tokenSource === "cookie" || tokenSource === "either") &&
      req.cookies[app.config.cookieAccessToken] !== undefined
    ) {
      const id_token = req.cookies[app.config.cookieIdToken];
      const access_token = req.cookies[app.config.cookieAccessToken] as string;
      const refresh_token = req.cookies[app.config.cookieRefreshToken];
      return {
        id_token,
        access_token,
        refresh_token,
      };
    } else {
      throw new TokenError("No access token found in request");
    }
  }

  async function verifyTokenIntrospection(access_token: string): Promise<true> {
    try {
      const introspectionAccessToken = await app.oidc.client.introspect(
        access_token
      );
      if (introspectionAccessToken.active) {
        throw new TokenError("Introspect token not active");
      }
    } catch (error) {
      throw new OIDCError(
        "Failed to introspect token: " + parseErrorMessage(error)
      );
    }
    return true;
  }

  async function verifyTokenWithJwks(access_token: string) {
    return new Promise<true>(async (resolve, reject) => {
      const tokenDecoded = jwt.decode(access_token, {
        complete: true,
      });
      if (tokenDecoded === null) {
        return reject(new TokenError("Could not decode access token"));
      }
      let publicKey: string;
      try {
        publicKey = (
          await app.jwks.client.getSigningKey(tokenDecoded.header.kid)
        ).getPublicKey();
      } catch (error) {
        return reject(
          new TokenError(
            "Could not get public key from kid: " + parseErrorMessage(error)
          )
        );
      }
      jwt.verify(
        access_token,
        publicKey,
        {
          issuer: "https://" + app.config.oidcIssuer,
        },
        (error, _decoded) => {
          if (error) {
            return reject(
              new TokenError(
                "Access token verification failed: " + parseErrorMessage(error)
              )
            );
          }
          return resolve(true);
        }
      );
    });
  }

  async function refreshAccessTokens(refreshToken: string): Promise<Tokens> {
    app.log.warn("Using refresh token to get new tokens");
    try {
      const tokenSet = await app.oidc.client.refresh(refreshToken);
      return getTokensFromTokenSet(tokenSet);
    } catch (error) {
      throw new OIDCError(
        "Could not refresh tokens with refresh token: " +
          parseErrorMessage(error)
      );
    }
  }

  function getTokensFromTokenSet(tokenSet: TokenSet): Tokens {
    const access_token = tokenSet.access_token;
    if (access_token === undefined) {
      throw new LogicError("Access token is missing from tokenSet");
    }
    return {
      access_token,
      id_token: tokenSet.id_token,
      refresh_token: tokenSet.refresh_token,
    };
  }

  app.decorate("authorization", {
    authorized,
    getTokensFromRequest,
    getTokensFromTokenSet,
    verifyTokenIntrospection,
    verifyTokenWithJwks,
    claimParser,
  });
};

export default Fp(authorizationPlugin);
