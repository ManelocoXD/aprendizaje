const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const { nombre, telefono, personas, hora, fecha } = req.body;

  if (!nombre || !telefono || !personas || !hora || !fecha) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    await db.execute(
      "INSERT INTO reservas (nombre, telefono, personas, hora, fecha, estado) VALUES (?, ?, ?, ?, ?, ?)",
      [nombre, telefono, personas, hora, fecha, "pendiente"]
    );
    res.status(200).send("Reserva guardada");
  } catch (err) {
    console.error("Error al guardar reserva:", err);
    res.status(500).send("Error en la base de datos");
  }
};
