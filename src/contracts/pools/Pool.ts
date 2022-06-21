import { AbiItem } from 'web3-utils/types'
import { TransactionReceipt } from 'web3-core'
import Decimal from 'decimal.js'
import BigNumber from 'bignumber.js'
import Bpool from '@oceanprotocol/contracts/artifacts/contracts/pools/balancer/BPool.sol/BPool.json'
import {
  LoggerInstance,
  calculateEstimatedGas,
  MAX_UINT_256,
  decimals,
  calcMaxExactOut,
  calcMaxExactIn
} from '../../utils'
import {
  CurrentFees,
  TokenInOutMarket,
  AmountsInMaxFee,
  AmountsOutMaxFee,
  PoolPriceAndFees
} from '../../@types'
import { SmartContract } from '..'

/**
 * Provides an interface to Ocean friendly fork from Balancer BPool
 */
export class Pool extends SmartContract {
  getDefaultAbi(): AbiItem | AbiItem[] {
    return Bpool.abi as AbiItem[]
  }

  /**
   * Get user shares of pool tokens
   * @param {String} account
   * @param {String} poolAddress
   * @return {String}
   */
  async sharesBalance(account: string, poolAddress: string): Promise<string> {
    let shares = null
    try {
      const token = this.getContract(poolAddress)
      const balance = await token.methods.balanceOf(account).call()
      shares = this.web3.utils.fromWei(balance)
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get shares of pool : ${e.message}`)
    }
    return shares
  }

  /**
   * Allows controller to change the swapFee
   * @param {String} account
   * @param {String} poolAddress
   * @param {String} fee swap fee (1e17 = 10 % , 1e16 = 1% , 1e15 = 0.1%, 1e14 = 0.01%)
   */
  async setSwapFee<G extends boolean = false>(
    account: string,
    poolAddress: string,
    fee: string,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress, account)
    let trxReceipt = null
    const estGas = await calculateEstimatedGas(account, pool.methods.setSwapFee, fee)
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods.setSwapFee(this.web3.utils.toWei(fee)).send({
        from: account,
        gas: estGas,
        gasPrice: await this.getFairGasPrice()
      })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to set pool swap fee: ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * Returns number of tokens bounded to pool
   * @param {String} poolAddress
   * @return {String}
   */
  async getNumTokens(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let tokens = null
    try {
      tokens = await pool.methods.getNumTokens().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get number of tokens: ${e.message}`)
    }
    return tokens
  }

  /**
   * Get total supply of pool shares
   * @param {String} poolAddress
   * @return {String}
   */
  async getPoolSharesTotalSupply(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let amount = null
    try {
      const supply = await pool.methods.totalSupply().call()
      amount = this.web3.utils.fromWei(supply)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get total supply of pool shares: ${e.message}`
      )
    }
    return amount
  }

  /**
   * Get tokens composing this poo
   * Returns tokens bounded to pool, before the pool is finalizedl
   * @param {String} poolAddress
   * @return {String[]}
   */
  async getCurrentTokens(poolAddress: string): Promise<string[]> {
    const pool = this.getContract(poolAddress)
    let tokens = null
    try {
      tokens = await pool.methods.getCurrentTokens().call()
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get tokens composing this pool: ${e.message}`
      )
    }
    return tokens
  }

  /**
   * Get the final tokens composing this pool
   * Returns tokens bounded to pool, after the pool was finalized
   * @param {String} poolAddress
   * @return {String[]}
   */
  async getFinalTokens(poolAddress: string): Promise<string[]> {
    const pool = this.getContract(poolAddress)
    let tokens = null
    try {
      tokens = await pool.methods.getFinalTokens().call()
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get the final tokens composing this pool ${e.message}`
      )
    }
    return tokens
  }

  /**
   * Returns the current controller address (ssBot)
   * @param {String} poolAddress
   * @return {String}
   */
  async getController(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let address = null
    try {
      address = await pool.methods.getController().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get pool controller address: ${e.message}`)
    }
    return address
  }

  /**
   * Returns the current baseToken address of the pool
   * @param {String} poolAddress
   * @return {String}
   */
  async getBasetoken(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let address = null
    try {
      address = await pool.methods.getBaseTokenAddress().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get baseToken address: ${e.message}`)
    }
    return address
  }

  /**
   * Returns the current datatoken address
   * @param {String} poolAddress
   * @return {String}
   */
  async getDatatoken(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let address = null
    try {
      address = await pool.methods.getDatatokenAddress().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get datatoken address: ${e.message}`)
    }
    return address
  }

  /**
   * Get getMarketFee
   * @param {String} poolAddress
   * @return {String}
   */
  async getMarketFee(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let fee = null
    try {
      fee = await pool.methods.getMarketFee().call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get getMarketFee: ${e.message}`)
    }
    return this.web3.utils.fromWei(fee).toString()
  }

  /**
   * Get marketFeeCollector of this pool
   * @param {String} poolAddress
   * @return {String}
   */
  async getMarketFeeCollector(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let address = null
    try {
      address = await pool.methods._publishMarketCollector().call()
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get marketFeeCollector address: ${e.message}`
      )
    }
    return address
  }

  /**
   * Get if a token is bounded to a pool
   *  Returns true if token is bound
   * @param {String} poolAddress
   * @param {String} token  Address of the token to be checked
   * @return {Boolean}
   */
  async isBound(poolAddress: string, token: string): Promise<boolean> {
    const pool = this.getContract(poolAddress)
    let isBound = null
    try {
      isBound = await pool.methods.isBound(token).call()
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to check whether a token \
      bounded to a pool. ${e.message}`)
    }
    return isBound
  }

  /**
   * Returns the current token reserve amount
   * @param {String} poolAddress
   * @param {String} token  Address of the token to be checked
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getReserve(
    poolAddress: string,
    token: string,
    tokenDecimals?: number
  ): Promise<string> {
    let amount = null
    try {
      const pool = this.getContract(poolAddress)
      const balance = await pool.methods.getBalance(token).call()
      amount = await this.unitsToAmount(token, balance, tokenDecimals)
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get how many tokens \
      are in the pool: ${e.message}`)
    }
    return amount.toString()
  }

  /**
   * Get if a pool is finalized
   * Returns true if pool is finalized
   * @param {String} poolAddress
   * @return {Boolean}
   */
  async isFinalized(poolAddress: string): Promise<boolean> {
    const pool = this.getContract(poolAddress)
    let isFinalized = null
    try {
      isFinalized = await pool.methods.isFinalized().call()
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to check whether pool is finalized: ${e.message}`
      )
    }
    return isFinalized
  }

  /**
   *  Returns the current Liquidity Providers swap fee
   * @param {String} poolAddress
   * @return {String} Swap fee. To get the percentage value, substract by 100. E.g. `0.1` represents a 10% swap fee.
   */
  async getSwapFee(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let fee = null
    try {
      const swapFee = await pool.methods.getSwapFee().call()
      fee = this.web3.utils.fromWei(swapFee)
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get pool fee: ${e.message}`)
    }
    return fee
  }

  /**
   * Returns normalized weight of a token.
   * The combined normalized weights of all tokens will sum up to 1.
   * (Note: the actual sum may be 1 plus or minus a few wei due to division precision loss)
   * @param {String} poolAddress
   * @param {String} token token to be checked
   * @return {String}
   */
  async getNormalizedWeight(poolAddress: string, token: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let weight = null
    try {
      const normalizedWeight = await pool.methods.getNormalizedWeight(token).call()
      weight = this.web3.utils.fromWei(normalizedWeight)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get normalized weight of a token: ${e.message}`
      )
    }
    return weight
  }

  /**
   *  Returns denormalized weight of a token
   * @param {String} poolAddress
   * @param {String} token token to be checked
   * @return {String}
   */
  async getDenormalizedWeight(poolAddress: string, token: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let weight = null
    try {
      const denormalizedWeight = await pool.methods.getDenormalizedWeight(token).call()
      weight = this.web3.utils.fromWei(denormalizedWeight)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get denormalized weight of a token in pool ${e.message}`
      )
    }
    return weight
  }

  /**
   * getTotalDenormalizedWeight
   * Returns total denormalized weught of the pool
   * @param {String} poolAddress
   * @return {String}
   */
  async getTotalDenormalizedWeight(poolAddress: string): Promise<string> {
    const pool = this.getContract(poolAddress)
    let weight = null
    try {
      const denormalizedWeight = await pool.methods.getTotalDenormalizedWeight().call()
      weight = this.web3.utils.fromWei(denormalizedWeight)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get total denormalized weight in pool ${e.message}`
      )
    }
    return weight
  }

  /**
   * Returns the current fee of publishingMarket
   * Get Market Fees available to be collected for a specific token
   * @param {String} poolAddress
   * @param {String} token token we want to check fees
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getMarketFees(
    poolAddress: string,
    token: string,
    tokenDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let weight = null
    try {
      const fee = await pool.methods.publishMarketFees(token).call()
      weight = await this.unitsToAmount(token, fee, tokenDecimals)
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to get market fees for a token: ${e.message}`)
    }
    return weight
  }

  /**
   * Get Community  Get the current amount of fees which can be withdrawned by the Market
   * @return {CurrentFees}
   */
  async getCurrentMarketFees(poolAddress: string): Promise<CurrentFees> {
    const pool = this.getContract(poolAddress)
    try {
      const currentMarketFees = await pool.methods.getCurrentOPCFees().call()
      return currentMarketFees
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get community fees for a token: ${e.message}`
      )
    }
  }

  /**
   * Get getCurrentOPFFees  Get the current amount of fees which can be withdrawned by OPF
   * @return {CurrentFees}
   */
  async getCurrentOPCFees(poolAddress: string): Promise<CurrentFees> {
    const pool = this.getContract(poolAddress)
    try {
      const currentMarketFees = await pool.methods.getCurrentOPCFees().call()
      return currentMarketFees
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get community fees for a token: ${e.message}`
      )
    }
  }

  /**
   * Get Community Fees available to be collected for a specific token
   * @param {String} poolAddress
   * @param {String} token token we want to check fees
   * @param {number} tokenDecimals optional number of decimals of the token
   * @return {String}
   */
  async getCommunityFees(
    poolAddress: string,
    token: string,
    tokenDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let weight = null
    try {
      const fee = await pool.methods.communityFees(token).call()
      weight = await this.unitsToAmount(token, fee, tokenDecimals)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to get community fees for a token: ${e.message}`
      )
    }
    return weight
  }

  /**
   * collectOPF - collect opf fee - can be called by anyone
   * @param {String} address
   * @param {String} poolAddress
   * @return {TransactionReceipt}
   */
  async collectOPC<G extends boolean = false>(
    address: string,
    poolAddress: string,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress)
    let trxReceipt = null
    const estGas = await calculateEstimatedGas(address, pool.methods.collectOPC)
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods.collectOPC().send({
        from: address,
        gas: estGas + 1,
        gasPrice: await this.getFairGasPrice()
      })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to swap exact amount in : ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * collectOPF - collect market fees - can be called by the publishMarketCollector
   * @param {String} address
   * @param {String} poolAddress
   * @param {String} to address that will receive fees
   * @return {TransactionReceipt}
   */
  async collectMarketFee<G extends boolean = false>(
    address: string,
    poolAddress: string,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    if ((await this.getMarketFeeCollector(poolAddress)) !== address) {
      throw new Error(`Caller is not MarketFeeCollector`)
    }
    const pool = this.getContract(poolAddress)
    let trxReceipt = null
    const estGas = await calculateEstimatedGas(address, pool.methods.collectMarketFee)
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods.collectMarketFee().send({
        from: address,
        gas: estGas + 1,
        gasPrice: await this.getFairGasPrice()
      })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to swap exact amount in : ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * updatePublishMarketFee - sets a new  newPublishMarketAddress and new newPublishMarketSwapFee- can be called only by the marketFeeCollector
   * @param {String} address
   * @param {String} poolAddress
   * @param {String} newPublishMarketAddress new market fee collector address
   * @param {String} newPublishMarketSwapFee fee recieved by the publisher market when a dt is swaped from a pool, percent
   * @return {TransactionReceipt}
   */
  async updatePublishMarketFee<G extends boolean = false>(
    address: string,
    poolAddress: string,
    newPublishMarketAddress: string,
    newPublishMarketSwapFee: string,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    if ((await this.getMarketFeeCollector(poolAddress)) !== address) {
      throw new Error(`Caller is not MarketFeeCollector`)
    }
    const pool = this.getContract(poolAddress)
    let trxReceipt = null

    const estGas = await calculateEstimatedGas(
      address,
      pool.methods.updatePublishMarketFee,
      newPublishMarketAddress,
      this.web3.utils.toWei(newPublishMarketSwapFee)
    )
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods
        .updatePublishMarketFee(
          newPublishMarketAddress,
          this.web3.utils.toWei(newPublishMarketSwapFee)
        )
        .send({
          from: address,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to updatePublishMarketFee : ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * Swaps an exact amount of tokensIn to get a mimum amount of tokenOut
   * Trades an exact tokenAmountIn of tokenIn taken from the caller by the pool,
   * in exchange for at least minAmountOut of tokenOut given to the caller from the pool, with a maximum marginal price of maxPrice.
   * Returns (tokenAmountOut, spotPriceAfter), where tokenAmountOut is the amount of token that came out of the pool,
   * and spotPriceAfter is the new marginal spot price, ie, the result of getSpotPrice after the call.
   * (These values are what are limited by the arguments; you are guaranteed tokenAmountOut >= minAmountOut and spotPriceAfter <= maxPrice).
   * @param {String} address
   * @param {String} poolAddress
   * @param {TokenInOutMarket} tokenInOutMarket object contianing addresses like tokenIn, tokenOut, consumeMarketFeeAddress
   * @param {AmountsInMaxFee} amountsInOutMaxFee object contianing tokenAmountIn, minAmountOut, maxPrice, consumeMarketSwapFee
   * @return {TransactionReceipt}
   */
  async swapExactAmountIn<G extends boolean = false>(
    address: string,
    poolAddress: string,
    tokenInOutMarket: TokenInOutMarket,
    amountsInOutMaxFee: AmountsInMaxFee,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress)

    const maxSwap = await this.getMaxSwapExactIn(poolAddress, tokenInOutMarket.tokenIn)
    if (new Decimal(amountsInOutMaxFee.tokenAmountIn).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountIn is greater than ${maxSwap.toString()}`)
    }

    const tokenAmountIn = await this.amountToUnits(
      tokenInOutMarket.tokenIn,
      amountsInOutMaxFee.tokenAmountIn,
      tokenInOutMarket.tokenInDecimals
    )

    const minAmountOut = await this.amountToUnits(
      tokenInOutMarket.tokenOut,
      amountsInOutMaxFee.minAmountOut,
      tokenInOutMarket.tokenOutDecimals
    )

    const maxPrice = amountsInOutMaxFee.maxPrice
      ? await this.amountToUnits(
          await this.getBasetoken(poolAddress),
          amountsInOutMaxFee.maxPrice
        )
      : MAX_UINT_256

    const estGas = await calculateEstimatedGas(
      address,
      pool.methods.swapExactAmountIn,
      [
        tokenInOutMarket.tokenIn,
        tokenInOutMarket.tokenOut,
        tokenInOutMarket.marketFeeAddress
      ],
      [
        tokenAmountIn,
        minAmountOut,
        maxPrice,
        this.web3.utils.toWei(amountsInOutMaxFee.swapMarketFee)
      ]
    )
    if (estimateGas) return estGas

    let trxReceipt = null
    try {
      trxReceipt = await pool.methods
        .swapExactAmountIn(
          [
            tokenInOutMarket.tokenIn,
            tokenInOutMarket.tokenOut,
            tokenInOutMarket.marketFeeAddress
          ],
          [
            tokenAmountIn,
            minAmountOut,
            maxPrice,
            this.web3.utils.toWei(amountsInOutMaxFee.swapMarketFee)
          ]
        )
        .send({
          from: address,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to swap exact amount in : ${e.message}`)
    }

    return trxReceipt
  }

  /**
   * Swaps a maximum  maxAmountIn of tokensIn to get an exact amount of tokenOut
   * @param {String} account
   * @param {String} poolAddress
   * @param {TokenInOutMarket} tokenInOutMarket Object containing addresses like tokenIn, tokenOut, consumeMarketFeeAddress
   * @param {AmountsOutMaxFee} amountsInOutMaxFee Object containging maxAmountIn,tokenAmountOut,maxPrice, consumeMarketSwapFee]
   * @return {TransactionReceipt}
   */
  async swapExactAmountOut<G extends boolean = false>(
    account: string,
    poolAddress: string,
    tokenInOutMarket: TokenInOutMarket,
    amountsInOutMaxFee: AmountsOutMaxFee,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress)
    let trxReceipt = null

    const maxSwap = await this.getMaxSwapExactOut(poolAddress, tokenInOutMarket.tokenOut)
    if (new Decimal(amountsInOutMaxFee.tokenAmountOut).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountOut is greater than ${maxSwap.toString()}`)
    }

    const maxAmountIn = await this.amountToUnits(
      tokenInOutMarket.tokenIn,
      amountsInOutMaxFee.maxAmountIn,
      tokenInOutMarket.tokenInDecimals
    )

    const tokenAmountOut = await this.amountToUnits(
      tokenInOutMarket.tokenOut,
      amountsInOutMaxFee.tokenAmountOut,
      tokenInOutMarket.tokenOutDecimals
    )

    const maxPrice = amountsInOutMaxFee.maxPrice
      ? this.amountToUnits(
          await this.getBasetoken(poolAddress),
          amountsInOutMaxFee.maxPrice
        )
      : MAX_UINT_256

    const estGas = await calculateEstimatedGas(
      account,
      pool.methods.swapExactAmountOut,
      [
        tokenInOutMarket.tokenIn,
        tokenInOutMarket.tokenOut,
        tokenInOutMarket.marketFeeAddress
      ],
      [
        maxAmountIn,
        tokenAmountOut,
        maxPrice,
        this.web3.utils.toWei(amountsInOutMaxFee.swapMarketFee)
      ]
    )
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods
        .swapExactAmountOut(
          [
            tokenInOutMarket.tokenIn,
            tokenInOutMarket.tokenOut,
            tokenInOutMarket.marketFeeAddress
          ],
          [
            maxAmountIn,
            tokenAmountOut,
            maxPrice,
            this.web3.utils.toWei(amountsInOutMaxFee.swapMarketFee)
          ]
        )
        .send({
          from: account,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to swap exact amount out: ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * Single side add liquidity to the pool,
   * expecting a minPoolAmountOut of shares for spending tokenAmountIn basetokens.
   * Pay tokenAmountIn of baseToken to join the pool, getting poolAmountOut of the pool shares.
   * @param {String} account
   * @param {String} poolAddress
   * @param {String} tokenAmountIn exact number of base tokens to spend
   * @param {String} minPoolAmountOut minimum of pool shares expectex
   * @param {number} tokenInDecimals optional number of decimals of the token
   * @return {TransactionReceipt}
   */
  async joinswapExternAmountIn<G extends boolean = false>(
    account: string,
    poolAddress: string,
    tokenAmountIn: string,
    minPoolAmountOut: string,
    tokenInDecimals?: number,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress)
    let trxReceipt = null
    const tokenIn = await this.getBasetoken(poolAddress)
    const maxSwap = await this.getMaxAddLiquidity(poolAddress, tokenIn)
    if (new Decimal(tokenAmountIn).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountOut is greater than ${maxSwap.toString()}`)
    }

    const amountInFormatted = await this.amountToUnits(
      tokenIn,
      tokenAmountIn,
      tokenInDecimals
    )
    const estGas = await calculateEstimatedGas(
      account,
      pool.methods.joinswapExternAmountIn,
      amountInFormatted,
      this.web3.utils.toWei(minPoolAmountOut)
    )
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods
        .joinswapExternAmountIn(
          amountInFormatted,
          this.web3.utils.toWei(minPoolAmountOut)
        )
        .send({
          from: account,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to pay tokens in order to \
      join the pool: ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * Single side remove liquidity from the pool,
   * expecting a minAmountOut of basetokens for spending poolAmountIn pool shares
   * Pay poolAmountIn pool shares into the pool, getting minTokenAmountOut of the baseToken
   * @param {String} account
   * @param {String} poolAddress
   * @param {String} poolAmountIn exact number of pool shares to spend
   * @param {String} minTokenAmountOut minimum amount of basetokens expected
   * @param {number} poolDecimals optional number of decimals of the poool
   * @return {TransactionReceipt}
   */
  async exitSwapPoolAmountIn<G extends boolean = false>(
    account: string,
    poolAddress: string,
    poolAmountIn: string,
    minTokenAmountOut: string,
    poolDecimals?: number,
    estimateGas?: G
  ): Promise<G extends false ? TransactionReceipt : number> {
    const pool = this.getContract(poolAddress)
    let trxReceipt = null
    const tokenOut = await this.getBasetoken(poolAddress)

    const tokenAmountOut = await this.calcSingleOutGivenPoolIn(
      poolAddress,
      tokenOut,
      poolAmountIn
    )

    const maxSwap = await this.getMaxRemoveLiquidity(poolAddress, tokenOut)
    if (new Decimal(tokenAmountOut).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountOut is greater than ${maxSwap.toString()}`)
    }

    const minTokenOutFormatted = await this.amountToUnits(
      await this.getBasetoken(poolAddress),
      minTokenAmountOut,
      poolDecimals
    )
    const estGas = await calculateEstimatedGas(
      account,
      pool.methods.exitswapPoolAmountIn,
      this.web3.utils.toWei(poolAmountIn),
      minTokenOutFormatted
    )
    if (estimateGas) return estGas

    try {
      trxReceipt = await pool.methods
        .exitswapPoolAmountIn(this.web3.utils.toWei(poolAmountIn), minTokenOutFormatted)
        .send({
          from: account,
          gas: estGas + 1,
          gasPrice: await this.getFairGasPrice()
        })
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to pay pool shares into the pool: ${e.message}`)
    }
    return trxReceipt
  }

  /**
   * Return the spot price of swapping tokenIn to tokenOut
   * @param {String} poolAddress
   * @param {String} tokenIn in token
   * @param {String} tokenOut out token
   * @param {String} swapMarketFe consume market swap fee
   * @return {String}
   */
  async getSpotPrice(
    poolAddress: string,
    tokenIn: string,
    tokenOut: string,
    swapMarketFee: string
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let decimalsTokenIn = 18
    let decimalsTokenOut = 18

    try {
      decimalsTokenIn = await decimals(this.web3, tokenIn)
    } catch (e) {
      LoggerInstance.error(`ERROR: FAILED TO CALL DECIMALS(), USING 18 ${e.message}`)
    }
    try {
      decimalsTokenOut = await decimals(this.web3, tokenOut)
    } catch (e) {
      LoggerInstance.error(`ERROR: FAILED TO CALL DECIMALS(), USING 18 ${e.message}`)
    }

    let price = null
    try {
      price = await pool.methods
        .getSpotPrice(tokenIn, tokenOut, this.web3.utils.toWei(swapMarketFee))
        .call()
      price = new BigNumber(price.toString())
    } catch (e) {
      LoggerInstance.error(
        'ERROR: Failed to get spot price of swapping tokenIn to tokenOut'
      )
    }

    let decimalsDiff
    if (decimalsTokenIn > decimalsTokenOut) {
      decimalsDiff = decimalsTokenIn - decimalsTokenOut
      price = new BigNumber(price / 10 ** decimalsDiff)
      price = price / 10 ** decimalsTokenOut
    } else {
      decimalsDiff = decimalsTokenOut - decimalsTokenIn
      price = new BigNumber(price * 10 ** (2 * decimalsDiff))
      price = price / 10 ** decimalsTokenOut
    }

    return price.toString()
  }

  /**
   * How many tokensIn do you need in order to get exact tokenAmountOut.
   * Returns: tokenAmountIn, swapFee, opcFee , consumeMarketSwapFee, publishMarketSwapFee
   * Returns: tokenAmountIn, LPFee, opcFee , publishMarketSwapFee, consumeMarketSwapFee
   * @param tokenIn token to be swaped
   * @param tokenOut token to get
   * @param tokenAmountOut exact amount of tokenOut
   * @param swapMarketFee consume market swap fee
   * @param {number} tokenInDecimals optional number of decimals of the token to be swaped
   * @param {number} tokenOutDecimals optional number of decimals of the token to get
   */
  public async getAmountInExactOut(
    poolAddress: string,
    tokenIn: string,
    tokenOut: string,
    tokenAmountOut: string,
    swapMarketFee: string,
    tokenInDecimals?: number,
    tokenOutDecimals?: number
  ): Promise<PoolPriceAndFees> {
    const pool = this.getContract(poolAddress)

    const maxSwap = await this.getMaxSwapExactOut(poolAddress, tokenOut)

    if (new Decimal(tokenAmountOut).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountOut is greater than ${maxSwap.toString()}`)
    }

    const amountOutFormatted = await this.amountToUnits(
      tokenOut,
      tokenAmountOut,
      tokenOutDecimals
    )

    let amount = null

    try {
      const amountIn = await pool.methods
        .getAmountInExactOut(
          tokenIn,
          tokenOut,
          amountOutFormatted,
          this.web3.utils.toWei(swapMarketFee)
        )
        .call()
      amount = {
        tokenAmount: await this.unitsToAmount(
          tokenOut,
          amountIn.tokenAmountIn,
          tokenOutDecimals
        ),
        liquidityProviderSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountIn.lpFeeAmount,
          tokenInDecimals
        ),
        oceanFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountIn.oceanFeeAmount,
          tokenInDecimals
        ),
        publishMarketSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountIn.publishMarketSwapFeeAmount,
          tokenInDecimals
        ),
        consumeMarketSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountIn.consumeMarketSwapFeeAmount,
          tokenInDecimals
        )
      }
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to calcInGivenOut ${e.message}`)
    }
    return amount
  }

  /**
   *  How many tokensOut you will get for a exact tokenAmountIn
   *  Returns: tokenAmountOut, LPFee, opcFee ,  publishMarketSwapFee, consumeMarketSwapFee
   * @param tokenIn token to be swaped
   * @param tokenOut token to get
   * @param tokenAmountIn exact amount of tokenIn
   * @param swapMarketFee
   * @param {number} tokenInDecimals optional number of decimals of the token to be swaped
   * @param {number} tokenOutDecimals optional number of decimals of the token to get
   */
  public async getAmountOutExactIn(
    poolAddress: string,
    tokenIn: string,
    tokenOut: string,
    tokenAmountIn: string,
    swapMarketFee: string,
    tokenInDecimals?: number,
    tokenOutDecimals?: number
  ): Promise<PoolPriceAndFees> {
    const pool = this.getContract(poolAddress)

    const maxSwap = await this.getMaxSwapExactIn(poolAddress, tokenIn)
    if (new Decimal(tokenAmountIn).greaterThan(maxSwap)) {
      throw new Error(`tokenAmountIn is greater than ${maxSwap.toString()}`)
    }

    const amountInFormatted = await this.amountToUnits(
      tokenIn,
      tokenAmountIn,
      tokenInDecimals
    )

    let amount = null

    try {
      const amountOut = await pool.methods
        .getAmountOutExactIn(
          tokenIn,
          tokenOut,
          amountInFormatted,
          this.web3.utils.toWei(swapMarketFee)
        )
        .call()

      amount = {
        tokenAmount: await this.unitsToAmount(
          tokenOut,
          amountOut.tokenAmountOut,
          tokenOutDecimals
        ),
        liquidityProviderSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountOut.lpFeeAmount,
          tokenInDecimals
        ),
        oceanFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountOut.oceanFeeAmount,
          tokenInDecimals
        ),
        publishMarketSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountOut.publishMarketSwapFeeAmount,
          tokenInDecimals
        ),
        consumeMarketSwapFeeAmount: await this.unitsToAmount(
          tokenIn,
          amountOut.consumeMarketSwapFeeAmount,
          tokenInDecimals
        )
      }
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to calcOutGivenIn ${e.message}`)
    }
    return amount
  }

  /**
   * Returns number of poolshares obtain by staking exact tokenAmountIn tokens
   * @param tokenIn tokenIn
   * @param tokenAmountIn exact number of tokens staked
   * @param {number} poolDecimals optional number of decimals of the poool
   * @param {number} tokenInDecimals optional number of decimals of the token
   */
  public async calcPoolOutGivenSingleIn(
    poolAddress: string,
    tokenIn: string,
    tokenAmountIn: string,
    poolDecimals?: number,
    tokenInDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let amount = null

    try {
      const poolOut = await pool.methods
        .calcPoolOutSingleIn(
          tokenIn,
          await this.amountToUnits(tokenIn, tokenAmountIn, tokenInDecimals)
        )
        .call()

      amount = await this.unitsToAmount(poolAddress, poolOut, poolDecimals)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to calculate PoolOutGivenSingleIn : ${e.message}`
      )
    }
    return amount
  }

  /**
   * Returns number of tokens to be staked to the pool in order to get an exact number of poolshares
   * @param tokenIn tokenIn
   * @param poolAmountOut expected amount of pool shares
   * @param {number} poolDecimals optional number of decimals of the pool
   * @param {number} tokenInDecimals optional number of decimals of the token
   */
  public async calcSingleInGivenPoolOut(
    poolAddress: string,
    tokenIn: string,
    poolAmountOut: string,
    poolDecimals?: number,
    tokenInDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let amount = null
    const amountFormatted = await this.amountToUnits(
      poolAddress,
      poolAmountOut,
      poolDecimals
    )
    try {
      const singleIn = await pool.methods
        .calcSingleInPoolOut(tokenIn, amountFormatted)
        .call()

      amount = await this.unitsToAmount(tokenIn, singleIn, tokenInDecimals)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to calculate SingleInGivenPoolOut : ${e.message}`
      )
    }
    return amount
  }

  /**
   * Returns expected amount of tokenOut for removing exact poolAmountIn pool shares from the pool
   * @param tokenOut tokenOut
   * @param poolAmountIn amount of shares spent
   * @param {number} poolDecimals optional number of decimals of the pool
   * @param {number} tokenOutDecimals optional number of decimals of the token
   */
  public async calcSingleOutGivenPoolIn(
    poolAddress: string,
    tokenOut: string,
    poolAmountIn: string,
    poolDecimals?: number,
    tokenOutDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let amount = null

    try {
      const singleOut = await pool.methods
        .calcSingleOutPoolIn(
          tokenOut,
          await this.amountToUnits(poolAddress, poolAmountIn, poolDecimals)
        )
        .call()
      amount = await this.unitsToAmount(tokenOut, singleOut, tokenOutDecimals)
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to calculate SingleOutGivenPoolIn : ${e}`)
    }
    return amount
  }

  /**
   * Returns number of poolshares needed to withdraw exact tokenAmountOut tokens
   * @param tokenOut tokenOut
   * @param tokenAmountOut expected amount of tokensOut
   * @param {number} poolDecimals optional number of decimals of the pool
   * @param {number} tokenOutDecimals optional number of decimals of the token
   */
  public async calcPoolInGivenSingleOut(
    poolAddress: string,
    tokenOut: string,
    tokenAmountOut: string,
    poolDecimals?: number,
    tokenOutDecimals?: number
  ): Promise<string> {
    const pool = this.getContract(poolAddress)
    let amount = null

    try {
      const poolIn = await pool.methods
        .calcPoolInSingleOut(
          tokenOut,
          await this.amountToUnits(tokenOut, tokenAmountOut, tokenOutDecimals)
        )
        .call()

      amount = await this.unitsToAmount(poolAddress, poolIn, poolDecimals)
    } catch (e) {
      LoggerInstance.error(
        `ERROR: Failed to calculate PoolInGivenSingleOut : ${e.message}`
      )
    }
    return amount
  }

  /**
   * Get LOG_SWAP encoded topic
   * @return {String}
   */
  public getSwapEventSignature(): string {
    const abi = this.abi as AbiItem[]
    const eventdata = abi.find(function (o) {
      if (o.name === 'LOG_SWAP' && o.type === 'event') return o
    })
    const topic = this.web3.eth.abi.encodeEventSignature(eventdata as any)
    return topic
  }

  /**
   * Get LOG_JOIN encoded topic
   * @return {String}
   */
  public getJoinEventSignature(): string {
    const abi = this.abi as AbiItem[]
    const eventdata = abi.find(function (o) {
      if (o.name === 'LOG_JOIN' && o.type === 'event') return o
    })
    const topic = this.web3.eth.abi.encodeEventSignature(eventdata as any)
    return topic
  }

  /**
   * Get LOG_EXIT encoded topic
   * @return {String}
   */
  public getExitEventSignature(): string {
    const abi = this.abi as AbiItem[]
    const eventdata = abi.find(function (o) {
      if (o.name === 'LOG_EXIT' && o.type === 'event') return o
    })
    const topic = this.web3.eth.abi.encodeEventSignature(eventdata as any)
    return topic
  }

  private async getMaxSwapExactOut(
    poolAddress: string,
    tokenAddress: string
  ): Promise<Decimal> {
    const reserve = await this.getReserve(poolAddress, tokenAddress)

    return calcMaxExactOut(reserve)
  }

  private async getMaxSwapExactIn(
    poolAddress: string,
    tokenAddress: string
  ): Promise<Decimal> {
    const reserve = await this.getReserve(poolAddress, tokenAddress)

    return calcMaxExactIn(reserve)
  }

  private async getMaxAddLiquidity(
    poolAddress: string,
    tokenAddress: string
  ): Promise<Decimal> {
    const reserve = await this.getReserve(poolAddress, tokenAddress)

    return calcMaxExactIn(reserve)
  }

  private async getMaxRemoveLiquidity(
    poolAddress: string,
    tokenAddress: string
  ): Promise<Decimal> {
    const reserve = await this.getReserve(poolAddress, tokenAddress)

    return calcMaxExactIn(reserve)
  }
}