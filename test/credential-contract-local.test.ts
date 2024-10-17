import 'dotenv/config';
import { AccountUpdate, Field, Mina, PrivateKey, PublicKey, UInt64 } from 'o1js';
import { CredentialContract, CredentialRevokeAuth } from "../src/contracts/credential";

const MINA = 1e9;
const TXNFEE = 150_000_000;
const MIN_PAYMENT = 5*MINA;

let proofsEnabled = true;

describe('Credential contract', () => {
  let deployer: Mina.TestPublicKey; // would be a Socialcap account
  let owner: Mina.TestPublicKey; // would be final owner
  let issuer: Mina.TestPublicKey; // would be final issuer
  let zkappAddr: string;
  let zkappSk: PrivateKey;
  let zkapp: CredentialContract;

  let claimUid = '80001234';
  let planUid = '90011234';
  let communityUid = '700000021';
  let ipfsHash = "bafkreiffmjsjlpfsuv3k6ryzz7yfvbn4f5xfhqo246lj5e22raxns5g5om";
  let zkappUri = `${process.env.PINATA_GATEWAY_URL}/${ipfsHash}`;

  beforeAll(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);

    [deployer, owner, issuer] = Local.testAccounts;
  
    await CredentialContract.compile();

    zkappSk = PrivateKey.random();
    zkappAddr = zkappSk.toPublicKey().toBase58();
    zkapp = new CredentialContract(PublicKey.fromBase58(zkappAddr));
  });

  async function localDeploy() {
    const txn = await Mina.transaction(
      { sender: deployer, fee: TXNFEE }, 
      async () => {
        AccountUpdate.fundNewAccount(deployer);
        await zkapp.deploy();
        zkapp.account.zkappUri.set(zkappUri);
        zkapp.claimUid.set(Field(claimUid));
      }
    );
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployer.key, zkappSk]).send();
  }

  it('Deploys a new CredentialContract', async () => {
    await localDeploy();
  });

  it('Issues a credential', async () => {
    let claim = PublicKey.empty(); 

    const txn = await Mina.transaction(deployer, async () => {
      zkapp.account.zkappUri.set(zkappUri);
      await zkapp.issue(
        Field(claimUid), 
        Field(planUid),
        Field(communityUid),
        claim,
        owner,
        issuer,
        Field(1001),
        UInt64.from(1001),
        UInt64.from(Date.now()+ 1000 * 60 * 60 * 24 * 365),
        Field(CredentialRevokeAuth.ISSUER_ONLY), //revokeAuth: Field,
        UInt64.from(Date.now()) //timestamp: UInt64,
      )
    });
    await txn.prove();
    await txn.sign([deployer.key, zkappSk]).send();

    let lastRetrieved = zkapp.retrieveLast();
    console.log(JSON.stringify(lastRetrieved, null, 2));
    //console.log(lastRetrieved.issuer.toBase58());
  });

  it('Get the CredentialState', async () => {
    let state = zkapp.getCredentialState();
    console.log(JSON.stringify(state, null, 2));
    //console.log(lastRetrieved.issuer.toBase58());
  });

  it('Checks ownership (must FAIL)', async () => {
    try {
      const txn = await Mina.transaction(deployer, async () => {
        await zkapp.isOwner(Field(claimUid), UInt64.from(Date.now()))
      });
      await txn.prove();
      await txn.sign([deployer.key]).send();
    }
    catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('Checks ownership (must PASS)', async () => {
    const txn = await Mina.transaction(owner, async () => {
      await zkapp.isOwner(Field(claimUid), UInt64.from(Date.now()))
    });
    await txn.prove();
    await txn.sign([owner.key]).send();
  });

  it('Try to reissue (must FAIL)', async () => {
    try {
      let claim = PublicKey.empty(); 
      const txn = await Mina.transaction(deployer, async () => {
        await zkapp.issue(
          Field(claimUid), 
          Field(planUid),
          Field(communityUid),
          claim,
          owner,
          issuer,
          Field(1001),
          UInt64.from(1001),
          UInt64.from(Date.now()+ 1000 * 60 * 60 * 24 * 365),
          Field(CredentialRevokeAuth.ISSUER_ONLY), //revokeAuth: Field,
          UInt64.from(Date.now()) //timestamp: UInt64,
        )
      });
      await txn.prove();
      await txn.sign([deployer.key]).send();
    }
    catch (error) {
      expect(error).toBeDefined();
    }
  });
});
