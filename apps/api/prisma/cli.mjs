import {config} from 'dotenv';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
config({path:new URL('../../../.env',import.meta.url),quiet:true});
const require=createRequire(import.meta.url);
const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...process.argv.slice(2)],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
