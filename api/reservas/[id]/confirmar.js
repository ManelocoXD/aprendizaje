const mysql = require("mysql2/promise");
const twilio = require("twilio");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const id = req.query.id;
  if (!id) return res.status(400).send("Falta el ID");

  try {
    await db.execute("UPDATE reservas SET estado = 'confirmada' WHERE id = ?", [id]);

    const [rows] = await db.query("SELECT telefono FROM reservas WHERE id = ?", [id]);
    if (rows[0]?.telefono) {
      await client.messages.create({
        body: "Tu reserva ha sido confirmada. ¡Gracias por reservar!",
        from: process.env.TWILIO_FROM,
        to: "+34" + rows[0].telefono,
      });
    }

    res.status(200).send("Reserva confirmada");
  } catch (err) {
    console.error("Error al confirmar reserva:", err);
    res.status(500).send("Error al confirmar reserva");
  }
};
