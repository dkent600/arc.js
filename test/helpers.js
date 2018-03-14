import { Utils } from "../test-dist/utils";
import { Config } from "../test-dist/config.js";
import { assert } from "chai";
import { DAO } from "../test-dist/dao.js";
import { Contracts } from "../test-dist/contracts.js";
import { SchemeRegistrar } from "../test-dist/contracts/schemeregistrar";
import { LoggingService, LogLevel } from "../test-dist/loggingService";

export const NULL_HASH = Utils.NULL_HASH;
export const NULL_ADDRESS = Utils.NULL_ADDRESS;
export const SOME_HASH = "0x1000000000000000000000000000000000000000000000000000000000000000";
export const SOME_ADDRESS = "0x1000000000000000000000000000000000000000";

LoggingService.setLogLevel(LogLevel.error | LogLevel.debug);

beforeEach(async () => {
  global.web3 = Utils.getWeb3();
  global.assert = assert;
  global.accounts = [];
  await etherForEveryone();
});

async function etherForEveryone() {
  // give all web3.eth.accounts some ether
  accounts = web3.eth.accounts;
  const count = accounts.length;
  for (let i = 0; i < count; i++) {
    await web3.eth.sendTransaction({
      to: accounts[i],
      from: accounts[0],
      value: web3.toWei(0.1, "ether")
    });
  }
}

export async function forgeDao(opts = {}) {
  const founders = Array.isArray(opts.founders) ? opts.founders :
    [
      {
        address: accounts[0],
        reputation: web3.toWei(1000),
        tokens: web3.toWei(100)
      },
      {
        address: accounts[1],
        reputation: web3.toWei(1000),
        tokens: web3.toWei(100)
      },
      {
        address: accounts[2],
        reputation: web3.toWei(1000),
        tokens: web3.toWei(100)
      }
    ];

  const schemes = Array.isArray(opts.schemes) ? opts.schemes : [
    { name: "SchemeRegistrar" },
    { name: "UpgradeScheme" },
    { name: "GlobalConstraintRegistrar" }
  ];

  return DAO.new({
    name: opts.name || "Skynet",
    tokenName: opts.tokenName || "Tokens of skynet",
    tokenSymbol: opts.tokenSymbol || "SNT",
    schemes: schemes,
    founders: founders
  });
}

/**
 * Register a ContributionReward with the given DAO.
 * @returns the ContributionReward wrapper
 */
export async function addProposeContributionReward(dao) {
  const schemeRegistrar = await getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrar);
  const contributionReward = await dao.getContractWrapper("ContributionReward");

  const votingMachineHash = await getSchemeVotingMachineParametersHash(dao, schemeRegistrar);
  const votingMachine = await getSchemeVotingMachine(dao, schemeRegistrar);

  const schemeParametersHash = (await contributionReward.setParameters({
    orgNativeTokenFee: 0,
    voteParametersHash: votingMachineHash,
    votingMachineAddress: votingMachine.address
  })).result;

  const result = await schemeRegistrar.proposeToAddModifyScheme({
    avatar: dao.avatar.address,
    scheme: contributionReward.address,
    schemeName: "ContributionReward",
    schemeParametersHash: schemeParametersHash
  });

  const proposalId = result.proposalId;

  await vote(votingMachine, proposalId, 1, accounts[1]);
  return contributionReward;
}

export async function getSchemeVotingMachineParametersHash(dao, scheme) {
  return (await scheme.getSchemeParameters(dao.avatar.address)).voteParametersHash;
}

export async function getSchemeVotingMachine(dao, scheme, votingMachineName) {
  const votingMachineAddress = (await scheme.getSchemeParameters(dao.avatar.address)).votingMachineAddress;
  votingMachineName = votingMachineName || Config.get("defaultVotingMachine");
  return Contracts.getContractWrapper(votingMachineName, votingMachineAddress);
}

export async function getVotingMachineParameters(votingMachine, votingMachineParamsHash) {
  return votingMachine.contract.parameters(votingMachineParamsHash);
}

/**
 * vote for the proposal given by proposalId.
 */
export async function vote(votingMachine, proposalId, vote, voter) {
  voter = (voter ? voter : accounts[0]);
  /**
   * depending on whether or not the wrapper was passed, do the right thing
   */
  if (votingMachine.contract) {
    return await votingMachine.vote({ proposalId: proposalId, vote: vote, onBehalfOf: voter });
  } else {
    return await votingMachine.vote(proposalId, vote, { from: voter });
  }
}

export async function voteWasExecuted(votingMachine, proposalId) {
  return new Promise(async (resolve) => {
    let event;
    /**
     * depending on whether or not the wrapper was passed, do the right thing
     */
    if (votingMachine.contract) {
      event = votingMachine.contract.ExecuteProposal({ "_proposalId": proposalId }, { fromBlock: 0 });
    } else {
      event = votingMachine.ExecuteProposal({ "_proposalId": proposalId }, { fromBlock: 0 });
    }
    event.get((err, events) => {
      resolve(events.length === 1);
    });
  });
}

export const outOfGasMessage =
  "VM Exception while processing transaction: out of gas";

export function assertJumpOrOutOfGas(error) {
  const condition =
    error.message === outOfGasMessage ||
    error.message.search("invalid JUMP") > -1;
  assert.isTrue(
    condition,
    "Expected an out-of-gas error or an invalid JUMP error, got this instead: " +
    error.message
  );
}

export function assertVMException(error) {
  const condition = error.message.search("VM Exception") > -1;
  assert.isTrue(
    condition,
    "Expected a VM Exception, got this instead:" + error.message
  );
}

export function assertInternalFunctionException(error) {
  const condition = error.message.search("is not a function") > -1;
  assert.isTrue(
    condition,
    "Expected a function not found Exception, got this instead:" + error.message
  );
}

export function assertJump(error) {
  assert.isAbove(
    error.message.search("invalid JUMP"),
    -1,
    "Invalid JUMP error must be returned" + error.message
  );
}

export async function contractsForTest() {
  return await Contracts.getDeployedContracts();
}

// Increases ganache time by the passed duration in seconds
export async function increaseTime(duration) {
  const id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) { return reject(err1); }

      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
}

export async function getDaoScheme(dao, schemeName, factory) {
  return factory.at((await dao.getSchemes(schemeName))[0].address);
}

/**
 * Transfer tokens
 * @param {DAO} dao
 * @param {number} amount - will be converted to Wei
 * @param {string} fromAddress - optional, default is accounts[0]
 * @param {string} token - token contract.  optional, default is dao.token
 */
export async function transferTokensToDao(dao, amount, fromAddress, token) {
  fromAddress = fromAddress || accounts[0];
  token = token ? token : dao.token;
  return token.transfer(dao.avatar.address, web3.toWei(amount), { from: fromAddress });
}

/**
 * Send eth to the dao's avatar
 * @param {DAO} dao
 * @param {number} amount -- will be converted to Wei
 * @param {string} fromAddress  - optional, default is accounts[0]
 */
export async function transferEthToDao(dao, amount, fromAddress) {
  fromAddress = fromAddress || accounts[0];
  return web3.eth.sendTransaction({ from: fromAddress, to: dao.avatar.address, value: web3.toWei(amount) });
}
