export default (fields, query_body) => {
    if (!query_body?.search) {
        return "";
    }
    const response = [];
    for (const field of fields) {
        response.push(`${field} like "%${query_body.search}%"`);
    }
    if (response.length == 0) {
        return "";
    } else {
        return ` ( ${response.join(" or ")} ) `;
    }
};
