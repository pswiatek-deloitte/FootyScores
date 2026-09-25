export class SourceDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SourceDataError";
  }
}

export function asRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SourceDataError(`${context} must be an object`);
  }

  return value as Record<string, unknown>;
}

export function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceDataError(`${context} must be a non-empty string`);
  }

  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

export function requiredInteger(value: unknown, context: string): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new SourceDataError(`${context} must be a non-negative integer`);
  }

  return numberValue;
}

export function requiredArray(
  value: unknown,
  context: string,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new SourceDataError(`${context} must be an array`);
  }

  return value;
}
