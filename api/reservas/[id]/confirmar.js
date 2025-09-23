const mysql = require("mysql2/promise");
const twilio = require("twilio");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

function formatearFecha(fechaStr) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const fecha = new Date(fechaStr + 'T00:00:00');
  if (isNaN(fecha)) {
    console.log('Fecha inválida:', fechaStr);
    return fechaStr;
  }

  const diaSemana = diasSemana[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];

  return `${diaSemana} día ${dia} de ${mes}`;
}

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: "Falta el ID" });
  }

  try {
    console.log('Procesando confirmación de reserva ID:', id);
    
    // Primero obtener la reserva completa
    const [reservas] = await db.query("SELECT * FROM reservas WHERE id = ?", [id]);
    
    if (reservas.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }
    
    const reserva = reservas[0];
    console.log('Reserva encontrada:', reserva);
    
    // Actualizar estado a confirmada
    await db.execute("UPDATE reservas SET estado = 'confirmada' WHERE id = ?", [id]);
    console.log('Estado actualizado a confirmada');

    // Enviar SMS de confirmación
    if (reserva.telefono) {
      const fechaFormateada = formatearFecha(reserva.fecha);
      const mensaje = `Hola ${reserva.nombre}, tu reserva para el ${fechaFormateada} a las ${reserva.hora} ha sido confirmada. ¡Te esperamos!`;
      
      // Asegurar formato correcto del teléfono
      let telefonoCompleto = reserva.telefono.toString();
      if (!telefonoCompleto.startsWith('+')) {
        // Eliminar ceros iniciales y agregar +34
        telefonoCompleto = '+34' + telefonoCompleto.replace(/^0+/, '');
      }
      
      console.log('Enviando SMS a:', telefonoCompleto);
      
      try {
        const message = await client.messages.create({
          body: mensaje,
          from: process.env.TWILIO_FROM,
          to: telefonoCompleto,
        });
        console.log('SMS enviado exitosamente:', message.sid);
        res.status(200).json({ 
          success: true, 
          message: "Reserva confirmada y SMS enviado",
          messageSid: message.sid 
        });
      } catch (smsError) {
        console.error('Error al enviar SMS:', smsError);
        res.status(200).json({ 
          success: true, 
          message: "Reserva confirmada pero error al enviar SMS: " + smsError.message 
        });
      }
    } else {
      res.status(200).json({ 
        success: true, 
        message: "Reserva confirmada (sin teléfono para SMS)" 
      });
    }
    
  } catch (err) {
    console.error("Error al confirmar reserva:", err);
    res.status(500).json({ 
      error: "Error al confirmar reserva", 
      details: err.message 
    });
  }
};