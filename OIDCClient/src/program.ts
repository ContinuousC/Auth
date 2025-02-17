/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { Command, Option } from "@commander-js/extra-typings";

const ENV_PREFIX = "AUTH_";
const COOKIE_OIDC_SESSION_PREFIX = "oidc" + "_";
const COOKIE_IDENITIFIER_SESSION_PREFIX = "identity" + "_";
const COOKIE_CODE_VERIFIER = COOKIE_OIDC_SESSION_PREFIX + "code-verifier";
const COOKIE_NONCE = COOKIE_OIDC_SESSION_PREFIX + "nonce";
const COOKIE_STATE = COOKIE_OIDC_SESSION_PREFIX + "state";
const COOKIE_ID_TOKEN = COOKIE_IDENITIFIER_SESSION_PREFIX + "id";
const COOKIE_ACCESS_TOKEN = COOKIE_IDENITIFIER_SESSION_PREFIX + "access";
const COOKIE_REFRESH_TOKEN = COOKIE_IDENITIFIER_SESSION_PREFIX + "refresh";

const program = new Command()
  .name("oidc-client")
  .addOption(
    new Option("-p, --port <number>", "specify port number")
      .env(ENV_PREFIX + "PORT")
      .default("8080")
  )
  .addOption(
    new Option("-v, --verbosity <size>", "verbosity")
      .choices(["trace", "debug", "info", "warn", "error", "fatal"] as const)
      .env(ENV_PREFIX + "VERBOSITY")
      .default("info")
  )
  .addOption(
    new Option("--oidc-issuer <issuer>", "oidc issuer")
      .env(ENV_PREFIX + "OIDC_ISSUER")
      .makeOptionMandatory()
  )
  .addOption(
    new Option("--oidc-client-id <client>", "oidc client id")
      .env(ENV_PREFIX + "OIDC_CLIENT_ID")
      .makeOptionMandatory()
  )
  .addOption(
    new Option("--oidc-client-secret <secret>", "oidc client secret")
      .env(ENV_PREFIX + "OIDC_CLIENT_SECRET")
      .makeOptionMandatory()
  )
  .addOption(
    new Option("-d, --domain <domain>", "domain")
      .env(ENV_PREFIX + "DOMAIN")
      .makeOptionMandatory()
  )
  .addOption(
    new Option(
      "--user-schema-path <path>",
      "Give the user schema to improve performance for serialization"
    ).env(ENV_PREFIX + "USER_SCHEMA_PATH")
  )
  .addOption(
    new Option(
      "--claims-config-path <path>",
      "1.Claims to retrieve the domain to redirect to after successfull /auth/callback. \
        If not set, redirect will be done on given domain itself. \
       2.Claims to forward as headers \
       3.Claims to check on authorization middleware"
    ).env(ENV_PREFIX + "CLAIMS_CONFIG_PATH")
  )
  .addOption(
    new Option("--cookie-code-verifier <cookie>", "cookie code verifier name")
      .env(ENV_PREFIX + "COOKIE_CODE_VERIFIER")
      .default(COOKIE_CODE_VERIFIER)
  )
  .addOption(
    new Option("--cookie-code-nonce <cookie>", "cookie nonce name")
      .env(ENV_PREFIX + "COOKIE_NONCE")
      .default(COOKIE_NONCE)
  )
  .addOption(
    new Option("--cookie-code-state <cookie>", "cookie state name")
      .env(ENV_PREFIX + "COOKIE_STATE")
      .default(COOKIE_STATE)
  )
  .addOption(
    new Option("--cookie-id-token <cookie>", "cookie ID token")
      .env(ENV_PREFIX + "COOKIE_ID_TOKEN")
      .default(COOKIE_ID_TOKEN)
  )
  .addOption(
    new Option("--cookie-access-token <cookie>", "cookie access token")
      .env(ENV_PREFIX + "COOKIE_ACCESS_TOKEN")
      .default(COOKIE_ACCESS_TOKEN)
  )
  .addOption(
    new Option("--cookie-refresh-token <cookie>", "cookie refresh token")
      .env(ENV_PREFIX + "COOKIE_REFRESH_TOKEN")
      .default(COOKIE_REFRESH_TOKEN)
  );

const config = program.opts();

export type Config = typeof config;
export default program;
