/**
 * Structured Logger Service
 *
 * Provides leveled, JSON-structured logging for both request logging
 * (HTTP method, endpoint, duration, status, user_id) and business
 * logging (AI calls, PDF parsing, repository operations).
 *
 * Usage:
 *   const logger = createLogger({ level: "info" });
 *   logger.info("Candidate analyzed", { candidateId: 1, score: 85 });
 *
 *   const dbLogger = logger.child({ module: "CandidateRepository" });
 *   dbLogger.debug("SELECT candidates");
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LoggerConfig {
  /** Minimum log level to emit. Default: "info". */
  level?: LogLevel;
  /** When true, outputs human-readable lines instead of JSON. Default: false. */
  prettyPrint?: boolean;
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

/** Create a new Logger instance. */
export const createLogger = (config?: LoggerConfig): Logger =>
  createLoggerInstance({
    level: config?.level ?? "info",
    prettyPrint: config?.prettyPrint ?? false,
    bindings: {},
  });

// ── Internal single-source-of-truth factory ──────────────────────────

interface LoggerState {
  level: LogLevel;
  prettyPrint: boolean;
  bindings: Record<string, unknown>;
}

const createLoggerInstance = (state: LoggerState): Logger => {
  const minLevelRank = LOG_LEVEL_RANK[state.level];

  const emit =
    (level: LogLevel) =>
    (message: string, meta?: Record<string, unknown>): void => {
      if (LOG_LEVEL_RANK[level] < minLevelRank) {
        return;
      }

      const entry: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...state.bindings,
        ...meta,
      };

      const output =
        state.prettyPrint ? formatPretty(entry, message, level) : JSON.stringify(entry) + "\n";

      if (level === "error" || level === "warn") {
        process.stderr.write(output);
      } else {
        process.stdout.write(output);
      }
    };

  return {
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
    child: (newBindings: Record<string, unknown>): Logger =>
      createLoggerInstance({
        ...state,
        bindings: { ...state.bindings, ...newBindings },
      }),
  };
};

// ── Pretty-print helpers ─────────────────────────────────────────────

const formatPretty = (
  entry: Record<string, unknown>,
  message: string,
  level: LogLevel,
): string => {
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
  const extraKeys = Object.keys(entry).filter(
    (k) => k !== "timestamp" && k !== "level" && k !== "message",
  );

  const metaPart = extraKeys.length > 0 ? ` ${JSON.stringify(entry)}` : "";
  return `${prefix} ${message}${metaPart}\n`;
};
