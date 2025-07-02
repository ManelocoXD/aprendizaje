import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default async function handler(req, res) {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    res.status(200).json({ success: true, result: rows[0].result });
  } catch (err) {
    console.error("Error al conectar a la base de datos:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}