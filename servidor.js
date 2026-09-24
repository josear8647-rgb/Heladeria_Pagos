const express = require('express');
const path = require('path');
const fs = require('fs');
const imaps = require('imaps');
const simpleParser = require('mailparser').simpleParser;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const ARCHIVO_HISTORIAL = path.join(__dirname, 'contabilidad.json');

// ⚙️ CONFIGURACIÓN DE TU GMAIL Y BANCOLOMBIA
const CONFIG_CORREO = {
    imap: {
        user: 'josear8647@gmail.com',         // 👈 Reemplaza por el correo
        password: 'ucqxfdqphfmmczvd',      // 👈 Reemplaza por la clave de 16 letras de aplicación
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    }
};

function cargarHistorial() {
    try {
        if (fs.existsSync(ARCHIVO_HISTORIAL)) {
            return JSON.parse(fs.readFileSync(ARCHIVO_HISTORIAL, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function guardarHistorial(historial) {
    try {
        fs.writeFileSync(ARCHIVO_HISTORIAL, JSON.stringify(historial, null, 2), 'utf8');
    } catch (e) {}
}

let ultimoPagoRegistrado = null;
let historialPagos = cargarHistorial();

function registrarVenta(monto, descripcion) {
    let nuevoPago = {
        id: Date.now(),
        monto: monto,
        descripcion: descripcion,
        fecha: new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })
    };
    ultimoPagoRegistrado = nuevoPago;
    historialPagos.unshift(nuevoPago);
    guardarHistorial(historialPagos);
    console.log(`🎉 ¡PAGO RECONOCIDO E INGRESADO!: $${monto} - ${descripcion}`);
}

// 📬 FUNCIÓN PARA REVISAR GMAIL CADA 5 SEGUNDOS
async function revisarCorreosBancolombia() {
    try {
        const connection = await imaps.connect(CONFIG_CORREO);
        await connection.openBox('INBOX');

        // Busca correos NO LEÍDOS
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: [''], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (let item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;
            const idData = item.attributes.struct;
            
            const mail = await simpleParser(all.body);
            const asunto = mail.subject || '';
            const texto = mail.text || mail.html || '';

            console.log(`📩 Correo recibido con asunto: "${asunto}"`);

            // Validar si el correo viene de Bancolombia o Nequi
            if (asunto.includes('transferencia') || asunto.includes('recibiste') || texto.includes('Bancolombia') || texto.includes('Nequi')) {
                
                // Buscar el monto ($10.000 o $10,000)
                let coincidencia = texto.match(/\$\s*([\d\.\,]+)/);
                if (coincidencia && coincidencia[1]) {
                    let montoLimpio = parseInt(coincidencia[1].replace(/\./g, '').replace(',', ''), 10);
                    if (montoLimpio > 0) {
                        registrarVenta(montoLimpio, 'Transferencia Bancolombia / Nequi');
                    }
                }
            }
        }
        connection.end();
    } catch (error) {
        console.log('⏳ Esperando correo o revisando conexión...', error.message);
    }
}

// Revisa el correo automáticamente cada 5 segundos
setInterval(revisarCorreosBancolombia, 5000);

// RUTAS DEL SERVIDOR
app.post('/pago-manual', (req, res) => {
    let monto = parseInt(req.body.monto, 10);
    let desc = req.body.descripcion || 'Manual';
    if (monto > 0) {
        registrarVenta(monto, desc);
        return res.json({ exito: true });
    }
    res.status(400).json({ exito: false });
});

app.get('/consultar-pago', (req, res) => {
    if (ultimoPagoRegistrado) {
        let pago = ultimoPagoRegistrado;
        ultimoPagoRegistrado = null;
        res.json({ nuevoPago: true, pago: pago });
    } else {
        res.json({ nuevoPago: false });
    }
});

app.get('/historial', (req, res) => {
    res.json({ historial: historialPagos });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));