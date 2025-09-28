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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Método no permitido" });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Falta el ID" });

  try {
    console.log('Denegando reserva ID:', id);
    
    // Buscar la reserva por ID
    const reserva = await findReservaById(id);
    
    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    console.log('Reserva encontrada para denegar:', reserva);

    // Eliminar la fila completa
    await deleteReserva(reserva.rowIndex);

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

async function findReservaById(id) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I',
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) return null;

    // Buscar por ID
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id.toString()) {
        return {
          id: rows[i][0],
          nombre: rows[i][1],
          telefono: rows[i][2],
          email: rows[i][3],
          personas: rows[i][4],
          fecha: rows[i][5],
          hora: rows[i][6],
          estado: rows[i][7],
          created_at: rows[i][8],
          rowIndex: i + 1 // +1 porque sheets empieza en 1
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error buscando reserva:', error);
    throw error;
  }
}

async function deleteReserva(rowIndex) {
  try {
    // Eliminar la fila completa
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // ID de la primera hoja
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // -1 porque la API usa índice base 0
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });

    console.log('Fila eliminada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error eliminando fila:', error);
    throw error;
  }
}