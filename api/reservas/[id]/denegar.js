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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Método no permitido" });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Falta el ID" });

  try {
    console.log('Denegando reserva ID:', id);
    
    // Obtener la reserva antes de eliminarla
    const { data: reserva, error: selectError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError || !reserva) {
      console.error('Error al obtener reserva:', selectError);
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    console.log('Reserva encontrada para denegar:', reserva);

    // Preparar datos del email antes de eliminar
    const fechaFormateada = formatearFecha(reserva.fecha);
    
    const emailData = {
      shouldSendEmail: true,
      emailType: reserva.email ? 'cliente' : 'restaurante',
      emailParams: {
        to_name: reserva.email ? reserva.nombre : "Equipo del Restaurante",
        to_email: reserva.email || process.env.RESTAURANT_EMAIL,
        subject: reserva.email ? "Reserva no disponible ❌" : "Reserva Denegada ❌ - Cliente contactado",
        message: reserva.email ? 
          `Hola ${reserva.nombre},

Lamentamos informarte que tu reserva no ha podido ser confirmada:

📅 Fecha solicitada: ${fechaFormateada}
🕐 Hora: ${reserva.hora}
👥 Personas: ${reserva.personas}

MOTIVO: No hay disponibilidad para esa fecha y hora.

¿Te interesa otra fecha? Contacta con nosotros:
📞 Teléfono: ${process.env.RESTAURANT_PHONE}
📧 Email: ${process.env.RESTAURANT_EMAIL}

¡Esperamos poder atenderte pronto!

Gracias por tu comprensión.` :
          `Se ha DENEGADO una reserva. Datos del cliente:

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
        reply_to: process.env.RESTAURANT_EMAIL
      }
    };
    
    // Eliminar la reserva
    const { error: deleteError } = await supabase
      .from('reservas')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error al eliminar reserva:', deleteError);
      return res.status(500).json({ error: "Error al eliminar reserva" });
    }

    console.log('Reserva eliminada exitosamente');
    
    res.status(200).json({ 
      success: true, 
      message: "Reserva denegada y eliminada",
      emailData: emailData
    });
    
  } catch (err) {
    console.error("Error al denegar reserva:", err);
    res.status(500).json({ 
      error: "Error al denegar reserva", 
      details: err.message 
    });
  }
};