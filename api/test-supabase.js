const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verificar variables de entorno
    const envCheck = {
      SUPABASE_URL: {
        exists: !!process.env.SUPABASE_URL,
        value: process.env.SUPABASE_URL || 'NOT_SET'
      },
      SUPABASE_ANON_KEY: {
        exists: !!process.env.SUPABASE_ANON_KEY,
        value: process.env.SUPABASE_ANON_KEY ? 
          process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT_SET'
      }
    };

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(400).json({
        error: "Faltan variables de entorno de Supabase",
        environment: envCheck
      });
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test básico: contar reservas
    const { data, error, count } = await supabase
      .from('reservas')
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      return res.status(500).json({
        error: "Error de Supabase",
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    res.status(200).json({
      success: true,
      message: "Supabase funcionando correctamente",
      environment: envCheck,
      database: {
        totalReservas: count,
        sampleData: data.map(r => ({
          id: r.id,
          nombre: r.nombre,
          fecha: r.fecha,
          estado: r.estado
        }))
      }
    });

  } catch (err) {
    console.error("Error en test Supabase:", err);
    res.status(500).json({
      error: "Error al conectar con Supabase",
      details: err.message
    });
  }
};