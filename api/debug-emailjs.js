module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Verificar que EmailJS se puede importar
    let emailjsModule;
    try {
      emailjsModule = require("@emailjs/nodejs");
      console.log('EmailJS module loaded successfully');
    } catch (importError) {
      return res.status(500).json({
        error: "No se puede importar EmailJS",
        details: importError.message,
        solution: "Ejecuta: npm install @emailjs/nodejs"
      });
    }

    // Verificar variables de entorno con más detalle
    const envVars = {
      EMAILJS_SERVICE_ID: {
        exists: !!process.env.EMAILJS_SERVICE_ID,
        value: process.env.EMAILJS_SERVICE_ID || 'NOT_SET',
        format: process.env.EMAILJS_SERVICE_ID ? 
          (process.env.EMAILJS_SERVICE_ID.startsWith('service_') ? 'CORRECT' : 'INCORRECT_FORMAT') : 
          'MISSING'
      },
      EMAILJS_TEMPLATE_ID: {
        exists: !!process.env.EMAILJS_TEMPLATE_ID,
        value: process.env.EMAILJS_TEMPLATE_ID || 'NOT_SET',
        format: process.env.EMAILJS_TEMPLATE_ID ? 
          (process.env.EMAILJS_TEMPLATE_ID.startsWith('template_') ? 'CORRECT' : 'INCORRECT_FORMAT') : 
          'MISSING'
      },
      EMAILJS_PUBLIC_KEY: {
        exists: !!process.env.EMAILJS_PUBLIC_KEY,
        value: process.env.EMAILJS_PUBLIC_KEY ? 
          process.env.EMAILJS_PUBLIC_KEY.substring(0, 8) + '...' : 'NOT_SET',
        length: process.env.EMAILJS_PUBLIC_KEY ? process.env.EMAILJS_PUBLIC_KEY.length : 0
      },
      EMAILJS_PRIVATE_KEY: {
        exists: !!process.env.EMAILJS_PRIVATE_KEY,
        value: process.env.EMAILJS_PRIVATE_KEY ? 
          process.env.EMAILJS_PRIVATE_KEY.substring(0, 8) + '...' : 'NOT_SET',
        length: process.env.EMAILJS_PRIVATE_KEY ? process.env.EMAILJS_PRIVATE_KEY.length : 0
      },
      RESTAURANT_EMAIL: {
        exists: !!process.env.RESTAURANT_EMAIL,
        value: process.env.RESTAURANT_EMAIL || 'NOT_SET',
        isValidEmail: process.env.RESTAURANT_EMAIL ? 
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.RESTAURANT_EMAIL) : false
      }
    };

    // Intentar una llamada muy básica a EmailJS (sin enviar email real)
    let emailjsTest = {
      canInstantiate: false,
      error: null
    };

    try {
      // Solo verificar que podemos acceder a las funciones básicas
      if (typeof emailjsModule.send === 'function') {
        emailjsTest.canInstantiate = true;
        emailjsTest.message = 'EmailJS functions are accessible';
      }
    } catch (testError) {
      emailjsTest.error = testError.message;
    }

    // Diagnóstico de problemas comunes
    const diagnostics = [];
    
    if (!envVars.EMAILJS_SERVICE_ID.exists) {
      diagnostics.push("❌ FALTA EMAILJS_SERVICE_ID");
    } else if (envVars.EMAILJS_SERVICE_ID.format === 'INCORRECT_FORMAT') {
      diagnostics.push("⚠️ EMAILJS_SERVICE_ID debe empezar con 'service_'");
    }
    
    if (!envVars.EMAILJS_TEMPLATE_ID.exists) {
      diagnostics.push("❌ FALTA EMAILJS_TEMPLATE_ID");
    } else if (envVars.EMAILJS_TEMPLATE_ID.format === 'INCORRECT_FORMAT') {
      diagnostics.push("⚠️ EMAILJS_TEMPLATE_ID debe empezar con 'template_'");
    }
    
    if (!envVars.EMAILJS_PUBLIC_KEY.exists) {
      diagnostics.push("❌ FALTA EMAILJS_PUBLIC_KEY");
    } else if (envVars.EMAILJS_PUBLIC_KEY.length < 10) {
      diagnostics.push("⚠️ EMAILJS_PUBLIC_KEY parece muy corta");
    }
    
    if (!envVars.RESTAURANT_EMAIL.exists) {
      diagnostics.push("❌ FALTA RESTAURANT_EMAIL");
    } else if (!envVars.RESTAURANT_EMAIL.isValidEmail) {
      diagnostics.push("⚠️ RESTAURANT_EMAIL no tiene formato válido");
    }

    res.status(200).json({
      status: "EmailJS Debug Info",
      moduleLoaded: !!emailjsModule,
      environmentVariables: envVars,
      emailjsTest: emailjsTest,
      diagnostics: diagnostics,
      recommendations: {
        next_steps: diagnostics.length === 0 ? 
          ["✅ Configuración básica OK", "🔄 Intenta enviar un email de prueba"] :
          ["🔧 Corrige los problemas listados arriba", "📋 Verifica tu dashboard de EmailJS"]
      }
    });

  } catch (error) {
    res.status(500).json({
      error: "Error en diagnóstico",
      details: error.message,
      stack: error.stack
    });
  }
};