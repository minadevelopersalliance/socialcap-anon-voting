import 'dotenv/config';
import { KVS } from "../src/services/lmdb-kvs.js";

function main(args: string[]) {
  let prefix: string | undefined = (args.length) ? args[0] : undefined;
  KVS.browseKeys(prefix);
}

main(process.argv.slice(2));