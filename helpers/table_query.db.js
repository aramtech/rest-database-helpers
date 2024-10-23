// database helpers
const pg = (await import("$/server/database/helpers/paginate.db.js")).default;
const filter = (await import("$/server/database/helpers/Filter/filter.db.js")).default;
const orderby = (await import("$/server/database/helpers/orderby.db.js")).default;
const sg = (await import("$/server/database/helpers/search_generator.db.js")).default;
const env = (await import("$/server/env.js")).default;

export default async (table, query_body) => {
    return new Promise(async (resolve, reject) => {
        try {
            // search term
            let search_term = "";
            if (query_body?.search_fields.length > 0) {
                search_term = sg(query_body.search_fields, query_body);
            }

            // filter term
            const filter_term = await filter(query_body);

            // deleted term
            let deleted_term = " ( deleted = 0 ) ";
            if (query_body?.deleted === 1) {
                deleted_term = ` ( deleted = 1 ) `;
            } else if (query_body?.deleted === -1) {
                deleted_term = "";
            }

            // where term
            const terms = [];
            if (search_term) {
                terms.push(search_term);
            }
            if (filter_term) {
                terms.push(filter_term);
            }
            if (deleted_term) {
                terms.push(deleted_term);
            }
            const where_term = terms.length > 0 ? ` where ${terms.join(" and ")} ` : "";

            // sort term
            const order_term = orderby(query_body);

            // full query
            const selected_fields = query_body.selected_fields;
            const full_select_query = `
            \nselect ${
                selected_fields?.length > 0 && !query_body.fetch_all ? selected_fields.map((el) => `output_table.${el}`).join(",\n ") : "*"
            } \nfrom ${table} as output_table
            \n${where_term} \n${order_term} 
        `;

            // pagination paramters
            const page = query_body?.page ? query_body.page : 1;
            const n_per_page = query_body?.n_per_page ? query_body.n_per_page : -1;
            // pagination query
            pg(full_select_query, n_per_page, page)
                .then((result) => {
                    resolve(result);
                })
                .catch((error) => {
                    reject(error);
                });
        } catch (error) {
            reject({ error: { err: error, msg: "server error", name: "table query error" }, status_code: env.response.status_codes.server_error });
        }
    });
};
