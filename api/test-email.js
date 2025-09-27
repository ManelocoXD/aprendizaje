const emailjs = require("@emailjs/nodejs");

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Permitir GET para verificar configuración
  if (req.method === "GET") {
    const envCheck = {
      EMAILJS_SERVICE_ID: !!process.env.EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID: !!process.env.EMAILJS_TEMPLATE_ID,
      EMAILJS_PUBLIC_KEY: !!process.env.EMAILJS_PUBLIC_KEY,
      EMAILJS_PRIVATE_KEY: !!process.env.EMAILJS_PRIVATE_KEY,
      RESTAURANT_EMAIL: !!process.env.RESTAURANT_EMAIL,
      RESTAURANT_PHONE: !!process.env.RESTAURANT_PHONE
    };

    return res.status(200).json({
      message: "Estado de configuración EmailJS",
      environment: envCheck,
      allConfigured: envCheck.EMAILJS_SERVICE_ID && envCheck.EMAILJS_TEMPLATE_ID && envCheck.EMAILJS_PUBLIC_KEY && envCheck.RESTAURANT_EMAIL,
      instructions: "Envía un POST con { email: 'test@example.com', tipo: 'general' } para probar"
    });
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Usa GET para verificar o POST para enviar." });
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
📞 Teléfono: ${process.env.RESTAURANT_PHONE || 'Contacta directamente al restaurante'}
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
    
    // Extraer más información del error
    let errorInfo = {
      message: err.message || 'Error desconocido',
      status: err.status || 'unknown',
      text: err.text || 'No disponible',
      name: err.name || 'Error',
      code: err.code || 'No disponible'
    };
    
    // Si es un error de EmailJS, extraer más detalles
    if (err.status) {
      switch (err.status) {
        case 400:
          errorInfo.suggestion = "Error 400: Parámetros incorrectos. Verifica Service ID, Template ID y formato del template.";
          break;
        case 401:
          errorInfo.suggestion = "Error 401: Autenticación fallida. Verifica tu Public Key y Private Key.";
          break;
        case 404:
          errorInfo.suggestion = "Error 404: Service ID o Template ID no encontrado. Verifica que existan en EmailJS.";
          break;
        case 422:
          errorInfo.suggestion = "Error 422: Error en el template. Verifica que tenga las variables correctas.";
          break;
        default:
          errorInfo.suggestion = `Error ${err.status}: Revisa la documentación de EmailJS.`;
      }
    } else {
      // Errores comunes sin código de estado
      if (err.message.includes('fetch')) {
        errorInfo.suggestion = "Error de conexión. Verifica tu conexión a internet.";
      } else if (err.message.includes('User ID')) {
        errorInfo.suggestion = "Error de User ID. Verifica tu Public Key en EmailJS.";
      } else {
        errorInfo.suggestion = "Error desconocido. Verifica todas las configuraciones.";
      }
    }
    
    res.status(400).json({
      error: "Error al enviar email",
      details: errorInfo.message,
      fullError: errorInfo,
      config: {
        serviceId: process.env.EMAILJS_SERVICE_ID || 'NOT SET',
        templateId: process.env.EMAILJS_TEMPLATE_ID || 'NOT SET',
        publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'SET' : 'NOT SET',
        privateKey: process.env.EMAILJS_PRIVATE_KEY ? 'SET' : 'NOT SET'
      }
    });
  }
}; 