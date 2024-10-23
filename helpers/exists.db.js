const env = (await import("$/server/env.js")).default;
const pq = (await import("./promise_query.db.js")).default;
const one = async function (table, field, value) {
    if (arguments.length == 3) {
        const query = `select * from ${table} where ${field} = '${value}' and deleted = 0 limit 1`;
        let val = (await pq(query))[0];
        if (!val) {
            return false;
        } else {
            return val;
        }
    } else if (arguments.length == 2) {
        const conditions_array = [];
        for (const condition of arguments[1]) {
            conditions_array.push(` ${condition[0]} = '${condition[1]}' `);
        }
        const conditions_string = conditions_array.join(" and ");
        const query = `select * from ${table} where ${conditions_string} and deleted = 0 limit 1`;
        let val = (await pq(query))[0];
        if (!val) {
            return false;
        } else {
            return val;
        }
    } else {
        throw { error: { msg: "Invalid argument in existance query validation utility" }, status_code: env.response.status_codes.server_error };
    }
};

const validate_one = async (table, field, value) => {
    let val;
    if (!value) {
        val = await one(table, field);
    } else {
        val = await one(table, field, value);
    }
    if (!val) {
        throw { error: { msg: `${field} ${value} not found` }, status_code: env.response.status_codes.not_found };
    } else {
        return val;
    }
};

const valdiate_arr = async (table, field, values) => {
    for (const val of values || []) {
        await validate_one(table, field, val);
    }
};

export default {
    one,
    validate_one,
    valdiate_arr,
};
