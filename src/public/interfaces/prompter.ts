import { InjectionToken } from "@public/dependency-injection/injection-token";

export interface Prompter {
  /**
   * Asks an open-ended question and returns the user's response
   *
   * @param question - The question to display
   * @returns The user's input
   *
   * @example
   * ```ts
   * const name = await prompter.ask('What is your name?');
   * ```
   */
  ask: (question: string) => Promise<string>;
  /**
   * Allows the user to select a single option from a list
   *
   * @template T - The type of the returned value (default: string)
   * @param question - The question to display
   * @param options - Text options to display
   * @param values - Corresponding values for the options (optional, uses options if not provided)
   * @returns The selected value
   *
   * @example
   * ```ts
   * // With strings
   * const color = await prompter.pickOne('Favorite color?', ['Red', 'Blue']);
   *
   * // With custom values
   * const status = await prompter.pickOne(
   *   'Status:',
   *   ['Active', 'Inactive'],
   *   [1, 0]
   * );
   * ```
   */
  pickOne: <T = string>(
    question: string,
    options: string[],
    values?: T[],
  ) => Promise<T>;
  /**
   * Allows the user to select multiple options from a list
   *
   * @template T - The type of the returned values (default: string)
   * @param question - The question to display
   * @param options - Text options to display
   * @param values - Corresponding values for the options (optional, uses options if not provided)
   * @returns Array with the selected values
   *
   * @example
   * ```ts
   * // With strings
   * const features = await prompter.pickMany(
   *   'Select features:',
   *   ['Auth', 'DB', 'Cache']
   * );
   *
   * // With custom values
   * const permissions = await prompter.pickMany(
   *   'Permissions:',
   *   ['Read', 'Write', 'Delete'],
   *   ['read', 'write', 'delete']
   * );
   * ```
   */
  pickMany: <T = string>(
    question: string,
    options: string[],
    values?: T[],
  ) => Promise<T[]>;
  /**
   * Asks a yes/no question and returns a boolean
   *
   * @param question - The question to display
   * @returns true if confirmed, false otherwise
   *
   * @example
   * ```ts
   * const confirmed = await prompter.confirm('Do you want to continue?');
   * if (confirmed) {
   *   // ...
   * }
   * ```
   */
  confirm: (question: string) => Promise<boolean>;
  /**
   * Prompts for a password (with masked input)
   *
   * @param question - The question/label to display
   * @returns The entered password
   *
   * @example
   * ```ts
   * const pwd = await prompter.password('Enter your password:');
   * ```
   */
  password: (question: string) => Promise<string>;
  /**
   * Pauses execution and waits for the user to press Enter
   *
   * @param message - Optional message to display (default: "Press Enter to continue...")
   *
   * @example
   * ```ts
   * await prompter.pause('Press Enter to continue');
   * ```
   */
  pause: (message?: string) => Promise<void>;
  /**
   * Displays a simple message on the console
   *
   * @param message - The message to display
   *
   * @example
   * ```ts
   * prompter.say('✅ Installation completed!');
   * ```
   */
  say: (message: string) => void;
  /**
   * Displays a loading/progress indicator
   *
   * @param message - Optional message to display during loading
   * @returns Object with methods to control the progress
   *
   * @example
   * ```ts
   * const loader = prompter.load('Installing dependencies...');
   * loader.update(25);
   * loader.update(50);
   * loader.update(100);
   * loader.finish(); // or loader.error('Installation failed')
   * ```
   */
  load: (message?: string) => {
    /**
     * Updates the loading progress
     * @param current - Progress percentage (0-100)
     */
    update: (current: number) => void;
    /**
     * Completes the loading successfully
     */
    finish: () => void;
    /**
     * Marks the loading as failed
     * @param message - Error message to display
     */
    error: (message: string) => void;
  };
  /**
   * Displays data in a formatted table
   *
   * @template T - The type of objects to display
   * @param columns - Columns to display (keys of T)
   * @param rows - Data to display
   * @param formatters - Custom formatters per column (optional)
   *
   * @example
   * ```ts
   * interface User {
   *   id: number;
   *   email: string;
   *   createdAt: Date;
   * }
   *
   * const users: User[] = [
   *   { id: 1, email: 'user@example.com', createdAt: new Date() }
   * ];
   *
   * await prompter.showTable(
   *   ['id', 'email', 'createdAt'],
   *   users,
   *   {
   *     createdAt: (date) => date.toLocaleDateString('en-US'),
   *     email: (email) => email.toLowerCase()
   *   }
   * );
   * ```
   */
  showTable: <T extends Record<string, any>>(
    columns: (keyof T)[],
    rows: T[],
    formatters?: {
      [K in keyof T]?: (value: T[K]) => string;
    },
  ) => Promise<void>;
}

export const Prompter = new InjectionToken<Prompter>("Prompter");
