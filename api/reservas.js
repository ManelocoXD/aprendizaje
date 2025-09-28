const { google } = require('googleapis');

// Configurar Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end("Método no permitido");

  try {
    console.log('Obteniendo reservas de Google Sheets...');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I', // Todas las columnas
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      console.log('No hay reservas en el sheet');
      return res.status(200).json([]);
    }

    // Convertir filas a objetos (saltear header)
    const reservas = rows.slice(1).map((row, index) => ({
      id: row[0] || index + 1,
      nombre: row[1] || '',
      telefono: row[2] || '',
      email: row[3] || null,
      personas: parseInt(row[4]) || 0,
      fecha: row[5] || '',
      hora: row[6] || '',
      estado: row[7] || 'pendiente',
      created_at: row[8] || '',
      rowIndex: index + 2 // +2 porque sheet empieza en 1 y saltamos header
    })).filter(reserva => reserva.nombre); // Filtrar filas vacías

    // Ordenar por fecha y hora
    reservas.sort((a, b) => {
      if (a.fecha !== b.fecha) {
        return new Date(a.fecha) - new Date(b.fecha);
      }
      return a.hora.localeCompare(b.hora);
    });

    console.log(`${reservas.length} reservas obtenidas exitosamente`);
    res.status(200).json(reservas);

  } catch (err) {
    console.error("Error al obtener reservas:", err);
    res.status(500).json({ 
      error: "Error al obtener reservas de Google Sheets",
      details: err.message 
    });
  }
};