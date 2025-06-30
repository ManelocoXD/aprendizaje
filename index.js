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
const db = mysql.createConnection({
  host: 'btbn32pgv8nw8oj4llq0-mysql.services.clever-cloud.com',
  user: 'ulvkzoepxs27anjn',
  password: 'qR7tInn5sq9IFrWBjB9H',       // Cambia si tienes otra contraseña
  database: 'btbn32pgv8nw8oj4llq0' // Asegúrate que esta base existe y tiene tabla reservas
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
  console.log('Servidor escuchando en http://localhost:3000');
});