import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default async function handler(req, res) {
  try {
    const [result] = await db.query("SELECT * FROM reservas ORDER BY fecha, hora");
    res.status(200).json(result);
  } catch (err) {
    console.error("Error al obtener reservas:", err);
    res.status(500).send("Error en la base de datos");
  }
}
