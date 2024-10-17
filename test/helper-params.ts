/**
 * Test params shared across different test groups
 */
import { randomUUID } from 'crypto';
import fs from "fs";
import { Mina, PrivateKey, Field, Signature } from 'o1js';

// a folder for temp file storage
export const tmpFolder = "test/files/tmp";
export const inputsFolder = "test/files/inputs";
export const outputFolder = "test/files/out";
export const privateFolder = "test/files/.private";


// community params
export let communityUid = '';
export let community: any ;
export const MAX_MEMBERS = 60, MAX_AUDITORS = 5, MAX_VALIDATORS = 20;
export const MAX_CLAIMS = 10;

// identity params
export let  identityCommitment = '';
export let identityFile = "idn43"

// plan params
export let planUid = '';

// Helpers

export const uuid = () => BigInt('0x'+randomUUID().replaceAll('-','')).toString();

export const deployer = {
  pk: process.env.DEVNET_DEPLOYER_PK as string,
  sk: process.env.DEVNET_DEPLOYER_SK as string
}

export const signature = (biguid: bigint, ts: number): Signature => {
  //let biguid = BigInt('0x'+uid);
  return Signature.create(
    PrivateKey.fromBase58(deployer.sk),
    [Field(biguid), Field(ts.toString())] 
  )
}

export const readCommunity = () => {
  community = JSON.parse(fs.readFileSync(
    `${inputsFolder}/community.json`, 
    "utf-8"
  ));
  communityUid = community.uid;
}

////////////////////////////////////////////////////////////////////////////////

/*
let Network: any;
let chainId = '';

export function setNetwork(id: string, proofsEnabled?: boolean): any  {
  chainId = id;
  if (chainId === 'local') {
    Network = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Network);
    console.log('Local network active instance.');
    return Network;
  }

  if (chainId === 'devnet') {
    Network = Mina.Network(
      'https://api.minascan.io/node/devnet/v1/graphql'
    );
    Mina.setActiveInstance(Network);
    console.log('Devnet network active instance.');
    return Network;
  }

  if (chainId === 'seko') {
    let graphqlEndpoint = 'https://devnet.zeko.io/graphql';
    Network = Mina.Network(graphqlEndpoint);
    Mina.setActiveInstance(Network);
    console.log('Zeko network active instance.');
    return Network;
  }
}

export function getTestAccounts() {
  if (chainId === 'local') {
    let  [t1, t2, t3] = Network.testAccounts;
    return [
      { pk: t1, sk: t1.key }, 
      { pk: t2, sk: t2.key }, 
      { pk: t3, sk: t3.key }, 
    ]
  }

  if (chainId === 'devnet') {
    return [
      { pk: process.env.DEVNET_DEPLOYER_PK, sk: process.env.DEVNET_DEPLOYER_SK }, 
      { pk: '', sk: '' }, 
      { pk: '', sk: '' }, 
    ]  
  }

  if (chainId === 'zeko') {
    return [
      { pk: process.env.ZEKO_DEPLOYER_PK, sk: process.env.ZEKO_DEPLOYER_SK }, 
      { pk: '', sk: '' }, 
      { pk: '', sk: '' }, 
    ]  
  }
}
*/  