// @ts-nocheck

import fs from "fs";
import path from "path";

import URL from "url";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const env = require("../env.json")

import logger from "../utils/cli/logger.js";

const app_path = path.resolve(path.join(path.dirname(URL.fileURLToPath(import.meta.url)), "../../."));
const utils_path = path.resolve(path.join(path.dirname(URL.fileURLToPath(import.meta.url)), "../utils/."));

const raw_schema = fs.readFileSync(path.join(app_path, "prisma", "schema.prisma"), "utf-8");

const generator = raw_schema.match(/(\s*?generator\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/i);
const datasource = raw_schema.match(/(\s*?datasource\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/i);

const models = [...raw_schema.matchAll(/\n(\s*?model\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/gi)];
const models_names = models.map((m) => {
    console.log(m[2]);
    return m[2];
});
const enums = [...raw_schema.matchAll(/\n(\s*?enum\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?\})/gi)];
const default_model_addition = `
    created_by_user_id         Int?        @db.UnsignedInt
    created_by_user_username   String?     @db.VarChar(255)
    created_by_user_full_name  String?     @db.VarChar(255)
    updated_by_user_id         Int?        @db.UnsignedInt
    updated_by_user_username   String?     @db.VarChar(255)
    updated_by_user_full_name  String?     @db.VarChar(255)
    created_at                 DateTime?   @default(now()) @db.Timestamp(0)
    updated_at                 DateTime?   @updatedAt
    deleted                    Boolean?    @default(false)
    created_by_user            users?      @relation("[clampedmodel]_created_by_userTousers", fields: [created_by_user_id], references: [user_id], onDelete: SetNull, onUpdate: NoAction)
    updated_by_user            users?      @relation("[clampedmodel]_updated_by_userTousers", fields: [updated_by_user_id], references: [user_id], onDelete: SetNull, onUpdate: NoAction)
    @@index([created_by_user_id], map: "created_by_user_id")
    @@index([updated_by_user_id], map: "updated_by_user_id")
    @@index([deleted], map: "deleted_index")
`;
const users_created_updated_relations = `
    created_[model] [model][] @relation("[clampedmodel]_created_by_userTousers")
    updated_[model] [model][] @relation("[clampedmodel]_updated_by_userTousers")
`;
const full_models = [];
const user_model_additions = [];

for (const model of models.filter((el) => el[2] != "users")) {
    console.log("building Main model for: ", model[2]);

    full_models.push(`
   
${
    model[1]
    // .replaceAll(/(?<=\@\@index\(\s*?\[.*?)\](?!.*?map)/gi, function (match) {

    //     return `], map: "__index_${model[2]}_"`
    // })
}
    
    ${default_model_addition.replaceAll("[model]", model[2]).replaceAll("[clampedmodel]", model[2]).replaceAll("[random]", `${model[2]}`)}   

}
    `);

    user_model_additions.push(users_created_updated_relations.replaceAll("[model]", model[2]).replaceAll("[clampedmodel]", model[2]));
}

const user_model = models.find((m) => m[2] == "users");

user_model_additions.push(users_created_updated_relations.replaceAll("[model]", user_model[2]).replaceAll("[clampedmodel]", user_model[2]));

full_models.push(`

${user_model[1]}

    ${default_model_addition.replaceAll("[model]", user_model[2]).replaceAll("[clampedmodel]", user_model[2])}   

    ${user_model_additions.join("\n\n")}
}
`);

fs.writeFileSync(
    path.join(app_path, "prisma", "main_schema.prisma"),
    `
    ${generator[0].replace(/(?<=output.*?\").*?(?=\")/, `../${env.db.orm.config.client_dist}`)}

    ${datasource[0].replace(
        /(?<=url.*?\").*?(?=\")/,
        `mysql://${env.db.mysql.user}:${env.db.mysql.password}@${env.db.mysql.host}:${env.db.mysql.port}/${env.db.mysql.database}`,
    )}

    ${enums.map((el) => el[0]).join("\n")}

    ${full_models.join("\n")}

`,
);

const models_jsdoc_path = `${utils_path}/JsDoc/assets/models.js`;
fs.mkdirSync(path.dirname(models_jsdoc_path), {
    recursive: true,
});
fs.writeFileSync(
    models_jsdoc_path,
    `

/**
 * @typedef {${models_names.map((el) => `"${el}"`).join("|")}} Model
 * 
 */
export default {}
`,
);

logger.success("Generated Main Schema Successfully!!");
