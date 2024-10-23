const eq = (await import("$/server/database/helpers/exists.db.js")).default;

export default async (filter) => {
    if (!filter.values?.city) {
        return "";
    }
    let city = await eq.one("cities", "name", filter.values.city);
    if (!city) {
        return "";
    }
    /**
     * @type {*}
     */
    let region = "";
    if (filter.values?.region) {
        region = await eq.one("regions", [
            ["name", filter.values.region],
            ["city_id", city.city_id],
        ]);
    }
    if (region) {
        return `( region_id = '${region.region_id}' )`;
    } else if (city) {
        return `( city_id = '${city.city_id}' )`;
    } else {
        return "";
    }
};
