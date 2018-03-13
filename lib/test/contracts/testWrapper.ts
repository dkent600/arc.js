"use strict";
import { Hash } from "../../commonTypes";
import { AbsoluteVoteParams } from "../../contracts/absoluteVote";
import ContractWrapperFactory from "../../ContractWrapperFactory";
import { ArcTransactionDataResult, ExtendTruffleContract } from "../../ExtendTruffleContract";

export class TestWrapperWrapper extends ExtendTruffleContract {
  /**
   * Name used by Arc.js.Contracts and Arc.
   */
  public shortName: string = "TestWrapper";
  /**
   * Friendly name of the contract
   */
  public longName: string = "Test Wrapper";

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

    return super._setParameters(
      ["address", "uint", "bool"],
      [params.reputation, params.votePerc, params.ownerVote]
    );
  }

  public getDefaultPermissions(overrideValue?: string): string {
    return overrideValue || "0x00000009";
  }
}

const TestWrapper = new ContractWrapperFactory("AbsoluteVote", TestWrapperWrapper);
export { TestWrapper };
