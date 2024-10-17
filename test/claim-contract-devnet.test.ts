import 'dotenv/config';
import { AccountUpdate, Field, Mina, PrivateKey, PublicKey, UInt64, fetchAccount } from 'o1js';
import { ClaimVotingContract, ClaimResult, ClaimAction, pack2bigint } from '../src/contracts/index.js';
import { ClaimRollup, ClaimRollupProof } from "../src/contracts/aggregator.js";

const MINA = 1e9;
const TXNFEE = 300_000_000;


describe('Add', () => {
  // let client: Client | undefined;

  let deployer = {
    pk: PublicKey.fromBase58(process.env.DEVNET_DEPLOYER_PK+''),
    sk: PrivateKey.fromBase58(process.env.DEVNET_DEPLOYER_SK+''),
  }

  let zkAppAddress: PublicKey, 
    zkAppPrivateKey: PrivateKey, 
    zkApp: ClaimVotingContract;

  // claim data
  let claimUid = '1234';
  let ipfsHash = "bafkreiffmjsjlpfsuv3k6ryzz7yfvbn4f5xfhqo246lj5e22raxns5g5om";
  let zkappUri = `${process.env.PINATA_GATEWAY_URL}/${ipfsHash}`;

  beforeAll(async () => {
    const Network = Mina.Network({
      mina: "https://api.minascan.io/node/devnet/v1/graphql",
      archive: "https://api.minascan.io/archive/devnet/v1/graphql"      
    });
    Mina.setActiveInstance(Network);
    console.log('Devnet network instance configured.');
    //client = new Client({ network: Network.getNetworkId() }); 
  
    await ClaimRollup.compile();
    await ClaimVotingContract.compile();
  
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ClaimVotingContract(zkAppAddress);
    
    console.log('zkApp :', zkAppAddress.toBase58(), zkAppPrivateKey.toBase58());
    console.log("Done compile: ", (new Date()).toISOString());
  });

  it('Deploys the smart contract', async () => {
    const txn = await Mina.transaction(
      { sender: deployer.pk, fee: TXNFEE }, 
      async () => {
        AccountUpdate.fundNewAccount(deployer.pk);
        await zkApp.deploy();
        zkApp.claimUid.set(Field(claimUid));
        zkApp.requiredVotes.set(Field(4));
        zkApp.requiredPositives.set(Field(3));
        zkApp.votes.set(Field(pack2bigint(0,0,0)));
      }
    );
    await txn.prove();

    // this tx needs .sign(), because `deploy()` adds 
    // an account update that requires signature authorization
    let pendingTxn = await txn.sign([deployer.sk, zkAppPrivateKey]).send();
    console.log("pendingTxn hash:", pendingTxn.hash)

    await pendingTxn.wait();
    console.log("Done deploy: ", (new Date()).toISOString());

    let isReady = await waitForAccount(zkAppAddress.toBase58());
    console.log("isReady? ", isReady);
  });

  it('Rollup votes and creates claim', async () => {
    let proof = await ClaimRollup.init({
      claimUid: Field(claimUid),
      positives: Field(0),
      negatives: Field(0),
      ignored: Field(0),
      total: Field(0),
      requiredPositives: Field(3),
      requiredVotes: Field(4),
      result: Field(ClaimResult.VOTING) // contract will change this
    })
    console.log("proof.publicOutput: ", JSON.stringify(proof.publicOutput,null,2));

    let serializedProof = JSON.stringify(proof.toJSON());
    let deserializedProof = await ClaimRollupProof.fromJSON(JSON.parse(serializedProof));

    let packedVotesAction = ClaimAction.init();

    const txn = await Mina.transaction(
      { sender: deployer.pk, fee: TXNFEE }, 
      async () => {
        zkApp.account.zkappUri.set(zkappUri);
        await zkApp.closeVoting(
          proof,
          packedVotesAction
        );
      }
    );
    await txn.prove();

    let pendingTxn = await txn.sign([deployer.sk]).send();
    console.log("pendingTxn hash:", pendingTxn.hash)

    await pendingTxn.wait();
    console.log("Done @method closeVoting: ", (new Date()).toISOString());

    console.log("zkApp.result.get: ", zkApp.result.get().toString());
    // expect(zkApp.result.get().toString()).toBe(ClaimResult.IGNORED.toString())
  });

  it('Get all last actions', async () => {
    // let initialActionState = zkApp.initialActionState.get();
    // console.log("initialActionState: ", initialActionState.toString());
    // let response = await Mina.fetchActions(zkAppAddress, {
    //   fromActionState: initialActionState
    // });
    // console.log("fetchActions response: ", JSON.stringify(response, null, 2));
  });  
});


/**
 * Waits for the account to be really available for receiving updates.
 * @param address 
 * @returns True or False (if not ready after MAX_RETRIES*DELAY secs)
 */
async function waitForAccount(address: string): Promise<boolean> {
  let isReady = false;
  let counter = 0; 
  const MAX_RETRIES = 200;
  const DELAY = 5; // secs

  for (;;) {
    let response = await fetchAccount({ publicKey: address });
    let accountExists = response.account !== undefined;
    if (accountExists && response.account?.zkapp?.appState !== undefined) {
      isReady = true;
      break;
    }

    if (!accountExists) {
      counter++;
      console.log(`Waiting for account after: ${counter*DELAY} secs`);
      // continue waiting ...
      await new Promise((resolve) => setTimeout(resolve, DELAY*1000));
    } 

    if (counter > MAX_RETRIES) {
      isReady = false;
      console.log(`Account not available after ${MAX_RETRIES*DELAY} secs`);
      break;
    }
  }

  return isReady;
}
