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
  if (!id) return res.status(400).json({ error: "Falta el ID de la reserva" });

  try {
    console.log('Cancelando reserva ID:', id);
    
    // Buscar la reserva por ID
    const reserva = await findReservaById(id);
    
    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    console.log('Reserva encontrada para cancelar:', {
      id: reserva.id,
      nombre: reserva.nombre,
      fecha: reserva.fecha,
      hora: reserva.hora,
      personas: reserva.personas
    });

    // Verificar que la reserva esté confirmada
    if (reserva.estado !== 'confirmada') {
      return res.status(400).json({ 
        error: "Solo se pueden cancelar reservas confirmadas",
        estado_actual: reserva.estado
      });
    }

    // Eliminar la fila completa de la reserva
    await deleteReserva(reserva.rowIndex);

    console.log('Reserva cancelada y eliminada exitosamente');
    
    res.status(200).json({ 
      success: true, 
      message: "Reserva cancelada exitosamente",
      reserva_cancelada: {
        id: reserva.id,
        nombre: reserva.nombre,
        fecha: reserva.fecha,
        hora: reserva.hora,
        personas: reserva.personas
      }
    });
    
  } catch (err) {
    console.error("Error al cancelar reserva:", err);
    res.status(500).json({ 
      error: "Error interno al cancelar la reserva", 
      details: err.message 
    });
  }
};

async function findReservaById(id) {
  try {
    console.log('Buscando reserva con ID:', id);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I',
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      console.log('No hay datos en el sheet');
      return null;
    }

    // Buscar por ID
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString() === id.toString()) {
        const reserva = {
          id: rows[i][0],
          nombre: rows[i][1],
          telefono: rows[i][2],
          email: rows[i][3],
          personas: parseInt(rows[i][4]) || 0,
          fecha: rows[i][5],
          hora: rows[i][6],
          estado: rows[i][7],
          created_at: rows[i][8],
          rowIndex: i + 1 // +1 porque sheets empieza en 1
        };
        
        console.log('Reserva encontrada:', reserva);
        return reserva;
      }
    }
    
    console.log('No se encontró reserva con ID:', id);
    return null;
    
  } catch (error) {
    console.error('Error buscando reserva:', error);
    throw error;
  }
}

async function deleteReserva(rowIndex) {
  try {
    console.log('Eliminando fila:', rowIndex);
    
    // Eliminar la fila completa usando batchUpdate
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // ID de la primera hoja (por defecto es 0)
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // -1 porque la API usa índice base 0
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });

    console.log('Fila eliminada exitosamente:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Error eliminando fila:', error);
    throw error;
  }
}