export default (filter) => {
    if (!filter.values) {
        return "";
    }
    let start = filter.values?.start || "";
    let end = filter.values?.end || "";
    if (start && end) {
        return `( updated_at between '${start}' and '${end}' )`;
    } else if (start) {
        return `( updated_at > '${start}' )`;
    } else if (end) {
        return `( updated_at < '${end}' )`;
    } else {
        return "";
    }
};
