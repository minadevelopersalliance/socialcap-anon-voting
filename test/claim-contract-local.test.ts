import 'dotenv/config';
import { AccountUpdate, Field, Mina, PrivateKey, PublicKey, UInt64 } from 'o1js';
import Client from 'mina-signer';
import { ClaimVotingContract, ClaimResult, ClaimAction, pack2bigint } from '../src/contracts/index.js';
import { ClaimRollup, ClaimRollupProof } from "../src/contracts/aggregator.js";

const MINA = 1e9;
const TXNFEE = 150_000_000;
const MIN_PAYMENT = 5*MINA;

let proofsEnabled = true;

describe('Add', () => {
  let client: Client | undefined;
  let deployer: Mina.TestPublicKey;
  let payer: Mina.TestPublicKey;
  let zkAppAddress: PublicKey, 
    zkAppPrivateKey: PrivateKey, 
    zkApp: ClaimVotingContract;

  let claimUid = '1234';

  let ipfsHash = "bafkreiffmjsjlpfsuv3k6ryzz7yfvbn4f5xfhqo246lj5e22raxns5g5om";
  let zkappUri = `${process.env.PINATA_GATEWAY_URL}/${ipfsHash}`;

  beforeAll(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    [deployer, payer] = Local.testAccounts;
    client = new Client({ network: Local.getNetworkId() }); 
  
    await ClaimRollup.compile();

    await ClaimVotingContract.compile();
  
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ClaimVotingContract(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkApp.deploy();
      zkApp.claimUid.set(Field(claimUid));
      zkApp.requiredVotes.set(Field(4));
      zkApp.requiredPositives.set(Field(3));
      zkApp.votes.set(Field(pack2bigint(0,0,0)));
    });
    await txn.prove();
    await txn.sign([deployer.key, zkAppPrivateKey]).send();
  }

  it('Deploys contract', async () => {
    await localDeploy();
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

    const txn = await Mina.transaction(deployer, async () => {
      zkApp.account.zkappUri.set(zkappUri);
      await zkApp.closeVoting(
        deserializedProof,
        packedVotesAction
      );
    });
    await txn.prove();
    await txn.sign([deployer.key]).send();

    console.log("Result: ", zkApp.result.get().toString());
    expect(zkApp.result.get().toString()).toBe(ClaimResult.IGNORED.toString())
  });

  it('Get all last actions', async () => {
    let initialActionState = zkApp.initialActionState.get();
    let response = await Mina.fetchActions(zkAppAddress, {
      fromActionState: initialActionState
    });
    console.log("fetchActions response: ", JSON.stringify(response, null, 2));
  });  
});
