import "reflect-metadata";

export class InjectionToken<T> {
  private readonly _symbol: symbol;
  private readonly _description: string;

  constructor(description: string){
    this._description = description;
    this._symbol = Symbol(description);
  }

  get symbol(): symbol {
    return this._symbol;
  }

  toString(): string {
    return `InjectionToken(${this._description})`;
  }
}

