export default (filter) => {
    if (!filter.values?.field) {
        return "";
    }
    let start = filter.values?.start || "";
    let end = filter.values?.end || "";
    if (start && end) {
        return `( ${filter.values.field} between '${start}' and '${end}' )`;
    } else if (start) {
        return `( ${filter.values.field} >= '${start}' )`;
    } else if (end) {
        return `( ${filter.values.field} <= '${end}' )`;
    } else {
        return "";
    }
};
