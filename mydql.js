const mysql = (await import("mysql")).default;

import { createRequire } from "module";
const require = createRequire(import.meta.url)
const env = require("$/server/env.json")


const mysql_configuration = env.db.mysql;

// if(process.platform == 'linux'){
//     mysql_configuration.socketPath = undefined
// }

const pool = mysql.createPool(mysql_configuration);

export default {
    pool,
};
