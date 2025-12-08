const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=5530-WIN11;Database=UMS_DB;Trusted_Connection=Yes;Encrypt=no;TrustServerCertificate=yes;',
  driver: 'msnodesqlv8'
};

async function connectToDB() {
  try {
    const pool = await sql.connect(config);
    console.log('✅ MSSQL Connected to 5530-WIN11');
    return pool;
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
    throw err;
  }
}

module.exports = { connectToDB, sql };