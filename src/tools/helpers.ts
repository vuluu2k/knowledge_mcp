import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BrainError, toErrorMessage } from "../errors.js";
import { getLogger } from "../logger.js";

function textResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown): CallToolResult {
  const msg = toErrorMessage(err);
  const code = err instanceof BrainError ? err.code : "UNKNOWN";
  return {
    content: [{ type: "text", text: JSON.stringify({ error: msg, code }) }],
    isError: true,
  };
}

/**
 * Wraps a tool handler with standardized error handling and logging.
 */
export function toolHandler<T>(
  name: string,
  fn: (args: T) => Promise<unknown>
): (args: T) => Promise<CallToolResult> {
  return async (args: T) => {
    const log = getLogger();
    log.debug(`tool:${name}`, { args });
    try {
      const result = await fn(args);
      return textResult(result);
    } catch (err) {
      log.error(`tool:${name} failed`, {
        error: toErrorMessage(err),
        args: args as Record<string, unknown>,
      });
      return errorResult(err);
    }
  };
}
