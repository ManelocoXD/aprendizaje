// api/reservas/[id]/confirmar.js - NUEVA VERSIÓN
const { createClient } = require('@supabase/supabase-js');

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

    // En lugar de enviar el email aquí, devolvemos los datos para que el frontend envíe el email
    const fechaFormateada = formatearFecha(reserva.fecha);
    
    const emailData = {
      shouldSendEmail: true,
      emailType: reserva.email ? 'cliente' : 'restaurante',
      emailParams: {
        to_name: reserva.email ? reserva.nombre : "Equipo del Restaurante",
        to_email: reserva.email || process.env.RESTAURANT_EMAIL,
        subject: reserva.email ? "Reserva Confirmada ✅" : "Reserva Confirmada ✅ - Contactar cliente",
        message: reserva.email ? 
          `¡Hola ${reserva.nombre}!

Tu reserva ha sido CONFIRMADA:

📅 Fecha: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}
📞 Teléfono: ${reserva.telefono}

¡Te esperamos! Gracias por elegirnos.` :
          `Se ha confirmado una reserva. Datos del cliente para contactar:

👤 Cliente: ${reserva.nombre}
📞 Teléfono: ${reserva.telefono}
📧 Email: ${reserva.email || 'No proporcionado'}
📅 Fecha: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

ACCIÓN: Contacta al cliente para confirmar los detalles finales.`,
        reply_to: process.env.RESTAURANT_EMAIL
      }
    };
    
    res.status(200).json({ 
      success: true, 
      message: "Reserva confirmada",
      emailData: emailData
    });
    
  } catch (err) {
    console.error("Error al confirmar reserva:", err);
    res.status(500).json({ 
      error: "Error al confirmar reserva", 
      details: err.message 
    });
  }
};