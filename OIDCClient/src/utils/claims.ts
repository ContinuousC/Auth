/******************************************************************************
 * Copyright ContinuousC. Licensed under the "Elastic License 2.0".           *
 ******************************************************************************/

import { parse as yamlParse } from "yaml";
import { z } from "zod";
import { IdTokenClaims } from "openid-client";

import { ClaimParserError } from "../errors.js";

const pipeParserConfig = z.array(
  z.discriminatedUnion("func", [
    z.object({ func: z.literal("CapitalizeFirstLetter") }),
    z.object({ func: z.literal("Sufix"), value: z.string() }),
    z.object({
      func: z.literal("EqualsString"),
      value: z.string(),
    }),
    z.object({
      func: z.literal("OneValueFromArrayPrio"),
      value: z.array(z.string()),
    }),
    z.object({
      func: z.literal("Mapper"),
      value: z.record(z.string()),
    }),
  ])
);
type PipeParserConfig = z.infer<typeof pipeParserConfig>;
class PipeParser {
  private parsers: Parser[];
  constructor(parsedConfig: PipeParserConfig) {
    this.parsers = this.parseSchema(parsedConfig);
  }
  run(initData: unknown) {
    const value = this.parsers.reduce((data, parser) => {
      if (typeof data === "string" || Array.isArray(data)) {
        return parser.run(data);
      }
      return null;
    }, initData);
    if (typeof value === "string") {
      return value;
    }
    return null;
  }
  private parseSchema(parsedConfig: PipeParserConfig): Parser[] {
    return parsedConfig.map((parser) => {
      if (parser.func === "CapitalizeFirstLetter") {
        return new CapitalizeFirstLetterParser();
      } else if (parser.func === "Sufix") {
        return new SufixParser(parser.value);
      } else if (parser.func === "EqualsString") {
        return new EqualStringParser(parser.value);
      } else if (parser.func === "OneValueFromArrayPrio") {
        return new OneValueFromArrayPrioParser(parser.value);
      } else if (parser.func === "Mapper") {
        return new MapperParser(parser.value);
      }
      throw new ClaimParserError("Parser not implemented");
    });
  }
}

type ParserInput = string | any[];
interface Parser {
  run(data: ParserInput): string | null;
}
class CapitalizeFirstLetterParser implements Parser {
  run(data: unknown) {
    if (typeof data === "string" && data.length > 0) {
      return (
        data.charAt(0).toUpperCase() + (data.length > 1 ? data.slice(1) : "")
      );
    }
    return null;
  }
}
class SufixParser implements Parser {
  sufix: string;
  constructor(sufix: string) {
    this.sufix = sufix;
  }
  run(data: ParserInput) {
    if (typeof data === "string") {
      return data + this.sufix;
    }
    return null;
  }
}
class EqualStringParser implements Parser {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
  run(data: ParserInput) {
    if (typeof data === "string" && data === this.value) {
      return data;
    }
    return null;
  }
}
class OneValueFromArrayPrioParser implements Parser {
  value: string[];
  constructor(value: string[]) {
    this.value = value;
  }
  run(data: ParserInput) {
    if (Array.isArray(data)) {
      const valueMatched = data.filter(
        (val: any) => typeof val === "string" && this.value.includes(val)
      );
      const valueMatchPrio = this.value.find((val) =>
        valueMatched.includes(val)
      );
      if (valueMatchPrio !== undefined) {
        return valueMatchPrio;
      }
    }
    return null;
  }
}
class MapperParser implements Parser {
  value: { [key: string]: string };
  constructor(value: { [key: string]: string }) {
    this.value = value;
  }
  run(data: ParserInput) {
    if (typeof data === "string" && data in this.value) {
      return this.value[data];
    }
    return null;
  }
}

const claimConfig = z.object({
  callbackRedirect: z
    .object({
      claimPath: z.string(),
      pipeParser: pipeParserConfig,
    })
    .optional(),
  forwardedHeaders: z
    .array(
      z.object({
        header: z.string(),
        claimPath: z.string(),
        pipeParser: pipeParserConfig,
      })
    )
    .optional(),
  authorizationCheck: z
    .array(
      z.object({
        value: z.string().or(z.function(z.tuple([z.string()]), z.boolean())),
        claimPath: z.string(),
        pipeParser: pipeParserConfig,
      })
    )
    .optional(),
});
export type ClaimConfig = z.infer<typeof claimConfig>;
interface ClaimPipeParser {
  callbackRedirect: {
    claimPath: string;
    pipeParser: PipeParser;
  } | null;
  forwardedHeaders:
    | {
        header: string;
        claimPath: string;
        pipeParser: PipeParser;
      }[]
    | null;
  authorizationCheck:
    | {
        value: string | ((value: string) => boolean);
        claimPath: string;
        pipeParser: PipeParser;
      }[]
    | null;
}
interface ClaimResult {
  callbackRedirect: string | null;
  forwardedHeaders: { [headers: string]: string } | null;
  authorizationCheck: boolean | null;
}
//Can be more generic/idiomatic if this only has 1 run function, and all functionality is implemented by parsers. More difficult, so this is ok for the moment for our use case
export class ClaimParser {
  private pipeParser: ClaimPipeParser;
  constructor(configs: any, { yaml }: { yaml: boolean } = { yaml: false }) {
    if (yaml) {
      configs = yamlParse(configs);
    }
    this.pipeParser = this.getPipeParsers(claimConfig.parse(configs));
  }

  callbackRedirect(claims: IdTokenClaims): ClaimResult["callbackRedirect"] {
    const parser = this.pipeParser.callbackRedirect;
    if (parser === null) {
      return null;
    }
    const claimValue = this.getNestedFieldFromString(claims, parser.claimPath);
    const claimParsedvalue = parser.pipeParser.run(claimValue);
    if (claimParsedvalue === null) {
      throw new ClaimParserError("Could not parse claimValue");
    }
    return claimParsedvalue;
  }

  forwardedHeaders(claims: IdTokenClaims): ClaimResult["forwardedHeaders"] {
    const parsers = this.pipeParser.forwardedHeaders;
    if (parsers === null) {
      return null;
    }
    const result: ClaimResult["forwardedHeaders"] = {};
    parsers.forEach((parser) => {
      const claimValue = this.getNestedFieldFromString(
        claims,
        parser.claimPath
      );
      const claimParsedvalue = parser.pipeParser.run(claimValue);
      if (claimParsedvalue === null) {
        throw new ClaimParserError(
          `Could not parse claimValue: ${parser.header}: ${claimValue}`
        );
      }
      result[parser.header] = claimParsedvalue;
    });
    return result;
  }

  authorizationCheck(claims: IdTokenClaims): ClaimResult["authorizationCheck"] {
    const parsers = this.pipeParser.authorizationCheck;
    if (parsers === null) {
      return null;
    }
    for (const parser of parsers) {
      const claimValue = this.getNestedFieldFromString(
        claims,
        parser.claimPath
      );
      const claimParsedvalue = parser.pipeParser.run(claimValue);
      if (claimParsedvalue === null) {
        throw new ClaimParserError("Could not parse claimValue");
      }
      if (
        typeof parser.value === "string"
          ? claimParsedvalue !== parser.value
          : !parser.value(claimParsedvalue)
      ) {
        return false;
      }
    }
    return true;
  }

  private getPipeParsers(config: ClaimConfig) {
    const claimPipeParser: ClaimPipeParser = {
      callbackRedirect: null,
      forwardedHeaders: null,
      authorizationCheck: null,
    };
    if (config.callbackRedirect !== undefined) {
      claimPipeParser.callbackRedirect = {
        claimPath: config.callbackRedirect.claimPath,
        pipeParser: new PipeParser(config.callbackRedirect.pipeParser),
      };
    }
    if (config.forwardedHeaders !== undefined) {
      claimPipeParser.forwardedHeaders = config.forwardedHeaders.map(
        (config) => ({
          header: config.header,
          claimPath: config.claimPath,
          pipeParser: new PipeParser(config.pipeParser),
        })
      );
    }
    if (config.authorizationCheck !== undefined) {
      claimPipeParser.authorizationCheck = config.authorizationCheck.map(
        (config) => ({
          value: config.value,
          claimPath: config.claimPath,
          pipeParser: new PipeParser(config.pipeParser),
        })
      );
    }
    return claimPipeParser;
  }

  private getNestedFieldFromString(initData: any, path: string) {
    const properties = path.split(".");
    return properties.reduce((data, property) => {
      if (data === null || data === undefined) {
        throw new ClaimParserError("Claimpath does not exist");
      }
      if (Array.isArray(data) && !isNaN(Number(property))) {
        return data[Number(property)];
      } else if (typeof data !== "object") {
        throw new ClaimParserError("Claimpath does not exist");
      } else if (property in data) {
        return data[property];
      } else {
        throw new ClaimParserError("Claimpath does not exist");
      }
    }, initData);
  }
}
