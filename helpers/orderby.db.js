export default (query_body) => {
    return query_body?.order_by?.[0] ? ` order by ${query_body.order_by[0]} ${query_body["asc"] ? "asc" : "desc"} ` : "";
};
