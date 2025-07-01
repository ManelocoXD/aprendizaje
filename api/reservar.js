import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const { nombre, personas, hora, fecha } = req.body;

  if (!nombre || !personas || !hora || !fecha) {
    return res.status(400).send("Faltan datos obligatorios");
  }

  try {
    await db.execute(
      "INSERT INTO reservas (nombre, personas, hora, fecha) VALUES (?, ?, ?, ?)",
      [nombre, personas, hora, fecha]
    );
    res.status(200).send("Reserva guardada");
  } catch (err) {
    console.error("Error al guardar reserva:", err);
    res.status(500).send("Error en la base de datos");
  }
}
