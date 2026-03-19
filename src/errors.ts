export class BrainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "BrainError";
  }
}

export class NotFoundError extends BrainError {
  constructor(path: string) {
    super(`File not found: ${path}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends BrainError {
  constructor(path: string) {
    super(
      `SHA conflict on "${path}" — file was modified externally`,
      "CONFLICT"
    );
    this.name = "ConflictError";
  }
}

export class GitHubApiError extends BrainError {
  constructor(
    message: string,
    public readonly status: number,
    cause?: unknown
  ) {
    super(message, "GITHUB_API", cause);
    this.name = "GitHubApiError";
  }
}

export class ParseError extends BrainError {
  constructor(message: string, cause?: unknown) {
    super(message, "PARSE", cause);
    this.name = "ParseError";
  }
}

export function isNotFound(err: unknown): err is NotFoundError {
  return err instanceof NotFoundError;
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof BrainError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
