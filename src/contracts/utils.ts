
/**
 * Packs 3 integers into a "legible" bigint including its checksum.
 * Is legible because when stringified, each of the numbers will take 4 digits 
 * of the full bigint representation. making it ease to read the component
 * values.
 * Example: a=3, b=3, c=3 will give '9000300030003'
 */
export function pack2bigint(a: number, b: number, c: number): bigint {
  let t = a + b + c;
  let r = BigInt(1_000_000_000_000*t) 
    + BigInt(100_000_000*a) 
    + BigInt(10_000*b) 
    + BigInt(c);  
  return r;
}

/*
We can pack up to 9600 votes in the 5 active actions states of a zkApp account, 
and can keep a lot more if we dispatch more actions (at a rate of 1920 votes/action)

How ?

- We need to pack either Positive, Negative or Abstained values and so we need just 2 bits per vote.
- We can pack 128 votes in 256 bits Field
- We can have up to 16 Fields per action, but reserve the first Field for the actionType and order.
- So each action can hold up to 1920 votes in its 15 available Fields.
- A zkAppp has readily available the last 5 actions. 
- So 1920 (votes/action) * 5 (actions) gives us 9600 votes

Caution:

- These are not "provable", we keep them for data availability reasons so we can replay the voting if necessary
- We keep just the votes and NOT the identity commitment of electors

Packing votes

function str2bits(c: string): number {
  switch (c) {
    case '+': return 0b00;
    case '-': return 0b01;
    case 'a': return 0b10;
    default: throw Error("Invalid character");
  }
}

function bits2str(bits: number): string {
  switch (bits) {
    case 0b00: return '+';
    case 0b01: return '-';
    case 0b10: return 'o';
    default: throw Error("Invalid bits");
  }
}

function packVotesToField(s: string[]): Field[] {
  if (s.length > 128)
    throw Error("Can not pack more than 128 votes per Field");

  let packed = BigInt(0);
  s.forEach((c, index) => {
      const bits = str2bits(c);
      packed |= BigInt(bits) << BigInt(index * 2);
  });

  return packed;
}

function unpackVotesFromFields(packedNumber: bigint, length: number): string[] {
    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
        const bits = Number((packedNumber >> BigInt(i * 2)) & BigInt(0b11));
        chars.push(bitsToChar(bits));
    }
    return chars;
}

*/
/*
  // ver https://github.com/zkcloudworker/rollup-contract/blob/main/src/contract/domain-contract.ts
  export class BlockParams extends Struct({
    txsCount: UInt32,
    timeCreated: UInt64,
    isValidated: Bool,
    isFinal: Bool,
    isProved: Bool,
    isInvalid: Bool,
  }) {
    pack(): Field {
      const txsCount = this.txsCount.value.toBits(32);
      const timeCreated = this.timeCreated.value.toBits(64);
      return Field.fromBits([
        ...txsCount,
        ...timeCreated,
        this.isValidated,
        this.isFinal,
        this.isProved,
        this.isInvalid,
      ]);
    }
    static unpack(packed: Field) {
      const bits = packed.toBits(32 + 64 + 4);
      const txsCount = UInt32.from(0);
      const timeCreated = UInt64.from(0);
      txsCount.value = Field.fromBits(bits.slice(0, 32));
      timeCreated.value = Field.fromBits(bits.slice(32, 96));
      return new BlockParams({
        txsCount,
        timeCreated,
        isValidated: bits[96],
        isFinal: bits[97],
        isProved: bits[98],
        isInvalid: bits[99],
      });
    }
  }
*/
    