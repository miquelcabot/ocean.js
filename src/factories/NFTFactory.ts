import { Contract } from 'web3-eth-contract'
import Web3 from 'web3'
import { TransactionReceipt } from 'web3-core'
import { AbiItem } from 'web3-utils'
import defaultFactory721Abi from '@oceanprotocol/contracts/artifacts/contracts/ERC721Factory.sol/ERC721Factory.json'
import {
  LoggerInstance,
  getFairGasPrice,
  generateDtName,
  getFreCreationParams,
  getErcCreationParams,
  getPoolCreationParams,
  setContractDefaults,
  ZERO_ADDRESS,
  ConfigHelper
} from '../utils'
import { Config } from '../models/index.js'
import {
  ProviderFees,
  FreCreationParams,
  Erc20CreateParams,
  PoolCreationParams,
  DispenserCreationParams,
  ConsumeMarketFee
} from '../@types/index.js'

interface Template {
  templateAddress: string
  isActive: boolean
}

export interface TokenOrder {
  tokenAddress: string
  consumer: string
  serviceIndex: number
  _providerFee: ProviderFees
  _consumeMarketFee: ConsumeMarketFee
}

export interface NftCreateData {
  name: string
  symbol: string
  templateIndex: number
  tokenURI: string
  transferable: boolean
  owner: string
}

/**
 * Provides an interface to the NFT Factory smart contract
 */
export class NftFactory {
  public GASLIMIT_DEFAULT = 1000000
  public factory721Address: string
  public factory721Abi: AbiItem | AbiItem[]
  public web3: Web3
  public config: Config
  public factory721: Contract

  /**
   * Create a new instance of an interface to the NFT Factory smart contract
   * @param {string} factory721Address Address of the NFT Factory smart contract
   * @param {Web3} web3 Web3 instance
   * @param {string | number} network Name of the network or network id
   * @param {AbiItem | AbiItem[]} factory721ABI ABI of the NFT Factory smart contract
   * @param {Config} config Instance of a configuration object
   */
  constructor(
    factory721Address: string,
    web3: Web3,
    network?: string | number,
    factory721Abi?: AbiItem | AbiItem[],
    config?: Config
  ) {
    this.factory721Address = factory721Address
    this.factory721Abi = factory721Abi || (defaultFactory721Abi.abi as AbiItem[])
    this.web3 = web3
    this.config = config || new ConfigHelper().getConfig(network || 'unknown')
    this.factory721 = setContractDefaults(
      new this.web3.eth.Contract(this.factory721Abi, this.factory721Address),
      this.config
    )
  }

  /**
   * Get estimated gas cost for create an NFT
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftData Data of the NFT to be created
   * @return {Promise<string>} Estimated gas cost
   */
  public async estGasCreateNFT(address: string, nftData: NftCreateData): Promise<string> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .deployERC721Contract(
          nftData.name,
          nftData.symbol,
          nftData.templateIndex,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          nftData.tokenURI,
          nftData.transferable,
          nftData.owner
        )
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Create a new NFT
   * @param {string} address User address which calls the function
   * @param {NFTCreateData} nftData Data of the NFT to be created
   * @return {Promise<string>} Address of the created NFT
   */
  public async createNFT(address: string, nftData: NftCreateData): Promise<string> {
    if (!nftData.templateIndex) nftData.templateIndex = 1

    if (!nftData.name || !nftData.symbol) {
      const { name, symbol } = generateDtName()
      nftData.name = name
      nftData.symbol = symbol
    }
    if (nftData.templateIndex > (await this.getCurrentNFTTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (nftData.templateIndex === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }
    if ((await this.getNFTTemplate(nftData.templateIndex)).isActive === false) {
      throw new Error(`Template is not active`)
    }
    const estGas = await this.estGasCreateNFT(address, nftData)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .deployERC721Contract(
        nftData.name,
        nftData.symbol,
        nftData.templateIndex,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        nftData.tokenURI,
        nftData.transferable,
        nftData.owner
      )
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    let tokenAddress = null
    try {
      tokenAddress = trxReceipt.events.NFTCreated.returnValues[0]
    } catch (e) {
      LoggerInstance.error(`ERROR: Failed to create datatoken : ${e.message}`)
    }
    return tokenAddress
  }

  /**
   * Get current NFT count (created NFTs)
   * @return {Promise<number>} Number of created NFTs from this factory
   */
  public async getCurrentNFTCount(): Promise<number> {
    const trxReceipt = await this.factory721.methods.getCurrentNFTCount().call()
    return trxReceipt
  }

  /**
   * Get current Datatoken count
   * @return {Promise<number>} Number of datatokens created from this factory
   */
  public async getCurrentTokenCount(): Promise<number> {
    const trxReceipt = await this.factory721.methods.getCurrentTokenCount().call()
    return trxReceipt
  }

  /**
   * Get Factory owner
   * @return {Promise<string>} Factory owner address
   */
  public async getOwner(): Promise<string> {
    const trxReceipt = await this.factory721.methods.owner().call()
    return trxReceipt
  }

  /**
   * Get current NFT (ERC721) templates count
   * @return {Promise<number>} Number of NFT templates added to this factory
   */
  public async getCurrentNFTTemplateCount(): Promise<number> {
    const count = await this.factory721.methods.getCurrentNFTTemplateCount().call()
    return count
  }

  /**
   * Get current Datatoken (ERC20) templates count
   * @return {Promise<number>} Number of ERC20 datatoken templates added to this factory
   */
  public async getCurrentTokenTemplateCount(): Promise<number> {
    const count = await this.factory721.methods.getCurrentTemplateCount().call()
    return count
  }

  /**
   * Get NFT template
   * @param {number} index Template index
   * @return {Promise<Template>} NFT template info
   */
  public async getNFTTemplate(index: number): Promise<Template> {
    if (index > (await this.getCurrentNFTTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (index === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }
    const template = await this.factory721.methods.getNFTTemplate(index).call()
    return template
  }

  /**
   * Get Datatoken (ERC20) template
   * @param {number} index Template index
   * @return {Promise<Template>} Datatoken template info
   */
  public async getTokenTemplate(index: number): Promise<Template> {
    const template = await this.factory721.methods.getTokenTemplate(index).call()
    return template
  }

  /**
   * Check if an ERC20 Datatoken is deployed from the factory
   * @param {string} datatoken Datatoken address we want to check
   * @return {Promise<Boolean>} Return true if deployed from this factory
   */
  public async checkDatatoken(datatoken: string): Promise<Boolean> {
    const isDeployed = await this.factory721.methods.erc20List(datatoken).call()
    return isDeployed
  }

  /**
   * Check if an NFT is deployed from the factory
   * @param {string} nftAddress NFT address we want to check
   * @return {Promise<String>} Return NFT address if deployed from this factory, or address(0) if not
   */
  public async checkNFT(nftAddress: string): Promise<String> {
    const confirmAddress = await this.factory721.methods.erc721List(nftAddress).call()
    return confirmAddress
  }

  /**
   * Estimate gas cost for add a new NFT template
   * @param {string} address User address which calls the function
   * @param {string} templateAddress Template address to add
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasAddNFTTemplate(
    address: string,
    templateAddress: string
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .add721TokenTemplate(templateAddress)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Add a new NFT template
   * @param {string} address User address which calls the function
   * @param {string} templateAddress Template address to add
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async addNFTTemplate(
    address: string,
    templateAddress: string
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateAddress === ZERO_ADDRESS) {
      throw new Error(`Template cannot be ZERO address`)
    }

    const estGas = await this.estGasAddNFTTemplate(address, templateAddress)

    // Invoke add721TokenTemplate function of the contract
    const trxReceipt = await this.factory721.methods
      .add721TokenTemplate(templateAddress)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Estimate gas cost for disable an NFT template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to disable
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasDisableNFTTemplate(
    address: string,
    templateIndex: number
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .disable721TokenTemplate(templateIndex)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Disable an NFT template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to disable
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async disableNFTTemplate(
    address: string,
    templateIndex: number
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateIndex > (await this.getCurrentNFTTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (templateIndex === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }
    const estGas = await this.estGasDisableNFTTemplate(address, templateIndex)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .disable721TokenTemplate(templateIndex)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Estimate gas cost for reactivate a previously disabled NFT template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to reactivate
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasReactivateNFTTemplate(
    address: string,
    templateIndex: number
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .reactivate721TokenTemplate(templateIndex)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Reactivate a previously disabled NFT template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to reactivate
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async reactivateNFTTemplate(
    address: string,
    templateIndex: number
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateIndex > (await this.getCurrentNFTTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (templateIndex === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }

    const estGas = await this.estGasReactivateNFTTemplate(address, templateIndex)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .reactivate721TokenTemplate(templateIndex)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for add a Datatoken template
   * @param {string} address User address which calls the function
   * @param {string} templateAddress Template address to add
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasAddTokenTemplate(
    address: string,
    templateAddress: string
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .addTokenTemplate(templateAddress)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }

    return estGas
  }

  /**
   * Add a Datatoken template
   * @param {string} address User address which calls the function
   * @param {string} templateAddress Template address to add
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async addTokenTemplate(
    address: string,
    templateAddress: string
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateAddress === ZERO_ADDRESS) {
      throw new Error(`Template cannot be address ZERO`)
    }

    const estGas = await this.estGasAddTokenTemplate(address, templateAddress)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .addTokenTemplate(templateAddress)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for disable a Datatoken template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to disable
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasDisableTokenTemplate(
    address: string,
    templateIndex: number
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .disableTokenTemplate(templateIndex)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Disable a Datatoken template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to disable
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async disableTokenTemplate(
    address: string,
    templateIndex: number
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateIndex > (await this.getCurrentTokenTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (templateIndex === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }
    if ((await this.getTokenTemplate(templateIndex)).isActive === false) {
      throw new Error(`Template is already disabled`)
    }
    const estGas = await this.estGasDisableTokenTemplate(address, templateIndex)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .disableTokenTemplate(templateIndex)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for reactivate a previously disabled Datatoken template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to reactivate
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasReactivateTokenTemplate(
    address: string,
    templateIndex: number
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .reactivateTokenTemplate(templateIndex)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Reactivate a previously disabled Datatoken template
   * @param {string} address User address which calls the function
   * @param {number} templateIndex Index of the template we want to reactivate
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async reactivateTokenTemplate(
    address: string,
    templateIndex: number
  ): Promise<TransactionReceipt> {
    if ((await this.getOwner()) !== address) {
      throw new Error(`Caller is not Factory Owner`)
    }
    if (templateIndex > (await this.getCurrentTokenTemplateCount())) {
      throw new Error(`Template index doesnt exist`)
    }

    if (templateIndex === 0) {
      throw new Error(`Template index cannot be ZERO`)
    }
    if ((await this.getTokenTemplate(templateIndex)).isActive === true) {
      throw new Error(`Template is already active`)
    }

    const estGas = await this.estGasReactivateTokenTemplate(address, templateIndex)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .reactivateTokenTemplate(templateIndex)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for start a multiple token order
   * @param {string} address User address which calls the function
   * @param {TokenOrder[]} orders Array of struct TokenOrder with the information of the orders
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasStartMultipleTokenOrder(
    address: string,
    orders: TokenOrder[]
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      estGas = await this.factory721.methods
        .startMultipleTokenOrder(orders)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Start a multiple token order.
   * Used as a proxy to order multiple services.
   * Users can have inifinite approvals for fees for factory instead of having one approval/ erc20 contract.
   * Requires previous approval of all :
   *   - consumeFeeTokens
   *   - publishMarketFeeTokens
   *   - erc20 datatokens
   * @param {string} address User address which calls the function
   * @param {TokenOrder[]} orders Array of struct TokenOrder with the information of the orders
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async startMultipleTokenOrder(
    address: string,
    orders: TokenOrder[]
  ): Promise<TransactionReceipt> {
    if (orders.length > 50) {
      throw new Error(`Too many orders`)
    }

    const estGas = await this.estGasStartMultipleTokenOrder(address, orders)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .startMultipleTokenOrder(orders)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for create an NFT with an ERC20 Datatoken
   * @param {string} address User address which calls the function
   * @param {NftCreateData} _NftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} _ErcCreateData Data of the new ERC20 Datatoken to be created
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasCreateNftWithErc20(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams
  ): Promise<any> {
    // Get estimated gas value
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      const ercCreateData = getErcCreationParams(ercParams)
      estGas = await this.factory721.methods
        .createNftWithErc20(nftCreateData, ercCreateData)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Create an NFT with an ERC20 Datatoken
   * @param {string} address User address which calls the function
   * @param {NftCreateData} _NftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} _ErcCreateData Data of the new ERC20 Datatoken to be created
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async createNftWithErc20(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams
  ): Promise<TransactionReceipt> {
    const ercCreateData = getErcCreationParams(ercParams)

    const estGas = await this.estGasCreateNftWithErc20(address, nftCreateData, ercParams)
    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .createNftWithErc20(nftCreateData, ercCreateData)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for create an NFT with an ERC20 Datatoken and a Pool
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {PoolCreationParams} poolParams Data of the new Pool to be created
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasCreateNftErc20WithPool(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    poolParams: PoolCreationParams
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas
    try {
      const ercCreateData = getErcCreationParams(ercParams)
      const poolData = await getPoolCreationParams(this.web3, poolParams)
      estGas = await this.factory721.methods
        .createNftWithErc20WithPool(nftCreateData, ercCreateData, poolData)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Create an NFT with an ERC20 Datatoken and a Pool.
   * Use this carefully, because if Pool creation fails, you are still going to pay a lot of gas
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {PoolCreationParams} poolParams Data of the new Pool to be created
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async createNftErc20WithPool(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    poolParams: PoolCreationParams
  ): Promise<TransactionReceipt> {
    const estGas = await this.estGasCreateNftErc20WithPool(
      address,
      nftCreateData,
      ercParams,
      poolParams
    )
    const ercCreateData = getErcCreationParams(ercParams)
    const poolData = await getPoolCreationParams(this.web3, poolParams)

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .createNftWithErc20WithPool(nftCreateData, ercCreateData, poolData)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for create an NFT with an ERC20 Datatoken and a Fixed Rate Exchange
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {FreCreationParams} freParams Data of the new Fixed Rate Exchange to be created
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasCreateNftErc20WithFixedRate(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    freParams: FreCreationParams
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas

    const ercCreateData = getErcCreationParams(ercParams)
    const fixedData = await getFreCreationParams(freParams)

    try {
      estGas = await this.factory721.methods
        .createNftWithErc20WithFixedRate(nftCreateData, ercCreateData, fixedData)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
    }
    return estGas
  }

  /**
   * Create an NFT with an ERC20 Datatoken and a Fixed Rate Exchange.
   * Use this carefully, because if Fixed Rate creation fails, you are still going to pay a lot of gas
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {FreCreationParams} freParams Data of the new Fixed Rate Exchange to be created
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async createNftErc20WithFixedRate(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    freParams: FreCreationParams
  ): Promise<TransactionReceipt> {
    const ercCreateData = getErcCreationParams(ercParams)
    const fixedData = getFreCreationParams(freParams)

    const estGas = await this.estGasCreateNftErc20WithFixedRate(
      address,
      nftCreateData,
      ercParams,
      freParams
    )

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .createNftWithErc20WithFixedRate(nftCreateData, ercCreateData, fixedData)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }

  /**
   * Get estimated gas cost for create an NFT with an ERC20 Datatoken and a Dispenser
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {DispenserCreationParams} dispenserParams Data of the new Dispenser to be created
   * @return {Promise<any>} Estimated gas cost
   */
  public async estGasCreateNftErc20WithDispenser(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    dispenserParams: DispenserCreationParams
  ): Promise<any> {
    const gasLimitDefault = this.GASLIMIT_DEFAULT
    let estGas

    const ercCreateData = getErcCreationParams(ercParams)

    try {
      estGas = await this.factory721.methods
        .createNftWithErc20WithDispenser(nftCreateData, ercCreateData, dispenserParams)
        .estimateGas({ from: address }, (err, estGas) => (err ? gasLimitDefault : estGas))
    } catch (e) {
      estGas = gasLimitDefault
      LoggerInstance.error('Failed to estimate gas for createNftErc20WithDispenser', e)
    }
    return estGas
  }

  /**
   * Create an NFT with an ERC20 Datatoken and a Dispenser.
   * Use this carefully, because if Dispenser creation fails, you are still going to pay a lot of gas
   * @param {string} address User address which calls the function
   * @param {NftCreateData} nftCreateData Data of the NFT to be created
   * @param {Erc20CreateParams} ercParams Data of the new ERC20 Datatoken to be created
   * @param {DispenserCreationParams} dispenserParams Data of the new Dispenser to be created
   * @return {Promise<TransactionReceipt>} Information of the transaction receipt
   */
  public async createNftErc20WithDispenser(
    address: string,
    nftCreateData: NftCreateData,
    ercParams: Erc20CreateParams,
    dispenserParams: DispenserCreationParams
  ): Promise<TransactionReceipt> {
    const ercCreateData = getErcCreationParams(ercParams)

    dispenserParams.maxBalance = Web3.utils.toWei(dispenserParams.maxBalance)
    dispenserParams.maxTokens = Web3.utils.toWei(dispenserParams.maxTokens)

    const estGas = await this.estGasCreateNftErc20WithDispenser(
      address,
      nftCreateData,
      ercParams,
      dispenserParams
    )

    // Invoke createToken function of the contract
    const trxReceipt = await this.factory721.methods
      .createNftWithErc20WithDispenser(nftCreateData, ercCreateData, dispenserParams)
      .send({
        from: address,
        gas: estGas + 1,
        gasPrice: await getFairGasPrice(this.web3, this.config)
      })

    return trxReceipt
  }
}
