import fs from "fs"
import { randomInt } from "crypto";
import { Field, Poseidon, Signature, PublicKey, verify, PrivateKey, Encoding } from "o1js";
import { Identity } from "../src/semaphore";
import { proveIdentityOwnership } from "../src/semaphore/prover";

// these are shared test parameters
import { 
  communityUid, 
  MAX_MEMBERS, 
  identityCommitment, 
  identityFile,
  tmpFolder 
} from "./helper-params";

describe('Creates all identity proofs for all electors', () => {

  let identityName = 'idn47'; // we will test this elector 
  let assignment: ElectorAssignment | null = null;
  let IdentitiesDictio: any = {};

  beforeAll(async () => {
    // 
  });

  it.only('Create proofOfIdentity and save for all electors', async () => {
    // we will vote on 'plan001'
    const planUid = 'plan001';

    buildIdentitiesDictio();

    // get all the electors that vote on this plan
    let electors = readPlanElectors(planUid);
    console.log(`Plan ${planUid} electors: `, JSON.stringify(electors, null, 2));

    // traverse the electors an emit a batch of votes per elector
    for (let j=0; j < electors.length; j++) {
      let e = electors[j];

      // get identity for this elector
      let identity = IdentitiesDictio[e];
      if (!identity) return;
      
      const proofFile = `${tmpFolder}/proofs.${identity.commitment}.json`;

      // if we already have it, jump to next elector
      if (fs.existsSync(proofFile)) 
        continue;

      delay(10);
      let proofOfIdentity = await proveIdentityOwnership(
        identity, 
        identity.commitment, 
        Signature.create(
          PrivateKey.fromBase58(identity.sk),
          [Field(identity.commitment)] 
        )
      );
      delay(20);

      fs.writeFileSync(proofFile, JSON.stringify(proofOfIdentity));
    }
  });

  //-- Helpers --//
  function delay(secs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, secs*1000));
  }

  function buildIdentitiesDictio() {
    let dictio: any = JSON.parse(fs.readFileSync(
      `${tmpFolder}/all-identities.json`, "utf-8"
    ))

    Object.keys(dictio).forEach((k: string) => {
      let identity = Identity.read(dictio[k]);
      IdentitiesDictio[k] = identity;
    })
  }

  function readPlanElectors(planUid: string) {
    let claims = JSON.parse(fs.readFileSync(
      `${tmpFolder}/plan-${planUid}.electors.json`, 
      "utf-8"
    )) as VotingClaim[];
    let electors: string[] = [];
    claims.forEach((t: VotingClaim) => {
      (t.electors || []).forEach((e: string) => {
        if (!electors.includes(e)) electors.push(e);
      })
    })
    return electors;
  }
});
