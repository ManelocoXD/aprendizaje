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
    
    // Primero obtener la reserva completa para enviar SMS
    const [reservas] = await db.query("SELECT * FROM reservas WHERE id = ?", [id]);
    
    if (reservas.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }
    
    const reserva = reservas[0];
    console.log('Reserva encontrada para denegar:', reserva);

    // Enviar SMS de denegación antes de eliminar
    if (reserva.telefono) {
      const fechaFormateada = formatearFecha(reserva.fecha);
      const mensaje = `Hola ${reserva.nombre}, lamentamos informarte que tu reserva para el ${fechaFormateada} a las ${reserva.hora} no ha podido ser confirmada.`;
      
      // Asegurar formato correcto del teléfono
      let telefonoCompleto = reserva.telefono.toString();
      if (!telefonoCompleto.startsWith('+')) {
        telefonoCompleto = '+34' + telefonoCompleto.replace(/^0+/, '');
      }
      
      console.log('Enviando SMS de denegación a:', telefonoCompleto);
      
      try {
        const message = await client.messages.create({
          body: mensaje,
          from: process.env.TWILIO_FROM,
          to: telefonoCompleto,
        });
        console.log('SMS de denegación enviado:', message.sid);
      } catch (smsError) {
        console.error('Error al enviar SMS de denegación:', smsError);
        // Continuamos con la eliminación aunque falle el SMS
      }
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