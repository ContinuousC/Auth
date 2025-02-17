/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { RESPONSE_ERRORS } from "../constants.js";
import { parseErrorMessage, OIDCError, TokenError } from "../errors.js";

const userInfoSchema = z.object({
  sub: z.string(),
  email_verified: z.boolean(),
  name: z.string(),
  family_name: z.string(),
  email: z.string().email(),
  active_organization: z.object({
    role: z.array(z.string()),
    name: z.string(),
    id: z.string(),
    attribute: z.record(z.array(z.string())),
  }),
  organization_attribute: z.record(
    z.string(),
    z.object({
      name: z.string(),
      attributes: z.record(z.array(z.string())),
    })
  ),
  organization_role: z.record(
    z.string(),
    z.object({
      name: z.string(),
      roles: z.array(z.string()),
    })
  ),
});

type UserInfo = z.infer<typeof userInfoSchema>;

const userPlugin: FastifyPluginAsync = async (app) => {
  app.addHook(
    "onRequest",
    app.authorization.authorized(app.authorization.verifyTokenWithJwks)
  );
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/user-info",
    schema: {
      response: {
        default: userInfoSchema,
        ...RESPONSE_ERRORS,
      },
    },
    handler: async function (req, reply) {
      if (req.tokens !== undefined) {
        try {
          const userInfo = await app.oidc.client.userinfo<UserInfo>(
            req.tokens.access_token
          );
          await reply.send(userInfo);
        } catch (error) {
          reply.headers({ "X-OIDC-LOGOUT": "true" });
          throw app.httpErrors.badRequest(
            parseErrorMessage(
              new OIDCError(
                "Could not retrieve user info: " + parseErrorMessage(error)
              )
            )
          );
        }
      } else {
        reply.headers({ "X-OIDC-LOGOUT": "true" });
        throw app.httpErrors.unauthorized(
          parseErrorMessage(new TokenError("no tokens found"))
        );
      }
    },
  });
};

export default userPlugin;
