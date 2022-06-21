import { AbiItem } from 'web3-utils/types'
import { TransactionReceipt } from 'web3-core'
import SideStakingAbi from '@oceanprotocol/contracts/artifacts/contracts/pools/ssContracts/SideStaking.sol/SideStaking.json'
import { LoggerInstance, calculateEstimatedGas } from '../../utils'
import { SmartContract } from '..'

export class SideStaking extends SmartContract {
  getDefaultAbi(): AbiItem | AbiItem[] {
    return SideStakingAbi.abi as AbiItem[]
  }

  /**
   * Get (total vesting amount + token released from the contract when adding liquidity)
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatoken address
   * @return {String}
   */
  public async getDatatokenCirculatingSupply(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const supply = await sideStaking.methods
      .getDatatokenCirculatingSupply(datatokenAddress)
      .call()
    return supply.toString()
  }

  /**
   * Get actual dts in circulation (vested token withdrawn from the contract +
         token released from the contract when adding liquidity)
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatoken address
   * @return {String}
   */
  public async getDatatokenCurrentCirculatingSupply(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const supply = await sideStaking.methods
      .getDatatokenCurrentCirculatingSupply(datatokenAddress)
      .call()
    return supply.toString()
  }

  /**
   * Get Publisher address
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatoken address
   * @return {String}
   */
  public async getPublisherAddress(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const address = await sideStaking.methods.getPublisherAddress(datatokenAddress).call()
    return address
  }

  /**
   * Get
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  public async getBasetoken(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const address = await sideStaking.methods.getBaseTokenAddress(datatokenAddress).call()
    return address
  }

  /**
   * Get Pool Address
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  public async getPoolAddress(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const address = await sideStaking.methods.getPoolAddress(datatokenAddress).call()
    return address
  }

  /**
   * Get baseToken balance in the contract
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  public async getBasetokenBalance(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const balance = await sideStaking.methods.getBaseTokenBalance(datatokenAddress).call()
    return balance
  }

  /**
   * Get dt balance in the staking contract available for being added as liquidity
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  public async getDatatokenBalance(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let balance = await sideStaking.methods.getDatatokenBalance(datatokenAddress).call()
    balance = await this.unitsToAmount(datatokenAddress, balance, tokenDecimals)
    return balance
  }

  /**
   * Get block when vesting ends
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String} end block for vesting amount
   */
  public async getVestingEndBlock(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const block = await sideStaking.methods.getvestingEndBlock(datatokenAddress).call()
    return block
  }

  /**
   * Get total amount vesting
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  public async getVestingAmount(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let amount = await sideStaking.methods.getvestingAmount(datatokenAddress).call()
    amount = await this.unitsToAmount(datatokenAddress, amount, tokenDecimals)
    return amount
  }

  /**
   * Get last block publisher got some vested tokens
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  public async getVestingLastBlock(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const block = await sideStaking.methods.getvestingLastBlock(datatokenAddress).call()
    return block
  }

  /**
   * Get how much has been taken from the vesting amount
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  public async getVestingAmountSoFar(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let amount = await sideStaking.methods.getvestingAmountSoFar(datatokenAddress).call()
    amount = await this.unitsToAmount(datatokenAddress, amount, tokenDecimals)
    return amount
  }

  /** Send vested tokens available to the publisher address, can be called by anyone
   *
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {TransactionReceipt}
   */
  public async getVesting<G extends boolean = false>(
    account: string,
    ssAddress: string,
    datatokenAddress: string,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const sideStaking = this.getContract(ssAddress)

    const estGas = await calculateEstimatedGas(
      account,
      sideStaking.methods.getVesting,
      datatokenAddress
    )
    if (estimateGas) return estGas

    const vesting = await sideStaking.methods.getVesting(datatokenAddress).send({
      from: account,
      gas: estGas + 1,
      gasPrice: await this.getFairGasPrice()
    })
    return vesting
  }

  /** Send vested tokens available to the publisher address, can be called by anyone
   *
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {TransactionReceipt}
   */
  public async setPoolSwapFee<G extends boolean = false>(
    account: string,
    ssAddress: string,
    datatokenAddress: string,
    poolAddress: string,
    swapFee: number,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const sideStaking = this.getContract(ssAddress)

    const estGas = await calculateEstimatedGas(
      account,
      sideStaking.methods.setPoolSwapFee,
      datatokenAddress,
      poolAddress,
      swapFee
    )
    if (estimateGas) return estGas

    const fee = await sideStaking.methods
      .setPoolSwapFee(datatokenAddress, poolAddress, swapFee)
      .send({
        from: account,
        gas: estGas + 1,
        gasPrice: await this.getFairGasPrice()
      })
    return fee
  }

  /**
   * Get Router address set in side staking contract
   * @param {String} ssAddress side staking contract address
   * @return {String}
   */
  public async getRouter(ssAddress: string): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    const router = await sideStaking.methods.router().call()
    return router
  }
}