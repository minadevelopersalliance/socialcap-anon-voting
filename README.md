# Socialcap Anonymous Voting


### Semaphore

As a base for anonymity we implemented an [o1js](https://docs.minaprotocol.com/zkapps/o1js) version of the [Semaphore protocol](./docs/semaphore.md).

These are the base components of the protocol, implemented using `o1js` for proofs and crypto primitives (hashing, encryption, private and public key generation, merkles).

In `src/semaphore` folder:

- [identity](src/semaphore/identity.ts) : create and register identities
- [prover](src/semaphore/prover.ts): create ZK proofs as required by the protocol
- [signals](src/semaphore/signals.t): prepare signals for broadcasting
- [merkles](src/semaphore/merkles.ts): operate on Indexed Merkle Maps

### Contracts

- [claim](src/contracts/claim.ts): deploys a new claim and closes voting on it
- [aggregator](src/contracts/aggregator.ts): does the recursive voting for each claim
- [credential](src/contracts/credential.ts): issues a new credential and queries it
