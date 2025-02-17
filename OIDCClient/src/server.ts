/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { Config } from "./program.js";
import app from "./app.js";

export default async function server(config: Config) {
  const server = await app(config);
  await server.listen({ port: parseInt(config.port), host: "0.0.0.0" });
}
