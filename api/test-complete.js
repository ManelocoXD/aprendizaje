const { createClient } = require('@supabase/supabase-js');
const emailjs = require("@emailjs/nodejs");

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // 1. Test variables de entorno
    console.log('Testing environment variables...');
    const envVars = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      EMAILJS_SERVICE_ID: !!process.env.EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID: !!process.env.EMAILJS_TEMPLATE_ID,
      EMAILJS_PUBLIC_KEY: !!process.env.EMAILJS_PUBLIC_KEY,
      EMAILJS_PRIVATE_KEY: !!process.env.EMAILJS_PRIVATE_KEY,
      RESTAURANT_EMAIL: !!process.env.RESTAURANT_EMAIL,
      RESTAURANT_PHONE: !!process.env.RESTAURANT_PHONE
    };

    results.tests.environment = {
      status: Object.values(envVars).every(Boolean) ? 'PASS' : 'FAIL',
      variables: envVars,
      missing: Object.keys(envVars).filter(key => !envVars[key])
    };

    // 2. Test Supabase
    console.log('Testing Supabase...');
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const { data, error, count } = await supabase
        .from('reservas')
        .select('*', { count: 'exact' })
        .limit(1);

      if (error) throw error;

      results.tests.supabase = {
        status: 'PASS',
        message: 'Conexión exitosa',
        totalReservas: count,
        canRead: true
      };
    } catch (supabaseError) {
      results.tests.supabase = {
        status: 'FAIL',
        error: supabaseError.message,
        details: supabaseError
      };
    }

    // 3. Test EmailJS (solo si es POST con email)
    if (req.method === 'POST' && req.body?.email) {
      console.log('Testing EmailJS...');
      try {
        const templateParams = {
          to_name: "Test System",
          to_email: req.body.email,
          subject: "🧪 Test Completo del Sistema",
          message: `Test automático del sistema de reservas:

Fecha: ${new Date().toLocaleString('es-ES')}

✅ Supabase: ${results.tests.supabase.status}
✅ Variables de entorno: ${results.tests.environment.status}
✅ EmailJS: Funcionando (recibiste este email)

El sistema está funcionando correctamente.`,
          reply_to: process.env.RESTAURANT_EMAIL
        };

        const emailResult = await emailjs.send(
          process.env.EMAILJS_SERVICE_ID,
          process.env.EMAILJS_TEMPLATE_ID,
          templateParams,
          {
            publicKey: process.env.EMAILJS_PUBLIC_KEY,
            privateKey: process.env.EMAILJS_PRIVATE_KEY,
          }
        );

        results.tests.emailjs = {
          status: 'PASS',
          message: 'Email enviado exitosamente',
          messageSid: emailResult.status,
          sentTo: req.body.email
        };

      } catch (emailError) {
        results.tests.emailjs = {
          status: 'FAIL',
          error: emailError.message,
          details: emailError
        };
      }
    } else {
      results.tests.emailjs = {
        status: 'SKIP',
        message: 'Envía POST con {email: "tu@email.com"} para probar EmailJS'
      };
    }

    // 4. Resumen general
    const passedTests = Object.values(results.tests).filter(test => test.status === 'PASS').length;
    const totalTests = Object.values(results.tests).filter(test => test.status !== 'SKIP').length;

    results.summary = {
      overall: passedTests === totalTests ? 'PASS' : 'FAIL',
      passed: passedTests,
      total: totalTests,
      ready: passedTests === totalTests && results.tests.environment.status === 'PASS'
    };

    const statusCode = results.summary.overall === 'PASS' ? 200 : 500;
    res.status(statusCode).json(results);

  } catch (err) {
    console.error("Error en test completo:", err);
    res.status(500).json({
      error: "Error en test completo",
      details: err.message,
      stack: err.stack
    });
  }
};