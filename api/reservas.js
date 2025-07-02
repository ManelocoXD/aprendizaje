// /api/reservas.js
const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const [rows] = await db.query("SELECT * FROM reservas ORDER BY fecha, hora");
      res.status(200).json(rows);
    } catch (err) {
      console.error("Error al obtener reservas:", err);
      res.status(500).send("Error al obtener reservas");
    }
  }

  else if (req.method === "POST") {
    const { nombre, telefono, personas, hora, fecha } = req.body;

    if (!nombre || !telefono || !personas || !hora || !fecha) {
      return res.status(400).send("Faltan datos");
    }

    try {
      await db.execute(
        "INSERT INTO reservas (nombre, telefono, personas, hora, fecha, estado) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, telefono, personas, hora, fecha, "pendiente"]
      );
      res.status(200).send("Reserva guardada correctamente");
    } catch (err) {
      console.error("Error al guardar la reserva:", err);
      res.status(500).send("Error al guardar la reserva");
    }
  }

  else {
    res.status(405).send("Método no permitido");
  }
};
