import { AbiItem } from 'web3-utils/types'
import { TransactionReceipt } from 'web3-core'
import { Contract } from 'web3-eth-contract'
import SideStakingAbi from '@oceanprotocol/contracts/artifacts/contracts/pools/ssContracts/SideStaking.sol/SideStaking.json'
import { LoggerInstance, estimateGas } from '../../utils'
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
  async getDatatokenCirculatingSupply(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods
        .getDatatokenCirculatingSupply(datatokenAddress)
        .call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result.toString()
  }

  /**
   * Get actual dts in circulation (vested token withdrawn from the contract +
         token released from the contract when adding liquidity)
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatoken address
   * @return {String}
   */
  async getDatatokenCurrentCirculatingSupply(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    try {
      const sideStaking = this.getContract(ssAddress)
      let result = null
      result = await sideStaking.methods
        .getDatatokenCurrentCirculatingSupply(datatokenAddress)
        .call()
      return result.toString()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
  }

  /**
   * Get Publisher address
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatoken address
   * @return {String}
   */
  async getPublisherAddress(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getPublisherAddress(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  async getBaseToken(ssAddress: string, datatokenAddress: string): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getBaseTokenAddress(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get Pool Address
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  async getPoolAddress(ssAddress: string, datatokenAddress: string): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getPoolAddress(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get baseToken balance in the contract
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  async getBaseTokenBalance(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getBaseTokenBalance(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get dt balance in the staking contract available for being added as liquidity
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getDatatokenBalance(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getDatatokenBalance(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    result = await this.unitsToAmount(datatokenAddress, result, tokenDecimals)
    return result
  }

  /**
   * Get block when vesting ends
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String} end block for vesting amount
   */
  async getvestingEndBlock(ssAddress: string, datatokenAddress: string): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getvestingEndBlock(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get total amount vesting
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getvestingAmount(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getvestingAmount(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    result = await this.unitsToAmount(datatokenAddress, result, tokenDecimals)
    return result
  }

  /**
   * Get last block publisher got some vested tokens
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {String}
   */
  async getvestingLastBlock(
    ssAddress: string,
    datatokenAddress: string
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getvestingLastBlock(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    return result
  }

  /**
   * Get how much has been taken from the vesting amount
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getvestingAmountSoFar(
    ssAddress: string,
    datatokenAddress: string,
    tokenDecimals?: number
  ): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.getvestingAmountSoFar(datatokenAddress).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get: ${e.message}`)
    }
    result = await this.unitsToAmount(datatokenAddress, result, tokenDecimals)
    return result
  }

  /**
   * Estimate gas cost for getVesting
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {Contract} contractInstance optional contract instance
   * @return {Promise<number>}
   */
  public async estGetVesting(
    account: string,
    ssAddress: string,
    datatokenAddress: string,
    contractInstance?: Contract
  ): Promise<number> {
    const sideStaking = contractInstance || this.getContract(ssAddress)

    return estimateGas(account, sideStaking.methods.getVesting, datatokenAddress)
  }

  /** Send vested tokens available to the publisher address, can be called by anyone
   *
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {TransactionReceipt}
   */
  async getVesting(
    account: string,
    ssAddress: string,
    datatokenAddress: string
  ): Promise<TransactionReceipt> {
    const sideStaking = this.getContract(ssAddress)
    let result = null

    const estGas = await estimateGas(
      account,
      sideStaking.methods.getVesting,
      datatokenAddress
    )

    try {
      result = await sideStaking.methods.getVesting(datatokenAddress).send({
        from: account,
        gas: estGas + 1,
        gasPrice: await this.getFairGasPrice()
      })
    } catch (e) {
      LoggerInstance.error('ERROR: Failed to join swap pool amount out')
    }
    return result
  }

  /**
   * Estimate gas cost for getVesting
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @param {Contract} contractInstance optional contract instance
   * @return {Promise<number>}
   */
  public async estSetPoolSwapFee(
    account: string,
    ssAddress: string,
    datatokenAddress: string,
    poolAddress: string,
    swapFee: number,
    contractInstance?: Contract
  ): Promise<number> {
    const sideStaking = contractInstance || this.getContract(ssAddress)

    return estimateGas(
      account,
      sideStaking.methods.setPoolSwapFee,
      datatokenAddress,
      poolAddress,
      swapFee
    )
  }

  /** Send vested tokens available to the publisher address, can be called by anyone
   *
   * @param {String} account
   * @param {String} ssAddress side staking contract address
   * @param {String} datatokenAddress datatokenAddress
   * @return {TransactionReceipt}
   */
  private async setPoolSwapFee(
    account: string,
    ssAddress: string,
    datatokenAddress: string,
    poolAddress: string,
    swapFee: number
  ): Promise<TransactionReceipt> {
    const sideStaking = this.getContract(ssAddress)
    let result = null

    const estGas = await estimateGas(
      account,
      sideStaking.methods.setPoolSwapFee,
      datatokenAddress,
      poolAddress,
      swapFee
    )

    try {
      result = await sideStaking.methods
        .setPoolSwapFee(datatokenAddress, poolAddress, swapFee)
        .send({
          from: account,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error('ERROR: Failed to join swap pool amount out')
    }
    return result
  }

  /**
   * Get Router address set in side staking contract
   * @param {String} ssAddress side staking contract address
   * @return {String}
   */
  public async getRouter(ssAddress: string): Promise<string> {
    const sideStaking = this.getContract(ssAddress)
    let result = null
    try {
      result = await sideStaking.methods.router().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get Router address: ${e.message}`)
    }
    return result
  }
}