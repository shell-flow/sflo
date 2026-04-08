import { getKey } from "@internal/dependency-injection/get-key";
import type { InjectionToken } from "@public/dependency-injection/injection-token";

export class DIContainer {
  private registry = new Map<symbol, unknown>();
  
  register<T>(token: InjectionToken<T>, value: T): void;
  register<T>(token: Constructor<T>, value: T): void;
  register<T>(token: Token<T>, value: T): void {
    this.registry.set(getKey(token), value); 
  }

  get<T>(token: Token<T>): T {
    const injectable = this.registry.get(getKey(token));
    if(!injectable) throw new Error(`Token '${token.toString()}' not registered`);

    return injectable as T;
  }
}
