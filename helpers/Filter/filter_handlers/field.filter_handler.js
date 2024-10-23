const pq = (await import("$/server/database/helpers/promise_query.db.js")).default;
export default async (filter) => {
    if (!filter.values?.filter?.field_values?.length) {
        return "";
    }
    const filter_list = (
        await pq(`
        select ${filter.values.filter.target_foreign_key} from ${filter.values.filter.table} where ${
            filter.values.filter.field
        } in ( '${filter.values.filter.field_values.join("', '")}' )
    `)
    ).map((el) => el[filter.values.filter.target_foreign_key]);
    const condiction = ` ( ${filter.values.filter.target_local_key} in ( '${filter_list.join("', '")}' ) ) `;
    return condiction;
};
