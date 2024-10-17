/* eslint-disable @typescript-eslint/no-explicit-any */
import { Struct, Field, UInt32 } from 'o1js';
import { Experimental, SelfProof } from 'o1js';
import { KVS } from "./lmdb-kvs.js";
import { bigintFromBase64, bigintToBase64 } from './utils.js';

const { IndexedMerkleMap } = Experimental;

export {
  getOrCreate,
  saveMerkle,
  releaseMerkle,
  serializeMap,
  deserializeMap,
  getSortedKeys,
  AnyMerkleMap,
  SmallMerkleMap,
  MediumMerkleMap,
  BigMerkleMap
}

class SmallMerkleMap extends IndexedMerkleMap(12) {} // max 4096 nodes
class MediumMerkleMap extends IndexedMerkleMap(16) {} // max 65536 nodes
class BigMerkleMap extends IndexedMerkleMap(24) {} // max 16777216 nodes

type AnyMerkleMap = BigMerkleMap | MediumMerkleMap | SmallMerkleMap ;

const Pool = new Map<string, AnyMerkleMap>(); 

/**
 * Get or create (if it does not exist) a Merkle for the given Group uid. 
 * @param guid the Uid of the group
 * @param options contains a set of options "no_cache,empty,small|size|big"
 * @param options "no_cache" disables cache for a given group, default = ""
 * @param options "empty" return allways an empty tree, reset it if already exists
 * @param options "small | medium | large" size of the Merkle, default= "small" 
 * @returns 
 */
function getOrCreate(
  guid: string,
  options?: string // nocache
): AnyMerkleMap {
  if (!guid) 
    throw Error(`getOrCreate requires a 'guid' param`);

  // check options
  let cacheOn = !(options || "").includes('no_cache'); // we use cache
  let isNew = (options || "").includes('empty'); // always a new map

  // we allways want a new Merkle, do not get existent ones
  if (isNew)
    return (createMerkleMap(options));

  // check if it is in the cache
  if (Pool.has(guid)) 
    return Pool.get(guid) as AnyMerkleMap;

  // not in cache, check if it is saved in KVS
  const obj = KVS.get(guid);
  if (obj) {
    const restored = deserializeMap(obj.json, obj.type);
    cacheOn && Pool.set(guid, restored);
    return restored;
  }

  // we need to create a new and empty one
  const map = createMerkleMap(options);
  cacheOn && Pool.set(guid, map);
  return map;
}

/**
 * Factory: creates a new Merkle of the given size.
 * @param size "small | medium | big"
 * @returns AnyMerkleMap
 */
function createMerkleMap(options?: string): AnyMerkleMap {
  if (options?.includes('small')) 
    return new SmallMerkleMap() as AnyMerkleMap;
  if (options?.includes('medium')) 
    return new MediumMerkleMap() as AnyMerkleMap;
  if (options?.includes('big')) 
    return new BigMerkleMap() as AnyMerkleMap;
  // default
  return new SmallMerkleMap() as AnyMerkleMap; 
}  

/**
 * Saves the Merkle to storage.
 * @param guid 
 * @param map 
 */
function saveMerkle(guid: string, map: AnyMerkleMap) {
  let serialized = serializeMap(map as AnyMerkleMap);
  let type = (map instanceof BigMerkleMap) ? 'big'
    : (map instanceof MediumMerkleMap) ? 'medium'
    : (map instanceof SmallMerkleMap) ? 'small' 
    : 'small';
  KVS.put(guid, {
    guid: guid,
    type: type,
    size: map?.length.toString(),
    root: map?.root.toString(),
    json: serialized,
    updatedUTC: (new Date()).toISOString()
  })
}

/**
 * Removes the Merkle from the cache, if it is there.
 * Otherwise does nothing at all.
 */
function releaseMerkle(guid: string) {
  if (!guid) 
    throw Error(`releaseMerkle requires a 'guid' param`);
  if (Pool.has(guid)) Pool.delete(guid);
}

/**
 * Serializes to JSON a IndexedMerkleMap.
 * Credits: DFSTIO (Mikhail)
 * https://github.com/zkcloudworker/zkcloudworker-tests/blob/main/tests/indexed.map.test.ts
 * @param map the MerkleMap to serialize
 * @returns the serialized JSON string
 */
function serializeMap(map: AnyMerkleMap): string {
  const snapshot = map.clone();
  //console.log("root map1:", map.root.toJSON());
  //console.log("root map2:", snapshot.root.toJSON());
  const serializedMap = JSON.stringify(
    {
      root: snapshot.root.toJSON(),
      length: snapshot.length.toJSON(),
      nodes: JSON.stringify(snapshot.data.get().nodes, (_, v) =>
        typeof v === "bigint" ? "n" + bigintToBase64(v) : v
      ),
      sortedLeaves: JSON.stringify(
        snapshot.data
          .get()
          .sortedLeaves.map((v) => [
            bigintToBase64(v.key),
            bigintToBase64(v.nextKey),
            bigintToBase64(v.value),
            bigintToBase64(BigInt(v.index)),
          ])
      ),
    },
    null,
    2
  );
  // console.log("serializedMap:", serializedMap);
  return serializedMap;
}

/**
 * Deserializes from JSON to an IndexedMerkleMap.
 * Credits: DFSTIO (Mikhail)
 * https://github.com/zkcloudworker/zkcloudworker-tests/blob/main/tests/indexed.map.test.ts
 * @param serialized 
 */
function deserializeMap(serialized: string, type?: string): AnyMerkleMap {
  const json = JSON.parse(serialized);
  const nodes = JSON.parse(json.nodes, (_, v) => {
    // Check if the value is a string that represents a BigInt
    if (typeof v === "string" && v[0] === "n") {
      // Remove the first 'n' and convert the string to a BigInt
      return bigintFromBase64(v.slice(1));
    }
    return v;
  });
  const sortedLeaves = JSON.parse(json.sortedLeaves).map((row: any) => {
    return {
      key: bigintFromBase64(row[0]),
      nextKey: bigintFromBase64(row[1]),
      value: bigintFromBase64(row[2]),
      index: Number(bigintFromBase64(row[3])),
    };
  });
  //console.log("data:", data);
  const restoredMap = createMerkleMap(type); 
  restoredMap.root = Field.fromJSON(json.root);
  restoredMap.length = Field.fromJSON(json.length);
  restoredMap.data.updateAsProver(() => {
    return {
      nodes: nodes.map((row: any) => [...row]),
      sortedLeaves: [...sortedLeaves],
    };
  });
  // console.log("root restored:", restoredMap.root.toJSON());
  return restoredMap;
}

/**
 * Traverse the map and get the keys sorted.
 * We need this to get all the identity commitments in the group.
 * @param map 
 * @returns the array of sorted keys in the map
 */
function getSortedKeys(map: AnyMerkleMap): string[] {
  // traverse the sorted nodes
  const sortedLeaves = map.data.get().sortedLeaves; 
  const sortedKeys = sortedLeaves?.map((t) => {
    // { key, value, nextKey, index }
    // console.log(j, t.index, t.key, t.value)
    return t.key.toString();
  })
  // filter key==0 as it is not part of the real set
  return sortedKeys.filter((t) => t !== '0');
}
