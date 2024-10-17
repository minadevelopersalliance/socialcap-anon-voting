/**
 * Claims voting account
 * Deploys, evaluates and closes the voting account for a claim
 */
import { SmartContract, state, State, method, Reducer } from "o1js";
import { Field, Struct,  Provable, UInt64 } from "o1js";
import { ClaimRollupProof } from "./aggregator.js";

export enum ClaimResult { 
  VOTING = 0,    // still voting, no final result
  APPROVED = 20, // totalVotes >= requiredVotes, positives >= requiredPositives 
  REJECTED = 19, // totalVotes >= requiredVotes, positives < requiredPositives 
  IGNORED = 18, // totalVotes < requiredVotes 
}   

export const DATA_SIZE = 14;

export class ClaimAction extends Struct({
  doneUTC: UInt64,    // when was it done (UTC timestamp)
  total: UInt64,
  // packed votes array, we can pack up to 256/2*DATA_SIZE votes here
  votes: Provable.Array(Field, DATA_SIZE), 
}) {
  static init(): ClaimAction {
    return {
      doneUTC: UInt64.from(0),
      total: UInt64.from(0),
      votes: (new Array(DATA_SIZE)).fill(Field(0))
    }
  }

  static update(action: ClaimAction, 
    sequence: UInt64,
    total: UInt64,
    votes: Field[]
  ): ClaimAction {
    action.doneUTC = sequence;
    action.total = total;
    action.votes = votes;
    return action
  }
}

function packAsField(a: Field, b: Field, c: Field): Field {
  let t = Field(0).add(a).add(b).add(c);
  let packed = Field(0)
    .add(t.mul(Field(1_0000_0000_0000)))
    .add(a.mul(Field(1_0000_0000)))
    .add(b.mul(Field(1_0000)))
    .add(c);
  return packed;
}


export class ClaimVotingContract extends SmartContract {
  reducer = Reducer({ actionType: ClaimAction });
  @state(Field) initialActionState = State<Field>();

  // associated claim (referenced in Root contract on claimsRoots dataset)
  @state(Field) claimUid = State<Field>(); 

  // packed current voting status (total, positives, negatives, ignored)
  @state(Field) votes = State<Field>(); 
  
  // end conditions
  // if we have at least 'requiredVotes' the election is finished
  // if we have at least 'requiredPositive' votes the claim is approved
  @state(Field) requiredVotes = State<Field>(); 
  @state(Field) requiredPositives = State<Field>(); 
  
  // final result 
  @state(Field) result = State<Field>(); 

  // the IndexedMerkleMap root of all claim data+metadata stored in IPFS, 
  // whose url can be found in the .account.zkappUri field.
  @state(Field) dataRoot = State<Field>(); 
  
  init() {
    super.init();
    this.claimUid.set(Field(0));
    this.votes.set(Field(0));
    this.requiredVotes.set(Field(0));
    this.requiredPositives.set(Field(0));
    this.result.set(Field(ClaimResult.VOTING));
    this.initialActionState.set(Reducer.initialActionState);
    this.dataRoot.set(Field(0));
  }

  /**
   * This closes the voting process and calculates final result.
   * @param claimUid 
   * @param proof 
   * @param action 
   */
  @method async closeVoting(
    rollupProof: ClaimRollupProof,
    action: ClaimAction,
  ) { 
    // verify last proof coming from the rollup
    rollupProof.verify();

    // we only can set the result if it has never been set before
    this.result.getAndRequireEquals()
      .assertEquals(Field(ClaimResult.VOTING), "This claim is closed. Can not change results.");

    // very basic check for the claimUid 
    this.claimUid.getAndRequireEquals()
      .assertEquals(rollupProof.publicOutput.claimUid);

    // we get counted votes from the rollup
    let positives = rollupProof.publicOutput.positives;
    let negatives = rollupProof.publicOutput.negatives;
    let ignored = rollupProof.publicOutput.ignored;
    //Provable.log("Votes from proof: ", positives, negatives, ignored);

    let requiredPositives = this.requiredPositives.getAndRequireEquals();
    let requiredVotes = this.requiredVotes.getAndRequireEquals();
    
    // assert votes and result
    let total = Field(0).add(positives).add(negatives).add(ignored);
    let isRequiredQuorum = total.greaterThanOrEqual(requiredVotes);
    let isRequiredPositives = positives.greaterThanOrEqual(requiredPositives);
    let rs = Provable.if(isRequiredQuorum,
      Provable.if(isRequiredPositives, 
        Field(ClaimResult.APPROVED), // quorum reached and enough +1
        Field(ClaimResult.REJECTED)  // quorum reached but NOT enough +1
      ), 
      Field(ClaimResult.IGNORED) // quorum NOT reached, claim was IGNORED
    );
    //Provable.log("Required: ", isRequiredQuorum, isRequiredPositives);
    //Provable.log("Result calculated: ", rs);
    
    // settle FINAL RESULTs
    this.result.set(rs);
    //Provable.log("Result after set: ", this.result.get());

    // votes are packed into one field to save limited state
    this.votes.getAndRequireEquals();
    this.votes.set(packAsField(positives, negatives, ignored));

    // dispatch the action with the packed votes info
    this.reducer.dispatch(action);
  }
}
