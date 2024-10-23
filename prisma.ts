import { Prisma, PrismaClient } from "$/prisma/client/index.js";
import { cap } from "$/server/utils/common/index.js";
import cluster from "cluster";
import fs from "fs";
import path from "path";
import { createPrismaRedisCache } from "prisma-redis-middleware";
import db_models from "../dynamic_configuration/db_models.js";
import { src_path } from "../utils/cli/utils/src_path/index.js";

const utils_path = path.join(src_path, "/utils");
const client = new PrismaClient({ errorFormat: "minimal" });

const cache = createPrismaRedisCache({
    storage: { type: "memory", options: { invalidation: true } },
    cacheTime: 20,
});
const scans = new Map<
    string,
    {
        count: number;
        specific_fingerprint: string;
        time: Date;
    }
>();

// To prevent memory leaks we clear the cache scans tracker
setInterval(() => {
    const now = new Date();

    for (const [key, val] of scans) {
        if (now.valueOf() - val.time.valueOf() >= 600_000) {
            scans.delete(key);
        }
    }
}, 600_000);

const set_default = (specific_fingerprint: string) => {
    scans.set(specific_fingerprint, {
        specific_fingerprint,
        time: new Date(),
        count: 0,
    });
};
client.$use(async (params, next) => {
    if (params.action !== "findFirst" && params.action !== "findMany" && params.action !== "findUnique") {
        return cache(params, next);
    }

    const { now, fingerprint, ...args } = params.args || {};

    if (now || !fingerprint) {
        return next({ ...params, args });
    } else {
        let specific_fingerprint: null | string = null;
        specific_fingerprint = `${fingerprint}${params?.action}${params?.model}`;

        const now = new Date();

        let scan_info = scans.get(specific_fingerprint);
        if (!scan_info) {
            scan_info = { count: 0, specific_fingerprint, time: new Date() };
        }

        let updated_info = { ...scan_info, count: scan_info.count + 1 };
        if (now.valueOf() - updated_info.time.valueOf() <= 4_000 && updated_info.count >= 3) {
            set_default(specific_fingerprint);
            return next({ ...params, args });
        }

        updated_info = { ...updated_info, time: new Date() };

        scans.set(specific_fingerprint, updated_info);
    }

    return cache({ ...params, args }, next);
});

export type Client = any;

const env = (await import("$/server/env.js")).default;

// on find check deleted
client.$use(async (params, next) => {
    if (params.args == undefined) {
        params.args = {};
    }
    if (params.action == "findUnique" || params.action == "findFirst") {
        params.action = "findFirst";
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where.deleted === undefined) {
            params.args.where["deleted"] = false;
        }
    } else if (params.action == "findMany") {
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where.deleted === undefined) {
            params.args.where["deleted"] = false;
        }
    }
    return next(params);
});

// if updateMany check deleted flag
// remember that you cant set update since it only take id in where
client.$use(async (params, next) => {
    if (params.args === undefined) {
        params.args = {};
    }
    if (params.action == "updateMany") {
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where["deleted"] === undefined) {
            params.args.where["deleted"] = false;
        }
    }
    return next(params);
});

// on delete change action to update or update many
client.$use(async (params, next) => {
    if (params.args === undefined) {
        params.args = {};
    }
    // Check incoming query type
    if (params.action == "delete") {
        // Delete queries
        // Change action to an update
        params.action = "update";
        if (params.args.data != undefined) {
            params.args.data["deleted"] = true;
        } else {
            params.args["data"] = { deleted: true };
        }
    }
    if (params.action == "deleteMany") {
        // Delete many queries
        params.action = "updateMany";
        if (params.args.data != undefined) {
            params.args.data["deleted"] = true;
        } else {
            params.args["data"] = { deleted: true };
        }
    }
    return next(params);
});

if (cluster.isPrimary && process.env.NODE_ENV !== "test") {
    await db_models.set("db", "models", {});

    const models: string[] = [];
    const cap_models: string[] = [];
    for (const model in client) {
        if (typeof client[model] == "object" && !!client[model].findFirst) {
            await db_models.set("db.models", model, model);
            models.push(model);
            cap_models.push(cap(model));
        }
    }

    await db_models.set("db", "models_array", models);
    await db_models.set("db", "cap_models_array", cap_models);

    fs.writeFileSync(
        `${utils_path}/JsDoc/assets/models.js`,
        `

/**
 * @typedef {${Object.keys(db_models.db.models)
     .map((el) => `"${el}"`)
     .join("|")}} Model
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utils_path}/JsDoc/assets/where.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Where
${Object.keys(db_models.db.models)
    .map((el) => ` * @property {Prisma.${el}WhereInput} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );

    let preFindOrCreate: string[] = [];
    const findOrCreate: string[] = [];
    for (const model in client) {
        if (!!client[model] && client[model].findFirst) {
            preFindOrCreate.push(
                `
    /**
     * @callback [model]FindOrCreate
     * @param {{
     *      where: Prisma.[model]WhereInput, 
     *      create: Prisma.[model]CreateInput,
     * }} options - options
     * @returns {[model]} - created or found object
     */

`.replaceAll("[model]", model),
            );
            findOrCreate.push(`${model}:{ findOrCreate:${model}FindOrCreate }`);
        }
    }

    fs.writeFileSync(
        `${utils_path}/JsDoc/assets/findOrCreate.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

${preFindOrCreate.join("\n")}

/**
 * @typedef {{${findOrCreate.join(",")}}} FindOrCreateExtension
 * 
 * 
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utils_path}/JsDoc/assets/include.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Include
${Object.keys(db_models.db.models)
    .map((el) => ` * @property {Prisma.${el}Include} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utils_path}/JsDoc/assets/select.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Select
${Object.keys(db_models.db.models)
    .map((el) => ` * @property {Prisma.${el}Select} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );
}

type CacheStrategy =
    | {
          now?: boolean;
          fingerprint?: string;
      }
    | undefined
    | null;

const extended_client = client
    .$extends({
        query: {
            $allModels: {
                async findFirst({ model, operation, args, query }) {
                    args.orderBy = args.orderBy || {
                        created_at: "desc",
                    };
                    return await query(args);
                },

                async findMany({ model, operation, args, query }) {
                    args.orderBy = args.orderBy || {
                        created_at: "desc",
                    };

                    return await query(args);
                },
            },
        },
    })
    .$extends({
        name: "BaseExtension",
        model: {
            $allModels: {
                findFirst<T, A>(
                    this: T,
                    args: Prisma.Exact<A, Prisma.Args<T, "findFirst"> & CacheStrategy>,
                ): Promise<Prisma.Result<T, A, "findFirst">> {
                    const ctx = Prisma.getExtensionContext(this);
                    const model = (ctx.$parent as any)[ctx.$name as any];
                    return model.findFirst(args);
                },
                findMany<T, A>(
                    this: T,
                    args: Prisma.Exact<A, Prisma.Args<T, "findMany"> & CacheStrategy>,
                ): Promise<Prisma.Result<T, A, "findMany">> {
                    const ctx = Prisma.getExtensionContext(this);
                    const model = (ctx.$parent as any)[ctx.$name as any];
                    return model.findMany(args);
                },
                findUnique<T, A>(
                    this: T,
                    args: Prisma.Exact<A, Prisma.Args<T, "findUnique"> & CacheStrategy>,
                ): Promise<Prisma.Result<T, A, "findUnique">> {
                    const ctx = Prisma.getExtensionContext(this);
                    const model = (ctx.$parent as any)[ctx.$name as any];
                    return model.findUnique(args);
                },
                async findOrCreate<T, A>(
                    this: T,
                    args: Prisma.Exact<A, Prisma.Args<T, "findFirst">> & Prisma.Exact<A, Prisma.Args<T, "create">>,
                ): Promise<Prisma.Result<T, A, "create">> {
                    const ctx = Prisma.getExtensionContext(this);
                    const model = (ctx.$parent as any)[ctx.$name as any];
                    const result = await model.findFirst({
                        where: (args as any).where,
                        include: (args as any).include,
                        select: (args as any).select,
                    });
                    if (result) {
                        return result;
                    } else {
                        const result = await model.create({
                            data: (args as any).data,
                            include: (args as any).include,
                            select: (args as any).select,
                        });
                        return result;
                    }
                },
            },
        },
    });

await extended_client.$connect();
export default extended_client;
