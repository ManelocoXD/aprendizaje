const { createClient } = require('@supabase/supabase-js');
const emailjs = require("@emailjs/nodejs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Falta el ID" });

  try {
    console.log('Confirmando reserva ID:', id);
    
    // Obtener la reserva
    const { data: reserva, error: selectError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError || !reserva) {
      console.error('Error al obtener reserva:', selectError);
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    console.log('Reserva encontrada:', reserva);

    // Actualizar estado
    const { error: updateError } = await supabase
      .from('reservas')
      .update({ estado: 'confirmada' })
      .eq('id', id);

    if (updateError) {
      console.error('Error al actualizar reserva:', updateError);
      return res.status(500).json({ error: "Error al actualizar reserva" });
    }

    console.log('Estado actualizado a confirmada');

    // Enviar email
    try {
      if (reserva.email) {
        await enviarEmailConfirmacion(reserva);
        console.log('Email de confirmación enviado al cliente');
      } else {
        await enviarNotificacionRestaurante(reserva, 'confirmada');
        console.log('Notificación enviada al restaurante');
      }
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
      // No fallar la operación si el email falla
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
    reply_to: process.env.RESTAURANT_EMAIL
  };

  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    templateParams,
    {
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    }
  );
}

async function enviarNotificacionRestaurante(reserva, accion) {
  const fechaFormateada = formatearFecha(reserva.fecha);
  
  const templateParams = {
    to_name: "Equipo del Restaurante",
    to_email: process.env.RESTAURANT_EMAIL,
    subject: "Reserva Confirmada ✅ - Contactar cliente",
    message: `Se ha confirmado una reserva. Datos del cliente para contactar:

👤 Cliente: ${reserva.nombre}
📞 Teléfono: ${reserva.telefono}
📧 Email: ${reserva.email || 'No proporcionado'}
📅 Fecha: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

ACCIÓN: Contacta al cliente para confirmar los detalles finales.`,
    reply_to: process.env.RESTAURANT_EMAIL
  };

  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    templateParams,
    {
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    }
  );
}