const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end("Método no permitido");

  try {
    const [rows] = await db.query("SELECT * FROM reservas ORDER BY fecha, hora");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error al obtener reservas:", err);
    res.status(500).send("Error al obtener reservas");
  }
};
