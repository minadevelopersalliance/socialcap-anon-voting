/**
 * Credential account from an approved Claim
 * Issues a new credentiaal, and provides query methods for it.
 */
import { SmartContract, state, State, method, Reducer, Permissions } from "o1js";
import { Field, PublicKey, Bool, Struct, UInt64 } from "o1js";

export {
  CredentialAction,
  CredentialActionType,
  CredentialState,
  CredentialRevokeAuth,
  CredentialContract
}

class CredentialState extends Struct({
  status: UInt64,
  planUid: Field,
  claimUid: Field,
  communityUid: Field,
  claim: PublicKey, // address of the ClaimVoting account
  issuer: PublicKey, 		// who issued this Credential (usually a Community account)
  owner: PublicKey, 		// the final owner of the credential
  tokenRef: Field, 			// the token linked to this credential
  value: UInt64, 			// the token amount assigned to it
  issuedUTC: UInt64,      // issued date (UTC timestamp)
  expiresUTC: UInt64,     // expiration date (UTC timestamp), or zero if no expiration
  wasRevoked: Bool,       // was revoked by this or a previous action ?
  updatedUTC: UInt64 // when it was last updated
}) {}

enum CredentialActionType {
  INITIAL = 0,
  ISSUED = 1,         
  REVOKED = 2, 
  SUSPENDED = 3, 
  REINSTATED = 4
}

enum CredentialRevokeAuth {
  /** Some ideas taken from Soulbound tokens 
   * Credit: https://github.com/MinaFoundation/soulbound-tokens 
   */
  INITIAL = 0,
  ISSUER_ONLY = 1, // the issuer has the right to revoke tokens
  OWNWER_ONLY = 2, // only the holder of the token can revoke it
  BOTH = 3, // a token can only be revoked if issuer and holder agree
  NEITHER = 4 // tokens are indestructible
}

class CredentialAction extends Struct({
  // The action info
  type: UInt64,         // ISSUED, REVOKED, SUSPENDED, REINSTATED
  actionUTC: UInt64,    // when was it done (UTC timestamp)
  // State after the ISSUED action, it is setup when the credential is issued
  // and it is never changed again by any other action
  planUid: Field, // the credential master plan (is the 'type' of the credential)
  communityUid: Field,
  claim: PublicKey,
  issuer: PublicKey, 		// who issued this Credential (usually a Community account)
  issuedUTC: UInt64,      // issued date (UTC timestamp)
  expiresUTC: UInt64,     // expiration date (UTC timestamp), or zero if no expiration
  canRevoke: Field,      // who can revoke this credential 
}) {
  static init(): CredentialAction {
    return {
      type: UInt64.from(CredentialActionType.INITIAL),
      actionUTC: UInt64.from(0),
      planUid: Field(0),
      communityUid: Field(0), 
      claim: PublicKey.empty(),    
      issuer: PublicKey.empty(),
      issuedUTC: UInt64.from(0),  
      expiresUTC: UInt64.from(0), 
      canRevoke: Field(CredentialRevokeAuth.ISSUER_ONLY),   
    }
  }
}

class CredentialContract extends SmartContract {
  // the "reducer" field describes a type of action that we can dispatch, and reduce later
  reducer = Reducer({ actionType: CredentialAction });
  @state(Field) lastActionState = State<Field>();

  // associated claim (referenced in Root contract on claimsRoots dataset)
  @state(Field) claimUid = State<Field>(); 

  // owner of the final credential- After being issued 
  // only the owner or the issuer can make changes to it
  @state(PublicKey) owner = State<PublicKey>(); 

  // the root of the data+metadata MerkleTree, where each Leaf in the tree
  // refers to exactly one metadata property, being:
  //  leaf value = hash(stringified([propertyName, propertyValue])) 
  // metadata is stored off-chain in IPFS and the account zkappUri contains 
  // the final IPFS url
  @state(Field) dataRoot = State<Field>();
  @state(Field) tokenRef = State<Field>();
  @state(UInt64) value = State<UInt64>();

  init() {
    // ensure that init() cannot be called again after zkApp is set up
    // during the initial deployment.
    this.account.provedState.getAndRequireEquals();
    this.account.provedState.get().assertFalse();

    // now we do init
    super.init();
    this.claimUid.set(Field(0));
    this.owner.set(PublicKey.empty());
    this.tokenRef.set(Field(0));
    this.dataRoot.set(Field(0));
    this.value.set(UInt64.from(0));
    this.lastActionState.set(Reducer.initialActionState);

    // Configure this zkApp to be modifiable only by using proofs. It will not 
    // be upgradable after it is deployed. After its first deployment, it requires 
    // proof authorization and consequently can only be updated by transactions 
    // that fulfill the zkApp's smart contract logic. 
    // Ref: https://docs.minaprotocol.com/zkapps/tutorials/account-updates#smart-contracts
    this.account.permissions.set({
      ...Permissions.default(),
      editState:  Permissions.proofOrSignature(),
      receive: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
      setDelegate: Permissions.proofOrSignature(),
      setPermissions: Permissions.proofOrSignature(),
      setZkappUri: Permissions.proofOrSignature(),
      setTokenSymbol: Permissions.proofOrSignature(),
      incrementNonce: Permissions.proofOrSignature(),
      setVotingFor: Permissions.proofOrSignature(),
      setTiming: Permissions.proofOrSignature(),
    });
  }

  /**
   * Get the last available action 
   */
  retrieveLast(): CredentialAction {
    let lastActionState = this.lastActionState.getAndRequireEquals();
    let actions = this.reducer.getActions({
      fromActionState: lastActionState,
    });
    let initial: CredentialAction = CredentialAction.init();
    let lastOne = this.reducer.reduce(
      actions,
      CredentialAction,
      (state: CredentialAction, action: CredentialAction) => {
        state = action;
        return state;
      },
      initial
    );
    return lastOne;
  }

  /**
   * Issue the credential
   */
  @method async issue(
    claimUid: Field,
    planUid: Field,
    communityUid: Field,
    claim: PublicKey,
    owner: PublicKey,
    issuer: PublicKey,
    tokenRef: Field,
    value: UInt64,
    expires: UInt64,
    revokeAuth: Field,
    timestamp: UInt64,
  ) {
    this.claimUid.getAndRequireEquals()
      .assertEquals(claimUid);

    // assert the owner has never been assigned before, 
    // after setting the owner it can not be reissued again
    this.owner.getAndRequireEquals().assertEquals(PublicKey.empty());
    this.owner.set(owner);

    this.tokenRef.getAndRequireEquals();
    this.value.getAndRequireEquals();
    this.tokenRef.set(tokenRef);
    this.value.set(value);

    this.reducer.dispatch({
      type: UInt64.from(CredentialActionType.ISSUED),
      actionUTC: timestamp,
      planUid: planUid, 
      communityUid: communityUid,
      claim: claim,
      issuer: issuer,
      issuedUTC: timestamp,
      expiresUTC: expires, 
      canRevoke: revokeAuth,
    })
  }

  /**
   * Proves that the sender is the owner of the Credential
   */
  @method async isOwner(
    claimUid: Field,
    now: UInt64
  ) {
    const sender = this.sender.getAndRequireSignature();

    // very basic test
    this.claimUid.getAndRequireEquals()
      .assertEquals(claimUid, "Invalid claim uid");

    // verify if it is real Owner
    let owner = this.owner.getAndRequireEquals();
    let ok = owner.equals(sender);
    ok.assertTrue("Not the owner");

    // we need some info stored in the last action to check that 
    // it is not revoked, suspended or expired
    let last = this.retrieveLast();

    let revoked = last.type.equals(UInt64.from(CredentialActionType.REVOKED));
    revoked.assertFalse("Credential was revoked"); 

    let suspended = last.type.equals(UInt64.from(CredentialActionType.SUSPENDED));
    suspended.assertFalse("Credential was suspended"); 

    let expired = now.greaterThan(last.expiresUTC);
    expired.assertFalse("Credential has expired");
  }

  /**
   * Get the last available credential state
   * @returns CredentialState
   */
  getCredentialState(): CredentialState {
    let last: CredentialAction = this.retrieveLast();
    return {
      owner: this.owner.get(),
      claimUid: this.claimUid.get(),
      tokenRef: this.tokenRef.get(),
      value: this.value.get(),
      // this state props comes from the last action
      status: UInt64.from(last.type),
      planUid: last.planUid,
      communityUid: last.communityUid,
      claim: last.claim,
      issuer: last.issuer,
      issuedUTC: last.issuedUTC,  
      expiresUTC: last.expiresUTC, 
      wasRevoked: last.type.equals(UInt64.from(CredentialActionType.REVOKED)),
      updatedUTC: last.actionUTC,
    }
  }
}
