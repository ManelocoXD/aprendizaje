const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = async (req, res) => {
  if (req.method !== "DELETE") return res.status(405).end("Método no permitido");

  const id = req.query.id;
  if (!id) return res.status(400).send("Falta el ID");

  try {
    await db.execute("DELETE FROM reservas WHERE id = ?", [id]);
    res.status(200).send("Reserva eliminada");
  } catch (err) {
    console.error("Error al eliminar reserva:", err);
    res.status(500).send("Error al eliminar reserva");
  }
};
