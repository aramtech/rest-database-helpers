import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const normalizedPath = __dirname;
const database_helpers = (await import("fs")).default.readdirSync(normalizedPath).forEach(async function (file) {
    let index = file.indexOf(".db.js");
    if (index != -1) {
        database_helpers[file.slice(0, index)] = (await import(`./${file}`)).default;
    }
});

export default database_helpers;
