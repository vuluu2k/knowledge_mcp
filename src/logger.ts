export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private minLevel: number;

  constructor(level: LogLevel = "info") {
    this.minLevel = LEVEL_ORDER[level];
  }

  private emit(level: LogLevel, msg: string, data?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg,
    };
    if (data) entry.data = data;
    // MCP uses stdout for protocol — all logs go to stderr
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  /** Check if a level would be emitted — avoids allocating data objects for suppressed levels */
  isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= this.minLevel;
  }

  debug(msg: string, data?: Record<string, unknown>) {
    this.emit("debug", msg, data);
  }
  info(msg: string, data?: Record<string, unknown>) {
    this.emit("info", msg, data);
  }
  warn(msg: string, data?: Record<string, unknown>) {
    this.emit("warn", msg, data);
  }
  error(msg: string, data?: Record<string, unknown>) {
    this.emit("error", msg, data);
  }
}

let _logger: Logger | undefined;

export function getLogger(): Logger {
  if (!_logger) {
    const level = (process.env.LOG_LEVEL || "info") as LogLevel;
    _logger = new Logger(level);
  }
  return _logger;
}
