/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { generators, IdTokenClaims } from "openid-client";
import { z } from "zod";

import { encode, decode } from "../utils/generic.js";
import { RESPONSE_ERRORS } from "../constants.js";
import { ClaimParser } from "../utils/claims.js";
import {
  parseErrorMessage,
  CookieError,
  LogicError,
  TokenError,
  AuthError,
  ClaimParserError,
} from "../errors.js";

interface CallbackState {
  redirectPath: string;
}
const queryStringRedirectPath = z.object({
  redirectPath: z.string().base64().optional(),
});
type IQueryStringRedirectPath = z.infer<typeof queryStringRedirectPath>;
const queryStringCallback = z.object({
  state: z.string().base64(),
  session_state: z.string(),
  iss: z.string(),
  code: z.string(),
});
type IQueryStringCallback = z.infer<typeof queryStringCallback>;
const queryStringCheck = z.object({
  tenant: z.string(),
  tokenCheck: z.enum(["introspect", "jwks"]).optional(),
  noRedirect: z.enum(["true", "false"]).optional(),
  tokenSource: z.enum(["bearer", "cookie", "either"]).optional(),
  requireRole: z.enum(["viewer", "editor", "admin"]).optional(),
});
type IQueryStringCheck = z.infer<typeof queryStringCheck>;

const authPlugin: FastifyPluginAsync = async (app) => {
  const AUTH_ROUTE_PREFIX = "/auth";
  const CALLBACK_URL =
    "https://" + app.config.domain + AUTH_ROUTE_PREFIX + "/callback";
  await app.withTypeProvider<ZodTypeProvider>().register(
    async function (app) {
      app.route<{ Querystring: IQueryStringRedirectPath }>({
        method: "GET",
        url: "/login",
        schema: {
          querystring: queryStringRedirectPath,
        },
        handler: async function (req, reply) {
          const codeVerifier = generators.codeVerifier();
          const codeChallenge = generators.codeChallenge(codeVerifier);
          const nonce = generators.nonce();
          const callbackStateEncoded = encode<CallbackState>({
            redirectPath: req.query.redirectPath
              ? decode(req.query.redirectPath)
              : "",
          });
          let prompt: "login" | undefined = undefined;
          const access_token = req.cookies[app.config.cookieAccessToken];
          if (access_token === undefined) {
            prompt = "login";
          }
          const authUrl = app.oidc.client.authorizationUrl({
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            nonce,
            state: callbackStateEncoded,
            redirect_uri: CALLBACK_URL,
            prompt,
            scope: "openid offline_access",
          });
          await reply
            .setCookie(
              app.config.cookieCodeVerifier,
              codeVerifier,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .setCookie(
              app.config.cookieCodeNonce,
              nonce,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .setCookie(
              app.config.cookieCodeState,
              callbackStateEncoded,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .redirect(302, authUrl);
        },
      });

      app.route<{ Querystring: IQueryStringCallback }>({
        method: "GET",
        url: "/callback",
        schema: {
          querystring: queryStringCallback,
        },
        handler: async function (req, reply) {
          const codeVerifier =
            req.cookies[app.config.cookieCodeVerifier] !== undefined
              ? app.unsignCookie(
                  req.cookies[app.config.cookieCodeVerifier] as string
                ).value
              : null;
          const nonce =
            req.cookies[app.config.cookieCodeNonce] !== undefined
              ? app.unsignCookie(
                  req.cookies[app.config.cookieCodeNonce] as string
                ).value
              : null;
          const state =
            req.cookies[app.config.cookieCodeState] !== undefined
              ? app.unsignCookie(
                  req.cookies[app.config.cookieCodeState] as string
                ).value
              : null;
          if (codeVerifier === null) {
            const errorMessage = parseErrorMessage(
              new CookieError("Missing cookie for code/pkce verifier")
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.badRequest(errorMessage);
          }
          if (nonce === null) {
            const errorMessage = parseErrorMessage(
              new CookieError("Missing cookie for nonce")
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.badRequest(errorMessage);
          }
          if (state === null) {
            const errorMessage = parseErrorMessage(
              new CookieError("Missing cookie for state")
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.badRequest(errorMessage);
          }

          const params = app.oidc.client.callbackParams(req.raw);
          const tokenSet = await app.oidc.client.callback(
            CALLBACK_URL,
            params,
            {
              code_verifier: codeVerifier,
              nonce,
              state,
            }
          );
          const tokens = app.authorization.getTokensFromTokenSet(tokenSet);
          const stateDecoded = decode<CallbackState>(state);
          if (stateDecoded && !("redirectPath" in stateDecoded)) {
            const errorMessage = parseErrorMessage(
              new LogicError("redirectPath not found in state")
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.internalServerError(errorMessage);
          }
          const claims = tokenSet.claims();
          if (claims.iss !== "https://" + app.config.oidcIssuer) {
            const errorMessage = parseErrorMessage(
              new AuthError("Issuer in token does not match")
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.unauthorized(errorMessage);
          }
          let redirectDomain = app.config.domain;
          try {
            const result =
              app.authorization.claimParser.callbackRedirect(claims);
            if (result !== null) {
              redirectDomain = result;
            }
          } catch (error) {
            const errorMessage = parseErrorMessage(
              new AuthError(
                "Redirect domain not found in claim: " +
                  parseErrorMessage(error)
              )
            );
            app.log.error({
              errorMessage,
            });
            throw app.httpErrors.unauthorized(errorMessage);
          }
          const redirectUrl =
            "https://" + redirectDomain + stateDecoded.redirectPath;
          reply
            .clearCookie(
              app.config.cookieCodeVerifier,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .clearCookie(
              app.config.cookieCodeNonce,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .clearCookie(
              app.config.cookieCodeState,
              app.cookieConfig.COOKIE_OIDC_SESSION_CONFIG
            )
            .setCookie(
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
          await reply.redirect(302, redirectUrl);
        },
      });

      app.route<{ Querystring: IQueryStringRedirectPath }>({
        method: "GET",
        url: "/logout",
        schema: {
          querystring: queryStringRedirectPath,
        },
        handler: async function (req, reply) {
          const redirectPath = req.query.redirectPath || "";
          let logoutURL = `https://${app.config.domain}/auth/login?redirectPath=${redirectPath}`;
          try {
            const tokens = app.authorization.getTokensFromRequest(req);
            const accessTokenValid =
              await app.authorization.verifyTokenWithJwks(tokens.access_token);
            if (tokens.id_token === undefined) {
              throw new TokenError("ID token missing");
            } else if (accessTokenValid) {
              logoutURL = app.oidc.client.endSessionUrl({
                post_logout_redirect_uri: `https://${app.config.domain}/auth/login`,
                id_token_hint: tokens.id_token,
              });
            }
          } catch (error) {
            app.log.warn(
              "Failed to logout in authentication server: " +
                parseErrorMessage(error)
            );
          }
          await reply
            .clearCookie(
              app.config.cookieIdToken,
              app.cookieConfig.COOKIE_BASE_CONFIG
            )
            .clearCookie(
              app.config.cookieAccessToken,
              app.cookieConfig.COOKIE_BASE_CONFIG
            )
            .clearCookie(
              app.config.cookieRefreshToken,
              app.cookieConfig.COOKIE_BASE_CONFIG
            )
            .redirect(302, logoutURL);
        },
      });

      app.route<{ Querystring: IQueryStringCheck }>({
        method: "GET",
        url: "/check",
        schema: {
          querystring: queryStringCheck,
          response: {
            default: z.literal("OK"),
            ...RESPONSE_ERRORS,
          },
        },
        onRequest: (req, reply) => {
          const extraAuthorizationCheck = (claims: IdTokenClaims) => {
            const tenantClaimParser = new ClaimParser({
              authorizationCheck: [
                {
                  value: req.query.tenant,
                  claimPath: "active_organization.name",
                  pipeParser: [],
                },
              ],
            });
            const accessToTenant = tenantClaimParser.authorizationCheck(claims);
            if (!accessToTenant) {
              reply.headers({ "X-OIDC-LOGOUT": "true" });
              const errorMessage = parseErrorMessage(
                new AuthError(
                  "No permission to access tenant " + req.query.tenant
                )
              );
              throw app.httpErrors.unauthorized(errorMessage);
            }
            if (req.query.requireRole) {
              const roles = ["admin", "editor", "viewer"];
              const required_role = roles.indexOf(req.query.requireRole);
              const roleClaimParser = new ClaimParser({
                authorizationCheck: [
                  {
                    value: (role: string) => {
                      const actual_role = roles.indexOf(role);
                      return actual_role > -1 && actual_role <= required_role;
                    },
                    claimPath: "active_organization.role",
                    pipeParser: [
                      {
                        func: "OneValueFromArrayPrio",
                        value: roles,
                      },
                    ],
                  },
                ],
              });
              const allowedForRole = roleClaimParser.authorizationCheck(claims);
              if (!allowedForRole) {
                reply.headers({ "X-OIDC-LOGOUT": "true" });
                const errorMessage = parseErrorMessage(
                  new AuthError("No allowed for this role")
                );
                throw app.httpErrors.unauthorized(errorMessage);
              }
            }
          };
          return app.authorization.authorized(
            req.query.tokenCheck === "introspect"
              ? app.authorization.verifyTokenIntrospection
              : app.authorization.verifyTokenWithJwks,
            req.query.tokenSource,
            req.query.noRedirect === "true",
            extraAuthorizationCheck
          )(req, reply);
        },
        handler: async function (_req, reply) {
          await reply.send("OK");
        },
      });
    },
    { prefix: AUTH_ROUTE_PREFIX }
  );
};

export default authPlugin;
