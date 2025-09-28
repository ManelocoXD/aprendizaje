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

// Configuración del restaurante
const RESTAURANT_CONFIG = {
  // Horarios de apertura por día de la semana (0=Domingo, 6=Sábado)
  openingHours: {
    0: null, // Domingo: Cerrado
    1: { start: '12:00', end: '23:00' }, // Lunes
    2: { start: '12:00', end: '23:00' }, // Martes  
    3: { start: '12:00', end: '23:00' }, // Miércoles
    4: { start: '12:00', end: '23:00' }, // Jueves
    5: { start: '12:00', end: '23:30' }, // Viernes
    6: { start: '12:00', end: '23:30' }  // Sábado
  },
  
  // Capacidad total del restaurante
  maxCapacity: 50,
  
  // Turnos disponibles (intervalos de 30 minutos)
  timeSlots: [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'
  ],
  
  // Días especiales cerrados (formato YYYY-MM-DD)
  closedDates: [
    '2025-12-25', // Navidad
    '2025-12-31', // Nochevieja
    '2026-01-01'  // Año nuevo
  ]
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const { fecha, personas } = req.query;

  try {
    if (fecha) {
      // Consultar disponibilidad para una fecha específica
      const availability = await checkDateAvailability(fecha, personas ? parseInt(personas) : 1);
      res.status(200).json(availability);
    } else {
      // Obtener disponibilidad general para los próximos 30 días
      const monthAvailability = await getMonthAvailability();
      res.status(200).json(monthAvailability);
    }

  } catch (err) {
    console.error("Error al consultar disponibilidad:", err);
    res.status(500).json({ 
      error: "Error al consultar disponibilidad",
      details: err.message 
    });
  }
};

async function checkDateAvailability(fecha, personas) {
  try {
    console.log(`Consultando disponibilidad para ${fecha}, ${personas} personas`);

    // Verificar si es una fecha válida
    const date = new Date(fecha);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      return {
        fecha,
        available: false,
        reason: 'Fecha pasada',
        availableSlots: []
      };
    }

    // Verificar si está cerrado ese día
    const dayOfWeek = date.getDay();
    if (!RESTAURANT_CONFIG.openingHours[dayOfWeek]) {
      return {
        fecha,
        available: false,
        reason: 'Restaurante cerrado',
        availableSlots: []
      };
    }

    // Verificar días especiales cerrados
    if (RESTAURANT_CONFIG.closedDates.includes(fecha)) {
      return {
        fecha,
        available: false,
        reason: 'Día especial cerrado',
        availableSlots: []
      };
    }

    // Obtener reservas existentes para esta fecha
    const existingReservations = await getReservationsForDate(fecha);
    
    // Calcular capacidad disponible por horario
    const availableSlots = [];
    const openingHours = RESTAURANT_CONFIG.openingHours[dayOfWeek];
    
    for (const timeSlot of RESTAURANT_CONFIG.timeSlots) {
      // Verificar si el horario está dentro del horario de apertura
      if (timeSlot >= openingHours.start && timeSlot <= openingHours.end) {
        const reservationsAtThisTime = existingReservations.filter(r => r.hora === timeSlot);
        const totalPeopleAtThisTime = reservationsAtThisTime.reduce((sum, r) => sum + r.personas, 0);
        const availableCapacity = RESTAURANT_CONFIG.maxCapacity - totalPeopleAtThisTime;
        
        if (availableCapacity >= personas) {
          availableSlots.push({
            time: timeSlot,
            availableSpaces: availableCapacity,
            reservationsCount: reservationsAtThisTime.length
          });
        }
      }
    }

    return {
      fecha,
      available: availableSlots.length > 0,
      reason: availableSlots.length > 0 ? null : 'Sin disponibilidad',
      availableSlots,
      dayOfWeek: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dayOfWeek],
      openingHours: RESTAURANT_CONFIG.openingHours[dayOfWeek]
    };

  } catch (error) {
    console.error('Error checking date availability:', error);
    throw error;
  }
}

async function getReservationsForDate(fecha) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:I',
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) return [];

    // Filtrar reservas confirmadas para esta fecha
    const reservations = rows.slice(1)
      .filter(row => row[5] === fecha && row[7] === 'confirmada') // fecha y estado confirmada
      .map(row => ({
        id: row[0],
        nombre: row[1],
        telefono: row[2],
        email: row[3],
        personas: parseInt(row[4]) || 0,
        fecha: row[5],
        hora: row[6],
        estado: row[7]
      }));

    console.log(`Encontradas ${reservations.length} reservas confirmadas para ${fecha}`);
    return reservations;

  } catch (error) {
    console.error('Error getting reservations for date:', error);
    throw error;
  }
}

async function getMonthAvailability() {
  try {
    const today = new Date();
    const monthData = {};
    
    // Obtener disponibilidad para los próximos 30 días
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayAvailability = await checkDateAvailability(dateString, 1);
      monthData[dateString] = {
        available: dayAvailability.available,
        reason: dayAvailability.reason,
        slotsCount: dayAvailability.availableSlots.length,
        dayOfWeek: dayAvailability.dayOfWeek
      };
    }

    return {
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      availability: monthData,
      restaurantConfig: {
        openingHours: RESTAURANT_CONFIG.openingHours,
        maxCapacity: RESTAURANT_CONFIG.maxCapacity
      }
    };

  } catch (error) {
    console.error('Error getting month availability:', error);
    throw error;
  }
}