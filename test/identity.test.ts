import { Identity, registerIdentity } from "../src/semaphore";

describe('Use Semaphore Identity class', () => {

  const testGroup = 'comunities.cn021.electors';

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

  it('registers an Identity in the service', async () => {
    let identity = Identity.read('juancito');
    console.log(identity);

    let rsp = await registerIdentity(identity, testGroup);
    console.log("finally: ", rsp);
  });
// 
//   it('creates many identities in the service', async () => {
//     for (let j=0; j < 10; j++) {
//       let identity = Identity.create('idn'+j, '666'+j);
//       console.log(identity);
//       identity.save();
//   
//       let rsp = await registerIdentity(identity, testGroup);
//       console.log("registered: ", rsp);
//     }
//   });
});
