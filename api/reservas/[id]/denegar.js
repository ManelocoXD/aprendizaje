const mysql = require("mysql2/promise");
const emailjs = require("@emailjs/nodejs");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: "Falta el ID" });
  }

  try {
    console.log('Procesando denegación de reserva ID:', id);
    
    // Obtener la reserva completa antes de eliminarla
    const [reservas] = await db.query("SELECT * FROM reservas WHERE id = ?", [id]);
    
    if (reservas.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }
    
    const reserva = reservas[0];
    console.log('Reserva encontrada para denegar:', reserva);

    // Enviar email/notificación antes de eliminar
    if (reserva.email) {
      await enviarEmailDenegacion(reserva);
    } else {
      await enviarNotificacionRestaurante(reserva, 'denegada');
    }
    
    // Eliminar la reserva
    await db.execute("DELETE FROM reservas WHERE id = ?", [id]);
    console.log('Reserva eliminada exitosamente');
    
    res.status(200).json({ 
      success: true, 
      message: "Reserva denegada y eliminada exitosamente" 
    });
    
  } catch (err) {
    console.error("Error al denegar reserva:", err);
    res.status(500).json({ 
      error: "Error al denegar reserva", 
      details: err.message 
    });
  }
};

async function enviarEmailDenegacion(reserva) {
  try {
    const fechaFormateada = formatearFecha(reserva.fecha);
    
    const templateParams = {
      to_name: reserva.nombre,
      to_email: reserva.email,
      subject: "Reserva no disponible ❌",
      message: `Hola ${reserva.nombre},

Lamentamos informarte que tu reserva no ha podido ser confirmada:

📅 Fecha solicitada: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

MOTIVO: No hay disponibilidad para esa fecha y hora.

¿Te interesa otra fecha? Contacta con nosotros:
📞 Teléfono: ${process.env.RESTAURANT_PHONE || 'Contacta directamente al restaurante'}
📧 Email: ${process.env.RESTAURANT_EMAIL}

¡Esperamos poder atenderte pronto!

Gracias por tu comprensión.`,
      reply_to: process.env.RESTAURANT_EMAIL || "noreply@restaurant.com"
    };

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID, // Mismo template
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );
    
    console.log('Email de denegación enviado exitosamente');
  } catch (error) {
    console.error('Error al enviar email de denegación:', error);
    throw error;
  }
}

async function enviarNotificacionRestaurante(reserva, accion) {
  try {
    const fechaFormateada = formatearFecha(reserva.fecha);
    
    const templateParams = {
      to_name: "Equipo del Restaurante",
      to_email: process.env.RESTAURANT_EMAIL,
      subject: "Reserva Denegada ❌ - Cliente contactado",
      message: `Se ha DENEGADO una reserva. Datos del cliente:

👤 Cliente: ${reserva.nombre}
📞 Teléfono: ${reserva.telefono}
📧 Email: ${reserva.email || 'No proporcionado'}
📅 Fecha solicitada: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

ACCIÓN RECOMENDADA:
- Contactar al cliente para ofrecer fechas alternativas
- Verificar si hay cancelaciones próximas para esa fecha
- Ofrecer horarios alternativos cercanos

El cliente ha sido informado de la denegación.`,
      reply_to: process.env.RESTAURANT_EMAIL || "noreply@restaurant.com"
    };

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID, // Mismo template
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );
    
    console.log('Notificación de denegación enviada');
  } catch (error) {
    console.error('Error al enviar notificación:', error);
  }
}