const db = (await import("$/server/database/mydql.js")).default;

export default (query) => {
    return new Promise((resolve, reject) => {
        db.pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }
            connection.query(query, (err, result) => {
                if (err) {
                    connection.release();
                    return reject(err);
                }
                connection.release();
                return resolve(result);
            });
        });
    });
};
