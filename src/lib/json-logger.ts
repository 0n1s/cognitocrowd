import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

type LogLevel = 'info' | 'warn' | 'error';

type LogRecord = {
  ts: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
};

function normalizeError(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

function safeJsonStringify(record: LogRecord): string {
  return JSON.stringify(record, (_key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return normalizeError(value);
  });
}

export async function logJsonEvent(
  event: string,
  data?: Record<string, unknown>,
  level: LogLevel = 'info'
) {
  try {
    const configuredPath = process.env.APP_JSON_LOG_FILE;
    const logFilePath = configuredPath
      ? path.resolve(configuredPath)
      : path.resolve(process.cwd(), 'logs', 'app-events.jsonl');

    await mkdir(path.dirname(logFilePath), { recursive: true });

    const line = safeJsonStringify({
      ts: new Date().toISOString(),
      level,
      event,
      data,
    });

    await appendFile(logFilePath, `${line}\n`, 'utf8');
  } catch (error) {
    // Never break request/flow execution because file logging failed.
    console.error('[json-logger] failed', normalizeError(error));
  }
}
