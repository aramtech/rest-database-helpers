import fs from "fs";
import path from "path";

import URL from "url";
const app_path = path.resolve(path.join(path.dirname(URL.fileURLToPath(import.meta.url)), "../../."));

async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replaceAll(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replaceAll(regex, () => {
        return data.shift();
    });
}

const main_schema = fs.readFileSync(path.join(app_path, "prisma", "main_schema.prisma"), "utf-8");

const models = main_schema.matchAll(/(?<=\n\s*?model\s*)(.*?)(?=\s*?\{)/g);
let bin_schema = main_schema;
for (const model of models) {
    console.log("building trash bin model for: ", model[0]);
    const expression = new RegExp(`(?<=\\w+?\\s+?)\\b${model[0].trim()}\\b`, "gi");
    bin_schema = await replaceAsync(bin_schema, expression, async function () {
        return ` trash_bin_for_${arguments[0].trim()}`;
    });
}

bin_schema = await replaceAsync(bin_schema, /(?<=\bmap\b:\s*?")(.*?)(?=")/g, async function () {
    if (arguments[0].includes("bfk")) {
        return `trash_bin_${arguments[0]}`;
    } else {
        return arguments[0];
    }
});

let j = 0;
const relations = {};

bin_schema = await replaceAsync(bin_schema, /(?<=\@relation\(\s*?\")(.*?)(?=\")/g, function (match, relation_name) {
    j += 1;
    const new_relation_name = `${relation_name}${j}`;
    if (!relations[relation_name]) {
        relations[relation_name] = new_relation_name;
    }

    return relations[relation_name];
});

relations.splice;
bin_schema = await replaceAsync(bin_schema, /(?<=\@relation\(\s*?\")(.*?)(\".*?)(\)\s*?\n)/g, function (match, relation_name, rest, end) {
    j += 1;
    if (rest.includes("map") || !rest.includes("reference")) {
        return match;
    }

    const new_relation_name = relation_name;

    return `${new_relation_name}${rest}, map:"relation___${j}"${end}`;
});
let i = 0;
bin_schema = await replaceAsync(bin_schema, /(?<=\@\@index\(\s*?\[.*?)\](?!.*?map)/gi, function (match) {
    i += 1;
    return `], map: "__index_${Math.floor(i)}"`;
});

const full_schema = `
  ${main_schema}

  ${bin_schema.slice(bin_schema.indexOf("model"))}

`;

fs.writeFileSync(path.join(app_path, "prisma", "bin_schema.prisma"), bin_schema);

fs.writeFileSync(path.join(app_path, "prisma", "full_schema.prisma"), full_schema);
