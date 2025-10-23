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
    console.log('Guardando reserva confirmada automáticamente:', { nombre, telefono, email, personas, hora, fecha });

    // Verificar disponibilidad antes de guardar
    const isAvailable = await checkAvailability(fecha, hora, personas);
    if (!isAvailable) {
      return res.status(409).json({ 
        error: "Lo sentimos, ya no hay disponibilidad para esta fecha y hora. Por favor, selecciona otro horario." 
      });
    }

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
        'confirmada', 
        new Date().toISOString()
      ]
    ];

    // Insertar en Google Sheets
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Reservas';
    
    // Insertar en Google Sheets
    const request = {
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `'${sheetName}'!A:I`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    };

    const response = await sheets.spreadsheets.values.append(request);

    console.log('Reserva confirmada guardada exitosamente en fila:', response.data.updates.updatedRange);

    res.status(200).json({ 
      message: "Reserva confirmada exitosamente",
      id: nextId,
      range: response.data.updates.updatedRange,
      status: "confirmada"
    });

  } catch (err) {
    console.error("Error al guardar reserva:", err);
    res.status(500).json({ 
      error: "Error al procesar la reserva",
      details: err.message 
    });
  }
};

async function checkAvailability(fecha, hora, personas) {
  try {
    console.log(`Verificando disponibilidad final para ${fecha} ${hora} - ${personas} personas`);
    
    // CORRECCIÓN: Usar nombre de la hoja
    const sheetName = process.env.GOOGLE_SHEET_NAME;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `'${sheetName}'!A:I`,
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return true; // No hay reservas, disponible
    }

    // Contar personas ya reservadas en esta fecha y hora
    const confirmedReservations = rows.slice(1)
      .filter(row => {
        const rowFecha = row[5];
        const rowHora = row[6];
        const rowEstado = row[7];
        return rowFecha === fecha && rowHora === hora && rowEstado === 'confirmada';
      });

    const totalPersonasReservadas = confirmedReservations.reduce((sum, row) => {
      return sum + (parseInt(row[4]) || 0);
    }, 0);

    const capacidadMaxima = 50; // Mismo valor que en disponibilidad.js
    const espaciosDisponibles = capacidadMaxima - totalPersonasReservadas;

    console.log(`Fecha: ${fecha}, Hora: ${hora}`);
    console.log(`Personas ya reservadas: ${totalPersonasReservadas}`);
    console.log(`Espacios disponibles: ${espaciosDisponibles}`);
    console.log(`Personas solicitadas: ${personas}`);

    return espaciosDisponibles >= personas;

  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return true;
  }
}

async function getNextId() {
  try {
    // CORRECCIÓN: Usar nombre de la hoja
    const sheetName = process.env.GOOGLE_SHEET_NAME;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `'${sheetName}'!A:A`, // Solo la columna ID
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return 1;
    }

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
    return Date.now(); // Fallback
  }
}