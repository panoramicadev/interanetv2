try {
  const { db } = require('./server/db');
  console.log("DB INITED");
} catch(err) {
  console.error("INIT ERROR", err);
}
