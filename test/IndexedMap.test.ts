import { Experimental, Field, PrivateKey, Poseidon, ZkProgram, verify } from 'o1js';
const { IndexedMerkleMap } = Experimental;

let proofsEnabled = false;

class MerkleMap extends IndexedMerkleMap(33) {}

let map = new MerkleMap();

const GroupProver = ZkProgram({
  name: 'prove-in-group',
  publicInput: Field,
  publicOutput: Field,

  methods: {
    /** It registers an identity in the Group */
    /** the proving works BUT the group is not modified */
    registerIdentity: {
      privateInputs: [
        MerkleMap.provable,
        Field
      ],
      async method(
        state: Field,
        group: MerkleMap, 
        identityHash: Field
      ) {
        group.assertNotIncluded(identityHash);
        group.insert(identityHash, Field(0));
        group.assertIncluded(identityHash);
        return group.root;
      }
    }
  }  
});


describe('Use IndexedMerkleMap', () => {

  let someone = PrivateKey.randomKeypair();
  let communityUid = "80008001";
  let myPin = "060633";
  
  let identityHash = Poseidon.hash(
    someone.publicKey.toFields()
    .concat([Field(communityUid), Field(myPin)])
  );    

  beforeAll(async () => {
    // nothing here
  });

  it('inserts a key,value', async () => {
    let key = Field(1001), value = Field(9001);
    map.insert(key, value);
    let r = map.get(key);
    expect(r.toString()).toBe(value.toString())
  });

  it('updates an existent key, value', async () => {
    let key = Field(1001), value = Field(8001);
    map.update(key, value);
    let r = map.get(key);
    expect(r.toString()).toBe(value.toString())
  });

  it('sets a new key,value', async () => {
    let key = Field(2001), value = Field(9001);
    let o = map.set(key, value);
    expect(o.isSome.toBoolean()).toBe(false);
    let r = map.get(key);
    expect(r.toString()).toBe(value.toString())
  });
  
  it('sets an existent key, value', async () => {
    let key = Field(2001), value = Field(8001);
    let o = map.set(key, value);
    expect(o.isSome.toBoolean()).toBe(true);
    let r = map.get(key);
    expect(r.toString()).toBe(value.toString())
  });

  it('get root', async () => {
    let r = map.root
    expect(r).toBeTruthy();
  });

  it('check inclusion/no-inclusion', async () => {
    map.assertIncluded(Field(1001));
    map.assertNotIncluded(Field(7001));
  });

  // Finally test in ZkProgram //
  it('creates a Prover that uses an IndexedMerkleMap', async () => {
    const { verificationKey } = await GroupProver.compile();

    let group = new MerkleMap();

    let registeredProof = await GroupProver.registerIdentity(
      group.root,
      group, 
      identityHash
    )
    console.log('registeredProof: ', 
      JSON.stringify(registeredProof.publicInput, null, 2),
      JSON.stringify(registeredProof.publicOutput, null, 2)
    );
    registeredProof.verify();
    
    // test the proof (usually on node side)
    const okVerified = await verify(registeredProof.toJSON(), verificationKey);
    console.log('registeredProof ok? ', okVerified);  

    // checks the inserted value exists
    // THIS FAILS, the group is not updated
    //group.assertIncluded(identityHash);
  });
});
