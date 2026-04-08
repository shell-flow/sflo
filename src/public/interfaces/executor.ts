import { InjectionToken } from "@public/dependency-injection/injection-token";

export interface Executor {
  /**
   * Executes a command asynchronously in the system shell
   *
   * @param command - The command string to execute
   * @returns A promise that resolves with the command execution result
   *
   * @example
   * ```ts
   * const result = await executor.run('npm install');
   * console.log('Output:', result.stdout);
   *
   * if (result.error) {
   *   console.error('Failed:', result.error);
   * }
   * ```
   */
  run: (command: string) => Promise<{
    /** Standard output from the command */
    stdout: string;
    /** Standard error output from the command */
    stderr: string;
    /** Error message if the command failed, null if successful */
    error: string | null;
  }>;
  /**
   * Executes a command synchronously (blocking) in the system shell
   *
   * @param command - The command string to execute
   * @returns The command execution result
   *
   * @example
   * ```ts
   * const result = executor.runSync('echo "Hello World"');
   * console.log(result.stdout); // "Hello World"
   * ```
   */
  runSync: (command: string) => {
    /** Standard output from the command */
    stdout: string;
    /** Standard error output from the command */
    stderr: string;
    /** Error message if the command failed, null if successful */
    error: string | null;
  };
  /**
   * Executes a command with separate arguments asynchronously
   *
   * This method is safer than run() when dealing with dynamic arguments,
   * as it properly escapes and handles spaces and special characters
   *
   * @param command - The command/executable name to run
   * @param args - Array of arguments to pass to the command
   * @returns A promise that resolves with the command execution result
   *
   * @example
   * ```ts
   * // Clone a git repository
   * const result = await executor.runWithArgs('git', [
   *   'clone',
   *   'https://github.com/user/repo.git',
   *   './repo'
   * ]);
   *
   * // Run npm script with arguments
   * const buildResult = await executor.runWithArgs('npm', [
   *   'run',
   *   'build',
   *   '--',
   *   '--production'
   * ]);
   *
   * // Copy files with spaces in names
   * const copyResult = await executor.runWithArgs('cp', [
   *   'my file with spaces.txt',
   *   'destination folder/file.txt'
   * ]);
   * ```
   */
  runWithArgs: (
    command: string,
    args: string[],
  ) => Promise<{
    /** Standard output from the command */
    stdout: string;
    /** Standard error output from the command */
    stderr: string;
    /** Error message if the command failed, null if successful */
    error: string | null;
  }>;
}

export const Executor = new InjectionToken<Executor>("Executor");
