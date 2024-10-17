/**
 * A LMDB KeyValue store for saving Merkle maps.
*/
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import { open } from "lmdb" ;

export { KVS }

class KVS {
  private static _DB: any = null;

  public static get(key: string): any | null {
    const db = KVS.openDb();
    const data = db.get(key) || null;
    return data;
  }
  
  public static put(key: string, data: any) {
    const db = KVS.openDb();
    db.transaction(() => {
      db.put(key, data);
    });
  }

  private static openDb(options?: string) {
    if (KVS._DB) return KVS._DB;
    console.log(`Open KVStore path='${process.env.LMDB_PATH}'`)
    try {
      const db = open({
        path: process.env.LMDB_PATH,
        // any options go here
        encoding: 'msgpack',
        sharedStructuresKey: Symbol.for('sharedstructures'),
        cache: true,
        // compression: true,
      });
      KVS._DB = db;
    }
    catch (err) {
      console.log(err);
      KVS._DB = null;
      throw Error(`ERROR opening KVStore path:'${process.env.LMDB_PATH}' reason:'${err}'`);
    }
    return KVS._DB;
  }

  public static async find(q: string) {
    const db = KVS.openDb();
    if (!q) throw Error("KVS.find requires a search word.")
    let found: any[] = [];
    db.getRange()
      .filter((t: any) => q && t.key.includes(q))
      .forEach((t: any) => {
        found.push(t)
      })
    return found;  
  }

  public static async browseKeys(q: string | undefined) {
    console.log(`\n---\nBrowse LMDB`);
    const db = KVS.openDb("console_log");
    console.log(`Search ${q ? `keys containing: '${q}'` : 'all keys'}`)
    db.getRange()
      .filter((t: any) => (q ? t.key.includes(q) : true ))
      .forEach((t: any) => {
        console.log(`\n${t.key}: `, JSON.stringify(t.value, null, 2));
      })
  }
}
