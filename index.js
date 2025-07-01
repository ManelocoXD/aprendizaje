const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la base de datos
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos MySQL');
});

// Insertar reserva
app.post('/reservar', (req, res) => {
  const { nombre, personas, hora, fecha } = req.body;
  if (!nombre || !personas || !hora || !fecha) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  db.query(
    'INSERT INTO reservas (nombre, personas, hora, fecha) VALUES (?, ?, ?, ?)',
    [nombre, personas, hora, fecha],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al guardar reserva');
      }
      res.send('Reserva guardada');
    }
  );
});

// Obtener reservas
app.get('/reservas', (req, res) => {
  db.query('SELECT * FROM reservas ORDER BY fecha, hora', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al obtener reservas');
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log('Servidor escuchando en https://aprendizaje-q0q8.onrender.com/reservar');
});