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
    
    // Obtener la reserva completa
    const [reservas] = await db.query("SELECT * FROM reservas WHERE id = ?", [id]);
    
    if (reservas.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }
    
    const reserva = reservas[0];
    console.log('Reserva encontrada:', reserva);
    
    // Actualizar estado a confirmada
    await db.execute("UPDATE reservas SET estado = 'confirmada' WHERE id = ?", [id]);
    console.log('Estado actualizado a confirmada');

    // Enviar email de confirmación si hay email, si no hay, enviar notificación al restaurante
    if (reserva.email) {
      await enviarEmailConfirmacion(reserva);
    } else {
      // Enviar notificación al restaurante con datos de contacto
      await enviarNotificacionRestaurante(reserva, 'confirmada');
    }
    
    res.status(200).json({ 
      success: true, 
      message: "Reserva confirmada y notificación enviada"
    });
    
  } catch (err) {
    console.error("Error al confirmar reserva:", err);
    res.status(500).json({ 
      error: "Error al confirmar reserva", 
      details: err.message 
    });
  }
};

async function enviarEmailConfirmacion(reserva) {
  try {
    const fechaFormateada = formatearFecha(reserva.fecha);
    
    const templateParams = {
      to_name: reserva.nombre,
      to_email: reserva.email,
      subject: "Reserva Confirmada ✅",
      message: `¡Hola ${reserva.nombre}!

Tu reserva ha sido CONFIRMADA:

📅 Fecha: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}
📞 Teléfono: ${reserva.telefono}

¡Te esperamos! Gracias por elegirnos.

Si necesitas modificar algo, contacta con nosotros.`,
      reply_to: process.env.RESTAURANT_EMAIL || "noreply@restaurant.com"
    };

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID, // Solo un template
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );
    
    console.log('Email de confirmación enviado exitosamente');
  } catch (error) {
    console.error('Error al enviar email de confirmación:', error);
    throw error;
  }
}

async function enviarNotificacionRestaurante(reserva, accion) {
  try {
    const fechaFormateada = formatearFecha(reserva.fecha);
    const asunto = accion === 'confirmada' ? 'Reserva Confirmada ✅' : 'Reserva Denegada ❌';
    
    const templateParams = {
      to_name: "Equipo del Restaurante",
      to_email: process.env.RESTAURANT_EMAIL,
      subject: `${asunto} - Contactar cliente`,
      message: `Se ha ${accion} una reserva. Datos del cliente para contactar:

👤 Cliente: ${reserva.nombre}
📞 Teléfono: ${reserva.telefono}
📅 Fecha: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

${accion === 'confirmada' ? 
  'ACCIÓN: Contacta al cliente para confirmar los detalles finales.' : 
  'ACCIÓN: Se ha informado al cliente. Considera ofrecer fechas alternativas.'}`,
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
    
    console.log('Notificación al restaurante enviada');
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    // No lanzar error aquí para no fallar la operación principal
  }
}