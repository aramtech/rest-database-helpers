const db = (await import("$/server/database/mydql.js")).default;

/**
 *  returns boolean that represent if the value unique or not
 *
 *   @param {String} table name of the table
 *   @param {String} field field name
 *   @param {String} value value that expected to be unique
 *
 *   @returns {Promise<Boolean>} Boolean whether its unique or not
 */
export default (table, field, value) => {
    return new Promise((resolve, reject) => {
        db.pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }
            const query = `
                SELECT * FROM ${table} WHERE ${field} = '${value}' limit 1;
            `;
            connection.query(query, (err, result) => {
                if (err) {
                    connection.release();
                    return reject(err);
                }
                connection.release();
                if (result.length == 0) {
                    return resolve(true);
                }
                resolve(false);
            });
        });
    });
};
