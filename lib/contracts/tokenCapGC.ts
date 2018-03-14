"use strict";
import { Address, Hash } from "../commonTypes";
import {
  ArcTransactionDataResult,
  ExtendTruffleContract,
} from "../ExtendTruffleContract";

import ContractWrapperFactory from "../ContractWrapperFactory";

export class TokenCapGCWrapper extends ExtendTruffleContract {
  /**
   * Name used by Arc.js.Contracts and Arc.
   */
  public shortName: string = "TokenCapGC";
  /**
   * Friendly name of the contract
   */
  public longName: string = "Token Cap GC";

  public async setParameters(params: TokenCapGcParams): Promise<ArcTransactionDataResult<Hash>> {

    if (!params.token) {
      throw new Error("token must be set");
    }

    if (((typeof params.cap !== "number") &&
      ((typeof params.cap !== "string") ||
        (isNaN(parseInt(params.cap, undefined)))))) {
      throw new Error("cap must be set and represent a number");
    }

    return super._setParameters(
      ["address", "uint"],
      [params.token, params.cap]);
  }
}

const TokenCapGC = new ContractWrapperFactory("TokenCapGC", TokenCapGCWrapper);
export { TokenCapGC };

export interface TokenCapGcParams {
  cap: number | string;
  token: Address;
}
