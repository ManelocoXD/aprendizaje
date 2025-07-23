const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

const accountSid = 'AC0b6c2e5167cfadf5e065b8656e66daa7';
const authToken = 'f112aad0335ad5cb201b21205809f53b';
const twilioNumber = '+19473334306';
const twilioClient = twilio(accountSid, authToken);

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

// Confirmar reserva
app.post('/reservas/:id/confirmar', (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM reservas WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).send('Reserva no encontrada');

    const reserva = results[0];
    console.log('Fecha original reserva confirmar:', reserva.fecha);
    const fechaFormateada = formatearFecha(reserva.fecha);
    const mensaje = `Hola ${reserva.nombre} tu reserva para el ${fechaFormateada} a las ${reserva.hora}h ha sido confirmada.`;

    db.query('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [id], (err2) => {
      if (err2) return res.status(500).send('Error al confirmar reserva');

      twilioClient.messages.create({
        body: mensaje,
        from: twilioNumber,
        to: reserva.telefono
      }).then(() => {
        res.send('Reserva confirmada y SMS enviado');
      }).catch((smsErr) => {
        console.error('Error al enviar SMS:', smsErr.message);
        res.status(500).send('Reserva confirmada pero error al enviar SMS');
      });
    });
  });
});

// Denegar y eliminar reserva
app.delete('/reservas/:id/denegar', (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM reservas WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).send('Reserva no encontrada');

    const reserva = results[0];
    console.log('Fecha original reserva denegar:', reserva.fecha);
    const fechaFormateada = formatearFecha(reserva.fecha);
    const mensaje = `Hola ${reserva.nombre}, lamentamos informarte que tu reserva para el ${fechaFormateada} a las ${reserva.hora} ha sido denegada.`;

    twilioClient.messages.create({
      body: mensaje,
      from: twilioNumber,
      to: reserva.telefono
    }).then(() => {
      db.query('DELETE FROM reservas WHERE id = ?', [id], (err2) => {
        if (err2) return res.status(500).send('Error al eliminar reserva');
        res.send('Reserva denegada, SMS enviado y reserva eliminada');
      });
    }).catch((smsErr) => {
      console.error('Error al enviar SMS de denegación:', smsErr.message);
      res.status(500).send('Error al enviar SMS de denegación');
    });
  });
});

// Eliminar reserva sin SMS
app.delete('/reservas/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM reservas WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('Error al eliminar reserva');
    res.send('Reserva eliminada correctamente');
  });
});



app.listen(3000, () => {
  console.log('Servidor escuchando en https://aprendizaje-q0q8.onrender.com/reservar');
});