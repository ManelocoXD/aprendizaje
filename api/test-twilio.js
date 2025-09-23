const twilio = require("twilio");

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    console.log('Testing Twilio credentials...');
    console.log('TWILIO_SID:', process.env.TWILIO_SID ? 'Set' : 'Not set');
    console.log('TWILIO_TOKEN:', process.env.TWILIO_TOKEN ? 'Set' : 'Not set');
    console.log('TWILIO_FROM:', process.env.TWILIO_FROM);

    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN || !process.env.TWILIO_FROM) {
      return res.status(400).json({
        error: "Faltan variables de entorno de Twilio",
        missing: {
          TWILIO_SID: !process.env.TWILIO_SID,
          TWILIO_TOKEN: !process.env.TWILIO_TOKEN,
          TWILIO_FROM: !process.env.TWILIO_FROM
        }
      });
    }

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    
    // Verificar la cuenta
    const account = await client.api.accounts(process.env.TWILIO_SID).fetch();
    
    res.status(200).json({
      success: true,
      message: "Credenciales de Twilio válidas",
      accountSid: account.sid,
      accountStatus: account.status,
      friendlyName: account.friendlyName,
      twilioNumber: process.env.TWILIO_FROM
    });
    
  } catch (err) {
    console.error("Error al verificar Twilio:", err);
    res.status(500).json({
      error: "Error al conectar con Twilio",
      details: err.message,
      code: err.code || 'UNKNOWN'
    });
  }
};