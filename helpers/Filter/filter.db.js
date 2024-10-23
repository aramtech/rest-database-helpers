// @ts-nocheck
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const normalizedPath = (await import("path")).default.join(__dirname, "filter_handlers");
const filter_handlers = {};
import fs from "fs";
fs.readdirSync(normalizedPath).forEach(async function (file) {
    let index = file.indexOf(".filter_handler.js");
    if (index != -1) {
        filter_handlers[file.slice(0, index)] = (await import(`./filter_handlers/${file}`)).default;
    }
});
export default async (query_body) => {
    if (!query_body?.filters) {
        return "";
    }
    const filters = query_body.filters;
    const response = [];
    for (const key in filters) {
        const filter = key?.match(/([a-zA-Z_]*)\d?$/)?.[1];
        if (Object.hasOwnProperty.call(filter_handlers, filter)) {
            let query_condition = await filter_handlers[filter](filters[key]);
            if (query_condition) {
                response.push(query_condition);
            }
        } else {
            console.log("Filter ", filter, "not fount");
        }
    }

    if (response.length > 1) {
        return " ( " + response.join(" and ") + " ) ";
    } else if (response.length == 1) {
        return " " + response.join(" and ") + " ";
    } else {
        return "";
    }
};
