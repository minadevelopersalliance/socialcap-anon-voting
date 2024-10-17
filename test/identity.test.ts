import { Signature, Field, PrivateKey } from "o1js";
import { Identity, proveIdentityOwnership } from "../src/semaphore";

describe('Use Semaphore Identity class', () => {

  beforeAll(async () => {
    // nothing here
  });

  it('creates a new Identity object and saves it', async () => {
    let identity = Identity.create('juancito', '605435');
    console.log(identity);
    identity.save();
  });

  it('reads an existent Identity object', async () => {
    let identity = Identity.read('juancito');
    console.log(identity);
  });

  it('proves an Identity', async () => {
    let identity = Identity.read('juancito');
    let pin = '605435';
    console.log(identity);

    // we need to get the signature 
    // we can sign directly using the privateKey in the identity 
    let ts = Date.now().toString();
    let signature = Signature.create(
      PrivateKey.fromBase58(identity.sk), 
      [Field(identity.commitment), Field(ts)]
    );
    console.log('signature: ', signature);

    const proof = await proveIdentityOwnership(identity, pin, signature);
    identity.ownershipProof = proof;
    identity.save();

    console.log("finally: ", proof);
  });
});
