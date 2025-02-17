/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import program from "./program.js";
import server from "./server.js";

program.parse();
const config = program.opts();
server(config);
