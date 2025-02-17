/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

export function parseErrorMessage(error: any) {
  let errorMessage: string;
  if (error instanceof BaseError) {
    errorMessage = `OIDC client error - ${error.name}: ${error.message}`;
  } else if (error instanceof Error) {
    errorMessage = `${error.name}: ${error.message}`;
  } else {
    errorMessage = JSON.stringify(error);
  }
  return errorMessage;
}

export class BaseError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ClaimParserError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "Claim error";
  }
}

export class OIDCError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "OIDC error";
  }
}

export class TokenError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "Token error";
  }
}

export class CookieError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "Cookie error";
  }
}

export class AuthError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "Auth error";
  }
}

export class LogicError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "Logic error";
  }
}
