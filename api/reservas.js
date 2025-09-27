const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end("Método no permitido");

  try {
    console.log('Obteniendo reservas de Supabase...');

    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(500).json({ 
        error: "Error al obtener reservas",
        details: error.message 
      });
    }

    console.log(`${data.length} reservas obtenidas exitosamente`);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error al obtener reservas:", err);
    res.status(500).json({ 
      error: "Error al obtener reservas",
      details: err.message 
    });
  }
};