import { InjectionToken } from "@public/dependency-injection/injection-token";

export interface Logger {
  /**
   * Logs a standard message
   *
   * @param args - Message content to log (can be multiple arguments)
   *
   * @example
   * ```ts
   * logger.log('User created successfully');
   * logger.log('Processing:', filename, 'with size:', size, 'bytes');
   * ```
   */
  log(...args: string[]): void;
  /**
   * Logs an error message
   *
   * @param args - Error message content (can be multiple arguments)
   *
   * @example
   * ```ts
   * logger.error('Failed to connect to database');
   * logger.error('Error code:', code, 'Details:', errorDetails);
   * ```
   */
  error(...args: string[]): void;
  /**
   * Logs a warning message
   *
   * @param args - Warning message content (can be multiple arguments)
   *
   * @example
   * ```ts
   * logger.warn('Deprecated API usage detected');
   * logger.warn('Configuration:', key, 'will be removed in v2.0');
   * ```
   */
  warn(...args: string[]): void;
  /**
   * Logs a success message
   *
   * @param args - Success message content (can be multiple arguments)
   *
   * @example
   * ```ts
   * logger.success('Build completed');
   * logger.success('✅ Deployment', 'to production', 'finished');
   * ```
   */
  success(...args: string[]): void;
  /**
   * Logs a verbose/debug message
   *
   * @param args - Verbose message content (can be multiple arguments)
   *
   * @example
   * ```ts
   * logger.verbose('Parsing configuration file');
   * logger.verbose('Request headers:', JSON.stringify(headers));
   * ```
   */
  verbose(...args: string[]): void;
}

export const Logger = new InjectionToken<Logger>("Logger");
