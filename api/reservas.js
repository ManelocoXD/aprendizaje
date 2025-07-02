import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default async function handler(req, res) {
  const connection = await mysql.createConnection(dbConfig);

  if (req.method === 'GET') {
    try {
      const [rows] = await connection.execute('SELECT * FROM reservas ORDER BY fecha, hora');
      res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al obtener reservas');
    } finally {
      await connection.end();
    }
  }

  if (req.method === 'POST') {
    const { nombre, telefono, personas, hora, fecha } = req.body;

    if (!nombre || !telefono || !personas || !hora || !fecha) {
      return res.status(400).send('Faltan datos');
    }

    try {
      await connection.execute(
        'INSERT INTO reservas (nombre, telefono, personas, hora, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, telefono, personas, hora, fecha,]
      );
      res.status(200).send('Reserva guardada correctamente');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al guardar la reserva');
    } finally {
      await connection.end();
    }
  }
}