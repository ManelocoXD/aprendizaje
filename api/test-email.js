const emailjs = require("@emailjs/nodejs");

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

  const { email, tipo } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Falta el email" });
  }

  try {
    console.log('Enviando email de prueba...');
    console.log('Variables de entorno:');
    console.log('EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID ? 'Set' : 'Not set');
    console.log('EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? 'Set' : 'Not set');
    console.log('EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? 'Set' : 'Not set');
    console.log('EMAILJS_PRIVATE_KEY:', process.env.EMAILJS_PRIVATE_KEY ? 'Set' : 'Not set');

    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID || !process.env.EMAILJS_PUBLIC_KEY) {
      return res.status(400).json({
        error: "Faltan variables de entorno de EmailJS",
        missing: {
          EMAILJS_SERVICE_ID: !process.env.EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID: !process.env.EMAILJS_TEMPLATE_ID,
          EMAILJS_PUBLIC_KEY: !process.env.EMAILJS_PUBLIC_KEY,
          EMAILJS_PRIVATE_KEY: !process.env.EMAILJS_PRIVATE_KEY
        }
      });
    }

    let templateParams;
    
    if (tipo === 'confirmacion') {
      templateParams = {
        to_name: "Cliente Test",
        to_email: email,
        subject: "Reserva Confirmada ✅ - PRUEBA",
        message: `¡Hola Cliente Test!

Tu reserva ha sido CONFIRMADA:

📅 Fecha: Viernes día 15 de Noviembre
🕐 Hora: 20:30
👥 Personas: 4
📞 Teléfono: 612345678

¡Te esperamos! Gracias por elegirnos.

*** ESTO ES UN EMAIL DE PRUEBA ***`,
        reply_to: process.env.RESTAURANT_EMAIL || "noreply@restaurant.com"
      };
    } else if (tipo === 'denegacion') {
      templateParams = {
        to_name: "Cliente Test",
        to_email: email,
        subject: "Reserva no disponible ❌ - PRUEBA",
        message: `Hola Cliente Test,

Lamentamos informarte que tu reserva no ha podido ser confirmada:

📅 Fecha solicitada: Viernes día 15 de Noviembre
🕐 Hora: 20:30
👥 Personas: 4

MOTIVO: No hay disponibilidad para esa fecha y hora.

¿Te interesa otra fecha? Contacta con nosotros:
📞 Teléfono: ${process.env.RESTAURANT_PHONE || '+34612345678'}
📧 Email: ${process.env.RESTAURANT_EMAIL}

*** ESTO ES UN EMAIL DE PRUEBA ***`,
        reply_to: process.env.RESTAURANT_EMAIL || "noreply@restaurant.com"
      };
    } else {
      templateParams = {
        to_name: "Equipo Test",
        to_email: email,
        subject: "🔧 Prueba de EmailJS",
        message: `Este es un email de prueba para verificar que EmailJS funciona correctamente.

Configuración:
- Service ID: ${process.env.EMAILJS_SERVICE_ID}
- Template ID: ${process.env.EMAILJS_TEMPLATE_ID}
- Public Key: ${process.env.EMAILJS_PUBLIC_KEY ? 'Configurada' : 'No configurada'}

Si recibes este email, ¡EmailJS está funcionando! ✅

Fecha: ${new Date().toLocaleString('es-ES')}`,
        reply_to: process.env.RESTAURANT_EMAIL || "test@example.com"
      };
    }
    
    const result = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );
    
    console.log('Email enviado exitosamente:', result);
    
    res.status(200).json({
      success: true,
      message: "Email enviado exitosamente",
      result: result,
      to: email,
      tipo: tipo || 'general'
    });
    
  } catch (err) {
    console.error("Error al enviar email:", err);
    
    res.status(400).json({
      error: "Error al enviar email",
      details: err.message,
      stack: err.stack
    });
  }
};