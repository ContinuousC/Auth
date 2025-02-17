/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { describe, expect, test } from "vitest";
import { IdTokenClaims } from "openid-client";
import { ClaimParser, ClaimConfig } from "./claims.js";

const MOCK_CLAIM_CONFIG: ClaimConfig = {
  callbackRedirect: {
    claimPath: "active_organization.name",
    pipeParser: [{ func: "Sufix", value: ".parentdomain.com" }],
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
      header: "X-PROXY-OTHER-ROLE",
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
  ],
  authorizationCheck: [
    {
      value: "demo",
      claimPath: "active_organization.name",
      pipeParser: [],
    },
  ],
};

const MOCK_CLAIMS: IdTokenClaims = {
  aud: "demo-api",
  exp: 1,
  iat: 1,
  sub: "tester",
  iss: "issuer.com",
  name: "tester",
  family_name: "success",
  email: "tester@vitest.dev",
  active_organization: {
    role: ["random1", "random2", "editor"],
    id: "8888-8888",
    name: "demo",
  },
};
describe("ClaimParser", () => {
  const claimParser = new ClaimParser(MOCK_CLAIM_CONFIG);
  describe("callbackRedirect", () => {
    test("As expect", () => {
      const callbackRedirect = claimParser.callbackRedirect(MOCK_CLAIMS);
      expect(callbackRedirect).toEqual("demo.parentdomain.com");
    });
  });
  describe("forwardedHeaders", () => {
    test("As expect", () => {
      const forwardHeaders = claimParser.forwardedHeaders(MOCK_CLAIMS);
      expect(forwardHeaders).toEqual({
        "X-PROXY-USER": "tester@vitest.dev",
        "X-PROXY-EMAIL": "tester@vitest.dev",
        "X-PROXY-NAME": "tester",
        "X-PROXY-ROLE": "Editor",
        "X-PROXY-OTHER-ROLE": "Editor",
      });
    });
    test("Role not in claims", () => {
      const claims: IdTokenClaims = {
        ...MOCK_CLAIMS,
        active_organization: {
          role: ["random1", "random2"],
          id: "8888-8888",
          name: "demo",
        },
      };
      expect(() => claimParser.forwardedHeaders(claims)).toThrowError(
        "Could not parse claimValue"
      );
    });
    test("Prio Order switched", () => {
      const claims: IdTokenClaims = {
        ...MOCK_CLAIMS,
        active_organization: {
          role: ["viewer", "random1", "random2", "editor"],
          id: "8888-8888",
          name: "demo",
        },
      };
      const forwardHeaders = claimParser.forwardedHeaders(claims);
      expect(forwardHeaders).toEqual({
        "X-PROXY-USER": "tester@vitest.dev",
        "X-PROXY-EMAIL": "tester@vitest.dev",
        "X-PROXY-NAME": "tester",
        "X-PROXY-ROLE": "Editor",
        "X-PROXY-OTHER-ROLE": "Editor",
      });
    });
    test("Admin role becomes editor role in X-PROXY-OTHER-ROLE", () => {
      const claims: IdTokenClaims = {
        ...MOCK_CLAIMS,
        active_organization: {
          role: ["admin", "random1", "random2"],
          id: "8888-8888",
          name: "demo",
        },
      };
      const forwardHeaders = claimParser.forwardedHeaders(claims);
      expect(forwardHeaders).toEqual({
        "X-PROXY-USER": "tester@vitest.dev",
        "X-PROXY-EMAIL": "tester@vitest.dev",
        "X-PROXY-NAME": "tester",
        "X-PROXY-ROLE": "Admin",
        "X-PROXY-OTHER-ROLE": "Editor",
      });
    });
  });
  describe("checkClaims", () => {
    test("as expected", () => {
      const checkClaim = claimParser.authorizationCheck(MOCK_CLAIMS);
      expect(checkClaim).toEqual(true);
    });
  });
});
