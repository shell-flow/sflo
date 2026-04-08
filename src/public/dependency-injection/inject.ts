import { baseContainer } from "@internal/dependency-injection/base-container";
import type { InjectionToken } from "@public/dependency-injection/injection-token";

export function inject<T>(token: InjectionToken<T>): T {
  return baseContainer.get(token);
}
