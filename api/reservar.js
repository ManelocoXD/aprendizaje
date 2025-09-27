const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const { nombre, telefono, email, personas, hora, fecha } = req.body;

  if (!nombre || !telefono || !personas || !hora || !fecha) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    console.log('Guardando reserva en Supabase:', { nombre, telefono, email, personas, hora, fecha });

    const { data, error } = await supabase
      .from('reservas')
      .insert([
        {
          nombre,
          telefono,
          email: email || null,
          personas: parseInt(personas),
          hora,
          fecha,
          estado: 'pendiente'
        }
      ])
      .select(); // Para obtener el registro insertado

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(500).json({ 
        error: "Error al guardar reserva",
        details: error.message 
      });
    }

    console.log('Reserva guardada exitosamente:', data);
    res.status(200).json({ 
      message: "Reserva guardada exitosamente",
      reserva: data[0]
    });
  } catch (err) {
    console.error("Error al guardar reserva:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      details: err.message 
    });
  }
};