import { assert } from 'chai'
import ERC721Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC721Template.sol/ERC721Template.json'
import { deployContracts, Addresses } from '../../TestContractHandler'
import { AbiItem } from 'web3-utils'
import sha256 from 'crypto-js/sha256'
import { web3 } from '../../config'
import { NftFactory, NftCreateData, Nft, ZERO_ADDRESS } from '../../../src'
import { MetadataAndTokenURI } from '../../../src/@types/Erc721'

describe('NFT', () => {
  let nftOwner: string
  let user1: string
  let user2: string
  let user3: string
  let contracts: Addresses
  let nftDatatoken: Nft
  let nftFactory: NftFactory
  let nftAddress: string

  const NFT_NAME = 'NFTName'
  const NFT_SYMBOL = 'NFTSymbol'
  const NFT_TOKEN_URI = 'https://oceanprotocol.com/nft/'
  const DECRYPTO_URL = 'http://myprovider:8030'
  const DECRYPTOR_ADDRESS = '0x123'
  const FEE_ZERO = '0'
  const CAP_AMOUNT = '10000'
  const META_DATA_STATE = 1

  const NFT_DATA: NftCreateData = {
    name: NFT_NAME,
    symbol: NFT_SYMBOL,
    templateIndex: 1,
    tokenURI: NFT_TOKEN_URI
  }

  before(async () => {
    const accounts = await web3.eth.getAccounts()
    nftOwner = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
    user3 = accounts[3]
  })

  it('should deploy contracts', async () => {
    contracts = await deployContracts(web3, nftOwner)
  })

  it('should initialize NFTFactory instance and create a new NFT', async () => {
    nftFactory = new NftFactory(contracts.erc721FactoryAddress, web3)

    nftAddress = await nftFactory.createNFT(nftOwner, NFT_DATA)
    nftDatatoken = new Nft(web3, ERC721Template.abi as AbiItem[])
  })

  it('#getTokenURI', async () => {
    const tokenURI = await nftDatatoken.getTokenURI(nftAddress, 1)
    assert(tokenURI === NFT_TOKEN_URI)
  })

  it('#createERC20 - should create a new ERC20 DT from NFT contract', async () => {
    const erc20Address = await nftDatatoken.createErc20(
      nftAddress,
      nftOwner,
      nftOwner,
      user1,
      user2,
      ZERO_ADDRESS,
      FEE_ZERO,
      CAP_AMOUNT,
      NFT_NAME,
      NFT_SYMBOL,
      1
    )
    assert(erc20Address !== null)
  })

  it('#createERC20 - should fail to create a new ERC20 DT if not ERC20Deployer', async () => {
    try {
      await nftDatatoken.createErc20(
        nftAddress,
        user1,
        nftOwner,
        user1,
        user2,
        ZERO_ADDRESS,
        FEE_ZERO,
        CAP_AMOUNT,
        NFT_NAME,
        NFT_SYMBOL,
        1
      )
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not ERC20Deployer')
    }
  })

  // Manager
  it('#addManager - should add a new Manager', async () => {
    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).manager === false)

    await nftDatatoken.addManager(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).manager === true)
  })

  it('#addManager - should fail to add a new Manager, if NOT NFT Owner', async () => {
    try {
      await nftDatatoken.addManager(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not NFT Owner')
    }
  })

  it('#removeManager - should remove a Manager', async () => {
    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).manager === true)

    await nftDatatoken.removeManager(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).manager === false)
  })

  it('#removeManager - should fail to remove a new Manager, if NOT NFT Owner', async () => {
    try {
      await nftDatatoken.removeManager(nftAddress, user1, nftOwner)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not NFT Owner')
    }
  })

  // ERC20Deployer
  it('#addERC20Deployer -should add ERC20deployer if Manager', async () => {
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === false)

    await nftDatatoken.addErc20Deployer(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)
  })

  it('#addManager - should fail to add a new Manager, if NOT NFT Owner', async () => {
    try {
      await nftDatatoken.addManager(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not NFT Owner')
    }
  })

  it('#addERC20Deployer - should fail to add ERC20deployer if NOT Manager', async () => {
    try {
      await nftDatatoken.addErc20Deployer(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager')
    }
  })

  it('#removeERC20Deployer - remove ERC20deployer if Manager', async () => {
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)

    await nftDatatoken.removeErc20Deployer(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === false)
  })

  it('#removeERC20Deployer - should fail and remove ERC20deployer if NOT Manager nor himself an ERC20Deployer', async () => {
    await nftDatatoken.addErc20Deployer(nftAddress, nftOwner, user1)
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)
    try {
      await nftDatatoken.removeErc20Deployer(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager nor ERC20Deployer')
    }
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)
  })

  it('#removeERC20Deployer - should fail to remove himself an ERC20Deployer', async () => {
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)
    try {
      await nftDatatoken.removeErc20Deployer(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager nor ERC20Deployer')
    }
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)
  })

  //  MetadataUpdate
  it('#addMetadataUpdate - should add to remove Metadata Updater if Manager', async () => {
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === false
    )

    await nftDatatoken.addMetadataUpdater(nftAddress, nftOwner, user1)

    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === true
    )
  })

  it('#addMetadataUpdate - should fail to add Metadata Updater if NOT Manager', async () => {
    try {
      await nftDatatoken.addMetadataUpdater(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager')
    }
  })

  it('#removeMetadataUpdate - remove Metadata Updater if Manager', async () => {
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === true
    )

    await nftDatatoken.removeMetadataUpdater(nftAddress, nftOwner, user1)

    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === false
    )
  })

  it('#removeMetadataUpdate - should fail to remove Metadata Updater if NOT Manager', async () => {
    try {
      await nftDatatoken.removeMetadataUpdater(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager nor Metadata Updater')
    }
  })

  // StoreUpdater
  it('#addStoreUpdater - should add to remove Store Updater if Manager', async () => {
    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).store === false)

    await nftDatatoken.addStoreUpdater(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).store === true)
  })

  it('#addStoreUpdater - should fail to add Store Updater if NOT Manager', async () => {
    try {
      await nftDatatoken.addStoreUpdater(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Manager')
    }
  })

  it('#removeStoreUpdater - remove Metadata Updater if Manager', async () => {
    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).store === true)

    await nftDatatoken.removeStoreUpdater(nftAddress, nftOwner, user1)

    assert((await nftDatatoken.getNftPermissions(nftAddress, user1)).store === false)
  })

  it('#removeStoreUpdater - should fail to remove Metadata Updater if NOT Manager', async () => {
    try {
      await nftDatatoken.removeStoreUpdater(nftAddress, user1, user1)
      assert(false)
    } catch (e) {
      assert(e.message === `Caller is not Manager nor storeUpdater`)
    }
  })

  // Transfer test
  it('#transferNFT - should fail to transfer the NFT and clean all permissions, if NOT NFT Owner', async () => {
    assert((await nftDatatoken.getNftOwner(nftAddress)) !== user1)

    try {
      await nftDatatoken.transferNft(nftAddress, user1, user1, 1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not NFT Owner')
    }
  })

  it('#transferNFT - should transfer the NFT and clean all permissions, set new owner as manager', async () => {
    await nftDatatoken.addManager(nftAddress, nftOwner, user2)
    await nftDatatoken.addErc20Deployer(nftAddress, user2, user1)
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user1)) === true)

    assert((await nftDatatoken.getNftOwner(nftAddress)) === nftOwner)
    await nftDatatoken.transferNft(nftAddress, nftOwner, user1, 1)
    assert((await nftDatatoken.getNftOwner(nftAddress)) === user1)
  })

  // Clear permisions
  it('#cleanPermissions - should fail to cleanPermissions if NOT NFTOwner', async () => {
    try {
      await nftDatatoken.cleanPermissions(nftAddress, user2)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not NFT Owner')
    }
  })

  it('#cleanPermissions - should cleanPermissions if NFTOwner', async () => {
    await nftDatatoken.addManager(nftAddress, user1, user1)
    await nftDatatoken.addErc20Deployer(nftAddress, user1, user2)
    assert((await nftDatatoken.isErc20Deployer(nftAddress, user2)) === true)

    await nftDatatoken.cleanPermissions(nftAddress, user1)

    assert((await nftDatatoken.isErc20Deployer(nftAddress, user2)) === false)
    assert((await nftDatatoken.getNftPermissions(nftAddress, nftOwner)).manager === false)
  })

  it('#setMetaData - should succeed to update metadata if metadataUpdater', async () => {
    await nftDatatoken.addManager(nftAddress, user1, user1)
    await nftDatatoken.addMetadataUpdater(nftAddress, user1, user1)
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === true
    )
    await nftDatatoken.setMetadata(
      nftAddress,
      user1,
      META_DATA_STATE,
      DECRYPTO_URL,
      DECRYPTOR_ADDRESS,
      web3.utils.asciiToHex(user2),
      web3.utils.asciiToHex(user2),
      '0x' + sha256(web3.utils.asciiToHex(user2)).toString()
    )

    const metadata = await nftDatatoken.getMetadata(nftAddress)
    assert(metadata[0] === DECRYPTO_URL)
    assert(metadata[1] === DECRYPTOR_ADDRESS)
  })

  it('#setMetaData - should fail to update metadata if NOT metadataUpdater', async () => {
    const data = web3.utils.asciiToHex(user2)
    const dataHash = '0x' + sha256(data).toString()
    const flags = web3.utils.asciiToHex(user2)
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user3)).updateMetadata === false
    )
    try {
      await nftDatatoken.setMetadata(
        nftAddress,
        user3,
        META_DATA_STATE,
        DECRYPTO_URL,
        DECRYPTOR_ADDRESS,
        web3.utils.asciiToHex(user2),
        web3.utils.asciiToHex(user2),
        '0x' + sha256(web3.utils.asciiToHex(user2)).toString()
      )
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Metadata updater')
    }
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user3)).updateMetadata === false
    )
  })

  it('#setMetaDataState - should succeed to update MetadataState if metadataUpdater', async () => {
    await nftDatatoken.addManager(nftAddress, user1, user1)
    await nftDatatoken.addMetadataUpdater(nftAddress, user1, user1)
    let metadata = await nftDatatoken.getMetadata(nftAddress)

    assert(metadata[2] === '1')
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === true
    )

    await nftDatatoken.setMetadataState(nftAddress, user1, 2)

    metadata = await nftDatatoken.getMetadata(nftAddress)
    assert(metadata[2] === '2')
  })

  it('#setMetaDataState - should fail to update MetadataState if NOT metadataUpdater', async () => {
    let metadata = await nftDatatoken.getMetadata(nftAddress)
    assert(metadata[2] === '2')
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user3)).updateMetadata === false
    )
    try {
      await nftDatatoken.setMetadataState(nftAddress, user3, 1)
      assert(false)
    } catch (e) {
      assert(e.message === 'Caller is not Metadata updater')
    }
    metadata = await nftDatatoken.getMetadata(nftAddress)
    assert(metadata[2] === '2')
  })

  it('#setTokenURI - should update TokenURI', async () => {
    const tx = await nftDatatoken.setTokenURI(nftAddress, user1, 'test')
    assert(tx.events.TokenURIUpdate)
  })

  it('#setMetaDataAndTokenURI - should update tokenURI and set metadata', async () => {
    const data = web3.utils.asciiToHex(user2)
    const metadataAndTokenURI: MetadataAndTokenURI = {
      metaDataState: META_DATA_STATE,
      metaDataDecryptorUrl: DECRYPTO_URL,
      metaDataDecryptorAddress: DECRYPTOR_ADDRESS,
      flags: web3.utils.asciiToHex(user1),
      data: web3.utils.asciiToHex(user1),
      metaDataHash: '0x' + sha256(data).toString(),
      tokenId: 1,
      tokenURI: 'https://anothernewurl.com/nft/',
      metadataProofs: []
    }
    assert(
      (await nftDatatoken.getNftPermissions(nftAddress, user1)).updateMetadata === true
    )

    const tx = await nftDatatoken.setMetadataAndTokenURI(
      nftAddress,
      user1,
      metadataAndTokenURI
    )
    assert(tx.events.TokenURIUpdate)
    assert(tx.events.MetadataUpdated)

    const metadata = await nftDatatoken.getMetadata(nftAddress)
    assert(metadata[0] === DECRYPTO_URL)
    assert(metadata[1] === DECRYPTOR_ADDRESS)
  })
})
