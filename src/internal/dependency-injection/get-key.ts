import { InjectionToken } from "../../public/dependency-injection/injection-token";

export function getKey<T>(token: Token<T>):symbol{
  if (token instanceof InjectionToken){
    return token.symbol;
  }

  const existingSymbol = Reflect.getMetadata("injection:symbol", token) as symbol | undefined;
  if(existingSymbol){
    return existingSymbol
  }

  const newSymbol = Symbol(token.name);
  Reflect.defineMetadata("injection:symbol", newSymbol, token);
  return newSymbol;
}
