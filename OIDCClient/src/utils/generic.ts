/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

export function encode<T>(state: T) {
  return Buffer.from(JSON.stringify(state), "utf-8").toString("base64");
}
export function decode<T>(encryptedState: string) {
  return JSON.parse(
    Buffer.from(encryptedState, "base64").toString("utf-8")
  ) as T;
}
