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
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const { nombre, telefono, email, personas, hora, fecha } = req.body;

  if (!nombre || !telefono || !personas || !hora || !fecha) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    console.log('Guardando reserva en Google Sheets:', { nombre, telefono, email, personas, hora, fecha });

    // Obtener el siguiente ID
    const nextId = await getNextId();

    // Preparar los datos para insertar
    const values = [
      [
        nextId, // ID
        nombre,
        telefono,
        email || '',
        parseInt(personas),
        fecha,
        hora,
        'pendiente',
        new Date().toISOString()
      ]
    ];

    // Insertar en Google Sheets
    const request = {
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I', // Rango que incluye todas las columnas
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    };

    const response = await sheets.spreadsheets.values.append(request);

    console.log('Reserva guardada exitosamente en fila:', response.data.updates.updatedRange);

    res.status(200).json({ 
      message: "Reserva guardada exitosamente",
      id: nextId,
      range: response.data.updates.updatedRange
    });

  } catch (err) {
    console.error("Error al guardar reserva:", err);
    res.status(500).json({ 
      error: "Error al guardar en Google Sheets",
      details: err.message 
    });
  }
};

async function getNextId() {
  try {
    // Obtener todas las filas para calcular el siguiente ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:A', // Solo la columna ID
    });

    const rows = response.data.values || [];
    
    // Si solo hay headers o está vacío, empezar desde 1
    if (rows.length <= 1) {
      return 1;
    }

    // Encontrar el ID más alto y sumar 1
    let maxId = 0;
    for (let i = 1; i < rows.length; i++) { // Empezar desde 1 para saltear headers
      const id = parseInt(rows[i][0]);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }

    return maxId + 1;
  } catch (error) {
    console.error('Error obteniendo siguiente ID:', error);
    return Date.now(); // Fallback: usar timestamp
  }
}