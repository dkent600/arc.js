import { promisify } from "es6-promisify";
import abi = require("ethereumjs-abi");
import TruffleContract = require("truffle-contract");
import Web3 = require("web3");
import { Address, Hash } from "./commonTypes";
import { Config } from "./config";
import { ExtendTruffleContract, TransactionReceiptTruffle } from "./ExtendTruffleContract";
import { LoggingService } from "./loggingService";

export class Utils {

  static get NULL_ADDRESS(): Address { return "0x0000000000000000000000000000000000000000"; }
  static get NULL_HASH(): Hash { return "0x0000000000000000000000000000000000000000000000000000000000000000"; }

  /**
   * Returns TruffleContract given the name of the contract (like "SchemeRegistrar").
   * Optimized for synchronicity issues encountered with MetaMask.
   * Throws an exception if it can't load the contract.
   * Uses the asynchronous web.eth.getAccounts to obtain the default account (good with MetaMask).
   * @param contractName like "SchemeRegistrar"
   */
  public static async requireContract(contractName: string): Promise<any> {
    try {
      const artifact = require(`../migrated_contracts/${contractName}.json`);
      const contract = new TruffleContract(artifact);
      const myWeb3 = Utils.getWeb3();

      contract.setProvider(myWeb3.currentProvider);
      contract.defaults({
        from: await Utils.getDefaultAccount(),
        gas: Config.get("gasLimit_runtime"),
      });
      LoggingService.info(`requireContract: loaded ${contractName}`);
      return contract;
    } catch (ex) {
      LoggingService.error(`requireContract failing: ${ex}`);
      throw Error(`requireContract: unable to load solidity contract: ${contractName}: ${ex}`);
    }
  }

  /**
   * Returns the web3 object.
   * When called for the first time, web3 is initialized from the Arc.js configuration.
   * Throws an exception when web3 cannot be initialized.
   */
  public static getWeb3(): any {
    if (Utils.web3) {
      return Utils.web3;
    }

    let preWeb3;

    if (typeof web3 !== "undefined") {
      // Look for injected web3 e.g. by truffle in migrations, or MetaMask in the browser window
      // Instead of using the injected Web3.js directly best practice is to use the version of web3.js we have bundled
      /* tslint:disable-next-line:max-line-length */
      // see https://github.com/MetaMask/faq/blob/master/DEVELOPERS.md#partly_sunny-web3---ethereum-browser-environment-check
      preWeb3 = new Web3(web3.currentProvider);
    } else if (Utils.alreadyTriedAndFailed) {
      // then avoid time-consuming and futile retry
      throw new Error("already tried and failed");
    } else {
      // No web3 is injected, look for a provider at providerUrl:providerPort (which defaults to localhost)
      // This happens when running tests, or in a browser that is not running MetaMask
      preWeb3 = new Web3(
        new Web3.providers.HttpProvider(`${Config.get("providerUrl")}:${Config.get("providerPort")}`)
      );
    }

    if (!preWeb3) {
      Utils.alreadyTriedAndFailed = true;
      throw new Error("web3 not found");
    }

    if (typeof window !== "undefined") {
      // Add to window for easy use in the console
      window.web3 = preWeb3;
    }

    return (Utils.web3 = preWeb3);
  }
  /**
   * Returns a value from the given transaction log.
   * Undefined if not found for any reason.
   *
   * @param tx The transaction
   * @param arg The name of the property whose value we wish to return from the args object:
   *  tx.logs[index].args[argName]
   * @param eventName Overrides index, identifies which log,
   *  where tx.logs[n].event === eventName
   * @param index Identifies which log when eventName is not given
   */
  public static getValueFromLogs(
    tx: TransactionReceiptTruffle,
    arg: string,
    eventName: string = null,
    index: number = 0): any | undefined {
    /**
     *
     * tx is an object with the following values:
     *
     * tx.tx      => transaction hash, string
     * tx.logs    => array of decoded events that were triggered within this transaction
     * tx.receipt => transaction receipt object, which includes gas used
     *
     * tx.logs look like this:
     *
     * [ { logIndex: 13,
     *     transactionIndex: 0,
     *     transactionHash: "0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8",
     *     blockHash: "0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9",
     *     blockNumber: 294,
     *     address: "0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d",
     *     type: "mined",
     *     event: "NewOrg",
     *     args: { _avatar: "0xcc05f0cde8c3e4b6c41c9b963031829496107bbb" } } ]
     */
    if (!tx.logs || !tx.logs.length) {
      // TODO: log "getValueFromLogs: Transaction has no logs");
      return undefined;
    }

    if (eventName && (eventName.length)) {
      for (let i = 0; i < tx.logs.length; i++) {
        if (tx.logs[i].event === eventName) {
          index = i;
          break;
        }
      }
      if (typeof index === "undefined") {
        // TODO: log  `getValueFromLogs: There is no event logged with eventName ${eventName}`
        return undefined;
      }
    } else if (typeof index === "undefined") {
      index = tx.logs.length - 1;
    }
    if (tx.logs[index].type !== "mined") {
      // TODO: log  `getValueFromLogs: transaction has not been mined: ${tx.logs[index].event}`
      return undefined;
    }
    const result = tx.logs[index].args[arg];

    if (!result) {
      // TODO: log  `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`
      return undefined;
    }
    return result;
  }

  /**
   * Returns the address of the default user account.
   *
   * Has the side-effect of setting web3.eth.defaultAccount.
   *
   * Throws an exception on failure.
   */
  public static async getDefaultAccount(): Promise<string> {
    const web3 = Utils.getWeb3();

    return promisify(web3.eth.getAccounts)().then((accounts: Array<any>) => {
      const defaultAccount = web3.eth.defaultAccount = accounts[0];

      if (!defaultAccount) {
        throw new Error("accounts[0] is not set");
      }

      return defaultAccount;
    });
  }

  /**
   * Return the hash of a string the same way solidity would, and to a format that will be
   * properly translated into a bytes32 that solidity expects
   * @param str a string
   */
  public static SHA3(str: string): string {
    return Utils.keccak256(["string"], [str]);
  }

  /**
   * Return the tightly-packed hash of any arbtrary array of
   * object, to a hex format that will be properly translated into
   * a bytes32 that solidity expects.
   *
   * See: https://github.com/ethereumjs/ethereumjs-abi
   *
   * @param types array of type names.  Can be:
   *   case "bytes[N]', - fails if (N < 1 || N > 32)
   *   case "string',
   *   case "bool',
   *   case "address',
   *   case "uint[N]' - fails if ((N % 8) || (N < 8) || (N > 256))
   *   case "int[N]'  - fails if ((N % 8) || (N < 8) || (N > 256))
   * 
   * The types much appear in the same order in which the values are stored in the contracts Parameters struct.
   * 
   * @param values - the values to pack and hash.  These must appear in the same order in which the types are ordered.
   */
  public static keccak256(types: Array<string>, values: Array<any>): string {
    return `0x${abi.soliditySHA3(types, values).toString("hex")}`;
  }

  /**
   * Convert scheme permissions string to a number
   * @param {string} permissions
   */
  public static permissionsStringToNumber(permissions: string): number {
    if (!permissions) { return 0; }
    return Number(permissions);
  }

  /**
   * Convert number to a scheme permissions string
   * @param {Number} permissions
   */
  public static numberToPermissionsString(permissions: number): string {
    if (!permissions) { return "0x00000000"; }
    return `0x${("00000000" + permissions.toString(16)).substr(-8)}`;
  }

  /**
   * Returns whether the given parameters has already been hashed.
   * @param schemeWrapper The scheme ostensibly having the parameters
   * @param types See Utils.keccak256
   * @param parameters The parameters.  Be sure they are given in the same
   * order in which they would be stored by the scheme (see ExtendTruffleContract.setParams).
   */
  public static async parametersHashExists(
    schemeWrapper: ExtendTruffleContract,
    types: Array<string>,
    parameters: Array<any>): Promise<boolean> {

    const hash = Utils.keccak256(types, parameters);

    let existingParams;

    if (schemeWrapper.contract.parameters) {
      existingParams = await schemeWrapper.contract.parameters(hash);
    } else {
      // special case for TokenCapGC
      existingParams = await schemeWrapper.contract.params(hash);
    }
    /**
     * if existingParams is all zeroes, then assume that the parameters have never
     * before been stored.  If any item is not zero, then return true.
     */
    for (let i = 0; i < types.length; ++i) {
      switch (types[i]) {
        case "string":
        case "bool":
          if (existingParams[i]) {
            return true;
          }
          break;
        case "address":
          if (existingParams[i].localeCompare(Utils.NULL_ADDRESS)) {
            return true;
          }
          break;
        default:
          const type: any = types[i];
          if (type.startsWith("uint") || type.startsWith("int")) {
            if (existingParams[i].toNumber()) {
              return true;
            }
          } else if (type.startsWith("bytes")) {
            if (parseInt(existingParams[i], 16)) {
              return true;
            }
          }
          break;
      }
    }
    return false;
  }

  private static web3: Web3 = undefined;
  private static alreadyTriedAndFailed: boolean = false;
}
