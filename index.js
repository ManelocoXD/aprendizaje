const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Twilio
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const twilioNumber = process.env.TWILIO_FROM;

// Conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos MySQL');
});

// Insertar reserva (CORREGIDO: incluye teléfono)
app.post('/reservar', (req, res) => {
  const { nombre, telefono, personas, hora, fecha } = req.body;
  if (!nombre || !telefono || !personas || !hora || !fecha) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  db.query(
    'INSERT INTO reservas (nombre, telefono, personas, hora, fecha, estado) VALUES (?, ?, ?, ?, ?, ?)',
    [nombre, telefono, personas, hora, fecha, 'pendiente'],
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

// Confirmar reserva (CORREGIDO)
app.post('/reservas/:id/confirmar', (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM reservas WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error al buscar reserva:', err);
      return res.status(500).send('Error al buscar reserva');
    }
    
    if (results.length === 0) {
      return res.status(404).send('Reserva no encontrada');
    }

    const reserva = results[0];
    console.log('Reserva encontrada:', reserva);
    
    // Actualizar estado a confirmada
    db.query('UPDATE reservas SET estado = ? WHERE id = ?', ['confirmada', id], (err2) => {
      if (err2) {
        console.error('Error al actualizar reserva:', err2);
        return res.status(500).send('Error al confirmar reserva');
      }

      // Enviar SMS
      const fechaFormateada = formatearFecha(reserva.fecha);
      const mensaje = `Hola ${reserva.nombre}, tu reserva para el ${fechaFormateada} a las ${reserva.hora} ha sido confirmada. ¡Te esperamos!`;
      
      // Asegurar formato de teléfono español
      let telefonoCompleto = reserva.telefono;
      if (!telefonoCompleto.startsWith('+')) {
        telefonoCompleto = '+34' + telefonoCompleto.replace(/^0+/, '');
      }

      twilioClient.messages.create({
        body: mensaje,
        from: twilioNumber,
        to: telefonoCompleto
      }).then((message) => {
        console.log('SMS enviado:', message.sid);
        res.send('Reserva confirmada y SMS enviado');
      }).catch((smsErr) => {
        console.error('Error al enviar SMS:', smsErr);
        res.status(200).send('Reserva confirmada pero error al enviar SMS: ' + smsErr.message);
      });
    });
  });
});

// Denegar y eliminar reserva (CORREGIDO)
app.delete('/reservas/:id/denegar', (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM reservas WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error al buscar reserva:', err);
      return res.status(500).send('Error al buscar reserva');
    }
    
    if (results.length === 0) {
      return res.status(404).send('Reserva no encontrada');
    }

    const reserva = results[0];
    const fechaFormateada = formatearFecha(reserva.fecha);
    const mensaje = `Hola ${reserva.nombre}, lamentamos informarte que tu reserva para el ${fechaFormateada} a las ${reserva.hora} no ha podido ser confirmada.`;

    // Asegurar formato de teléfono español
    let telefonoCompleto = reserva.telefono;
    if (!telefonoCompleto.startsWith('+')) {
      telefonoCompleto = '+34' + telefonoCompleto.replace(/^0+/, '');
    }

    twilioClient.messages.create({
      body: mensaje,
      from: twilioNumber,
      to: telefonoCompleto
    }).then(() => {
      db.query('DELETE FROM reservas WHERE id = ?', [id], (err2) => {
        if (err2) {
          console.error('Error al eliminar reserva:', err2);
          return res.status(500).send('Error al eliminar reserva');
        }
        res.send('Reserva denegada, SMS enviado y reserva eliminada');
      });
    }).catch((smsErr) => {
      console.error('Error al enviar SMS de denegación:', smsErr);
      // Eliminar la reserva aunque falle el SMS
      db.query('DELETE FROM reservas WHERE id = ?', [id], (err2) => {
        if (err2) {
          return res.status(500).send('Error al eliminar reserva');
        }
        res.status(200).send('Reserva eliminada pero error al enviar SMS: ' + smsErr.message);
      });
    });
  });
});

// Eliminar reserva sin SMS
app.delete('/reservas/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM reservas WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error al eliminar reserva:', err);
      return res.status(500).send('Error al eliminar reserva');
    }
    res.send('Reserva eliminada correctamente');
  });
});

function formatearFecha(fechaStr) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const fecha = new Date(fechaStr + 'T00:00:00'); // Evitar problemas de zona horaria
  if (isNaN(fecha)) {
    console.log('Fecha inválida:', fechaStr);
    return fechaStr;
  }

  const diaSemana = diasSemana[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];

  return `${diaSemana} día ${dia} de ${mes}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});