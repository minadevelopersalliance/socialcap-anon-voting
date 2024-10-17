/**
 * Recursive Aggregator.
 * It counts all received signals for a given claim.
 */
import { Field, Signature, Poseidon, PublicKey } from "o1js";
import { ZkProgram, SelfProof, Provable, Struct } from "o1js";
import { SmallMerkleMap, MediumMerkleMap } from "../semaphore/merkles.js";
import { ClaimResult } from "../contracts/claim.js";

export {
  ClaimRollup,
  ClaimRollupProof,
  ClaimState
}

class ClaimState extends Struct({
  claimUid: Field,
  positives: Field,
  negatives: Field,
  ignored: Field,
  total: Field,
  result: Field,
  requiredVotes: Field,
  requiredPositives: Field  
}) {}


const ClaimRollup = ZkProgram({
  name: "claim-voting-rollup",
  publicInput: ClaimState,
  publicOutput: ClaimState,

  methods: {
    /**
     * Setup the claim initial values and requirements
     */
    init: {
      privateInputs: [],
      async method(
        state: ClaimState, // public input
      ) {
        state.positives.assertEquals(Field(0));
        state.negatives.assertEquals(Field(0));
        state.ignored.assertEquals(Field(0));
        state.total.assertEquals(Field(0));
        state.result.assertEquals(Field(ClaimResult.VOTING));
        state.requiredPositives.assertGreaterThan(Field(0));
        state.requiredVotes.assertGreaterThan(Field(0));
        state.requiredPositives.assertLessThanOrEqual(state.requiredVotes);
        state.claimUid.assertGreaterThan(Field(0))
        return state;
      },
    },

    /**
     * Verify received signal and recursively count votes
     */
    rollup: {
      privateInputs: [
        SelfProof, 
        MediumMerkleMap.provable,
        MediumMerkleMap.provable,
        SmallMerkleMap.provable,
        SmallMerkleMap.provable,
        Field,
        PublicKey,
        Field,
        Field,
        Signature,
        Field
      ],
      async method(
        state: ClaimState,
        previousProof: SelfProof<ClaimState, ClaimState>,
        validatorsGroup: MediumMerkleMap, 
        auditorsGroup: MediumMerkleMap, 
        claimElectors: SmallMerkleMap,
        claimNullifiers: SmallMerkleMap,
        // the elector's data
        elector: Field, // the identity commitment
        electorPk: PublicKey, // the elector's pk (related to its identity)
        // the Semaphore signal needed to prove origin of vote
        signal: Field, // the vote signal as included in the batch
        nullifier: Field, // the vote nullifier as included in the batch
        signature: Signature, // the vote signature as included in the batch
        vote: Field // the vote value itself
      ) {
        // verify the proof received from previous state change
        previousProof.verify();

        // assert the elector is a registered community elector
        let isValidator = validatorsGroup.getOption(elector).isSome;
        let isAuditor = auditorsGroup.getOption(elector).isSome; 
        isValidator.or(isAuditor)
          .assertTrue("Elector not registered in this community");

        //  assert the elector has been assigned to this claim
        claimElectors.getOption(elector).isSome
          .assertTrue("Elector not assigned to claim");

        //  assert the elector has not voted before on this claim
        claimNullifiers.getOption(nullifier).isSome
          .assertFalse("Vote already counted");

        //  assert he vote signal contains the correct values
        let computedSignal = Poseidon.hash([state.claimUid, elector, vote])
        computedSignal.assertEquals(signal, "Invalid signal received");

        // verify the vote signal signature is ok 
        signature.verify(electorPk, [signal, nullifier]);  

        // now we count votes
        let positives = Provable.if(vote.equals(Field(1)), 
          state.positives.add(1), 
          state.positives
        );
        let negatives = Provable.if(vote.equals(Field(-1)), 
          state.negatives.add(1), 
          state.negatives
        );
        let ignored = Provable.if(vote.equals(Field(0)), 
          state.ignored.add(1), 
          state.ignored
        );
        let total = Field(0).add(positives).add(negatives).add(ignored);

        // we return the new changed state
        return {
          claimUid: state.claimUid,
          requiredVotes: state.requiredVotes,
          requiredPositives: state.requiredPositives,  
          positives: positives,
          negatives: negatives,
          ignored: ignored,
          total: total,
          result: state.result,
        };
      },
    },

    /**
     * Evaluate final result. Note that we can not do it until we are sure
     * that we have received and counted all votes, that is why this final
     * step is necessary.
     */
    final: {
      privateInputs: [
        SelfProof 
      ],
      async method(
        state: ClaimState,
        previousProof: SelfProof<ClaimState, ClaimState>,
      ) {
        // verify the proof received from previous state change
        previousProof.verify();

        // we evaluate the final result and state
        let newState = state;
        let requiredQuorum = state.total.greaterThanOrEqual(state.requiredVotes);
        let requiredPositives = state.positives.greaterThanOrEqual(state.requiredPositives);
        newState.result = Provable.if(requiredQuorum,
          Provable.if(requiredPositives, 
            Field(ClaimResult.APPROVED), // quorum reached and enough +1
            Field(ClaimResult.REJECTED)  // quorum reached but NOT enough +1
          ), 
          Field(ClaimResult.IGNORED) // quorum NOT reached, claim was IGNORED
        );

        return newState;
      },
    },    
  },  
});

class ClaimRollupProof extends ZkProgram.Proof(ClaimRollup) { }
