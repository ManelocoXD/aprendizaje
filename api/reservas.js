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
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    console.log('=== Iniciando obtención de reservas ===');
    
    // Verificar variables de entorno
    if (!process.env.GOOGLE_SHEET_ID) {
      console.error('ERROR: GOOGLE_SHEET_ID no está definido');
      return res.status(500).json({ 
        error: "Configuración del servidor incompleta",
        details: "GOOGLE_SHEET_ID no está configurado"
      });
    }

    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      console.error('ERROR: GOOGLE_CLIENT_EMAIL no está definido');
      return res.status(500).json({ 
        error: "Configuración del servidor incompleta",
        details: "GOOGLE_CLIENT_EMAIL no está configurado"
      });
    }

    console.log('Variables de entorno verificadas correctamente');
    console.log('GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID);
    console.log('GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL);

    console.log('Obteniendo datos de Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I', // Todas las columnas
    });

    console.log('Respuesta recibida de Google Sheets');
    const rows = response.data.values || [];
    console.log(`Total de filas encontradas: ${rows.length}`);

    if (rows.length <= 1) {
      console.log('No hay reservas en el sheet (solo headers o vacío)');
      return res.status(200).json([]);
    }

    // Log de la primera fila (headers)
    console.log('Headers:', rows[0]);

    // Convertir filas a objetos (saltear header)
    const reservas = rows.slice(1)
      .map((row, index) => {
        try {
          return {
            id: row[0] || (index + 1).toString(),
            nombre: row[1] || '',
            telefono: row[2] || '',
            email: row[3] || '',
            personas: parseInt(row[4]) || 0,
            fecha: row[5] || '',
            hora: row[6] || '',
            estado: row[7] || 'pendiente',
            created_at: row[8] || '',
            rowIndex: index + 2 // +2 porque sheet empieza en 1 y saltamos header
          };
        } catch (error) {
          console.error(`Error procesando fila ${index + 2}:`, error);
          return null;
        }
      })
      .filter(reserva => reserva && reserva.nombre); 

    console.log(`Reservas procesadas: ${reservas.length}`);

    // Ordenar por fecha y hora
    reservas.sort((a, b) => {
      try {
        if (a.fecha !== b.fecha) {
          return new Date(a.fecha) - new Date(b.fecha);
        }
        return a.hora.localeCompare(b.hora);
      } catch (error) {
        console.error('Error ordenando reservas:', error);
        return 0;
      }
    });

    console.log(`${reservas.length} reservas obtenidas exitosamente`);
    
    if (reservas.length > 0) {
      console.log('Primeras reservas:', reservas.slice(0, 3));
    }

    res.status(200).json(reservas);

  } catch (err) {
    console.error("=== ERROR al obtener reservas ===");
    let errorDetails = err.message;
    let errorType = 'Error desconocido';

    if (err.message.includes("Unable to parse range")) {
      errorType = 'Nombre de Hoja incorrecto';
      errorDetails = `La hoja llamada "${process.env.GOOGLE_SHEET_NAME}" no se encontró. Verifica la variable de entorno GOOGLE_SHEET_NAME.`;
    } else if (err.code === 403) {
      errorType = 'Permisos insuficientes';
      errorDetails = 'La cuenta de servicio no tiene permisos para acceder a la hoja.';
    }

    res.status(500).json({ 
      error: "Error al obtener reservas de Google Sheets",
      errorType: errorType,
      details: errorDetails
    });
  }
};