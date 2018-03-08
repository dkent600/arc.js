"use strict";
import { Hash } from "../../commonTypes";
import ContractWrapperFactory from "../../ContractWrapperFactory";
import { ArcTransactionDataResult, ExtendTruffleContract } from "../../ExtendTruffleContract";

export class TestWrapperWrapper extends ExtendTruffleContract {

  public foo(): string {
    return "bar";
  }

  public aMethod(): string {
    return "abc";
  }

  public async setParameters(params: AbsoluteVoteParams): Promise<ArcTransactionDataResult<Hash>> {
    params = Object.assign({},
      {
        ownerVote: true,
        reputation: "0x1000000000000000000000000000000000000000",
        votePerc: 50,
      },
      params);

    return super._setParams(
      ["address", "uint", "bool"],
      params.reputation,
      params.votePerc,
      params.ownerVote
    );
  }

  public getDefaultPermissions(overrideValue?: string): string {
    return overrideValue || "0x00000009";
  }
}

const TestWrapper = new ContractWrapperFactory("AbsoluteVote", TestWrapperWrapper);
export { TestWrapper };
