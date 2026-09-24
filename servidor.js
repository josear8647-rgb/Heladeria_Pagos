const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Base de datos en memoria
let pagoActual = { confirmado: false, monto: 0, fecha: null };
let registroVentas = [];

function getFechaHoy() {
    return new Date().toISOString().split('T')[0];
}

// RUTA ULTRA RÁPIDA: Recibe el aviso directamente desde el celular o webhook
app.post('/alerta-bancolombia', (req, res) => {
    const { monto, referencia } = req.body;
    
    let montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
        return res.status(400).json({ error: 'Monto no válido' });
    }

    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    pagoActual = {
        confirmado: true,
        monto: montoNum,
        fecha: horaActual
    };

    registroVentas.push({
        id: Date.now(),
        monto: montoNum,
        hora: horaActual,
        tipo: referencia || 'Bancolombia / Nequi',
        fechaCompleta: getFechaHoy()
    });

    console.log(`⚡ ¡Pago al instante recibido!: $${montoNum}`);
    res.json({ status: 'ok', mensaje: 'Pago registrado al instante' });
});

// RUTAS DE LA API PARA LA PANTALLA
app.get('/estado-pago', (req, res) => res.json(pagoActual));

app.post('/limpiar-pago', (req, res) => {
    pagoActual = { confirmado: false, monto: 0, fecha: null };
    res.json({ status: 'ok' });
});

app.get('/ventas-dia', (req, res) => {
    const fechaHoy = getFechaHoy();
    const ventasHoy = registroVentas.filter(v => v.fechaCompleta === fechaHoy);
    const totalAcumulado = ventasHoy.reduce((acc, curr) => acc + curr.monto, 0);

    res.json({
        total: totalAcumulado,
        cantidad: ventasHoy.length,
        ventas: ventasHoy
    });
});

app.post('/agregar-manual', (req, res) => {
    const { monto, descripcion } = req.body;
    if (!monto || isNaN(monto) || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const nuevaVenta = {
        id: Date.now(),
        monto: parseFloat(monto),
        hora: horaActual,
        tipo: descripcion || 'Manual / Efectivo',
        fechaCompleta: getFechaHoy()
    };

    registroVentas.push(nuevaVenta);
    res.json({ status: 'ok', venta: nuevaVenta });
});

// INTERFAZ WEB COMPLETA (/)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Caja Heladería - Control de Pagos</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eef2f5; text-align: center; padding: 20px; }
        .card { background: white; max-width: 500px; margin: 0 auto 20px auto; padding: 25px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
        h2 { color: #333; margin-bottom: 5px; }
        .status { padding: 20px; font-size: 20px; font-weight: bold; border-radius: 12px; margin: 20px 0; transition: all 0.3s ease; }
        .esperando { background-color: #fff8e1; color: #b78103; border: 2px solid #ffe082; }
        .pagado { background-color: #d4edda; color: #155724; border: 2px solid #c3e6cb; animation: pulse 1s infinite alternate; }
        button { background-color: #0d6efd; color: white; border: none; padding: 10px 18px; font-size: 15px; border-radius: 8px; cursor: pointer; font-weight: bold; margin: 5px; }
        button:hover { background-color: #0b5ed7; }
        .btn-manual { background-color: #198754; }
        .btn-manual:hover { background-color: #157347; }
        .resumen-box { background: #e7f1ff; border: 1px solid #b6d4fe; border-radius: 12px; padding: 15px; margin-top: 15px; text-align: left; }
        .resumen-box h3 { margin: 0 0 10px 0; color: #084298; text-align: center; font-size: 18px; }
        .monto-total { font-size: 28px; font-weight: bold; color: #0a58ca; text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #cfe2ff; color: #084298; }
        input[type="number"], input[type="text"] { padding: 8px; border: 1px solid #ccc; border-radius: 6px; margin: 4px 0; width: 90%; font-size: 14px; }
        @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.02); } }
    </style>
</head>
<body>
    <div class="card">
        <h2>🍦 Heladería - Control de Caja</h2>
        <p style="color: #666; margin-top: 0;">Verificación Instantánea de Transferencias</p>
        <div id="estadoPago" class="status esperando">⏳ Esperando transferencia...</div>
        <button id="btnLimpiar" style="display:none;" onclick="limpiarPantalla()">🔄 Confirmar y Siguiente Pago</button>
    </div>

    <div class="card">
        <h3>➕ Registrar Pago Manual</h3>
        <input type="number" id="montoManual" placeholder="Monto (Ej: 12000)" />
        <input type="text" id="descManual" placeholder="Descripción (Ej: Nequi / Efectivo)" />
        <br>
        <button class="btn-manual" onclick="agregarManual()">💾 Guardar Pago</button>
    </div>

    <div class="card">
        <div class="resumen-box">
            <h3>📊 Resumen de Ventas de Hoy</h3>
            <div class="monto-total" id="txtTotalDia">$0</div>
            <p style="text-align: center; margin: 0; color: #555; font-size: 13px;" id="txtCantVentas">0 pagos registrados</p>
            <table>
                <thead>
                    <tr><th>Hora</th><th>Tipo</th><th>Monto</th></tr>
                </thead>
                <tbody id="cuerpoTabla">
                    <tr><td colspan="3" style="text-align: center;">No hay registros hoy.</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const URL_SERVIDOR = window.location.origin;

        async function consultarPago() {
            try {
                const res = await fetch(\`\${URL_SERVIDOR}/estado-pago\`);
                const data = await res.json();
                if (data.confirmado) {
                    const caja = document.getElementById("estadoPago");
                    caja.className = "status pagado";
                    caja.innerHTML = \`✅ ¡PAGO CONFIRMADO!<br><br><span style="font-size: 30px;">$\${data.monto.toLocaleString('es-CO')}</span><br><small style="font-size: 13px; font-weight: normal;">Hora: \${data.fecha}</small>\`;
                    document.getElementById("btnLimpiar").style.display = "inline-block";
                    cargarVentasDia();
                }
            } catch (err) {}
        }

        async function limpiarPantalla() {
            await fetch(\`\${URL_SERVIDOR}/limpiar-pago\`, { method: 'POST' });
            const caja = document.getElementById("estadoPago");
            caja.className = "status esperando";
            caja.innerHTML = "⏳ Esperando transferencia...";
            document.getElementById("btnLimpiar").style.display = "none";
        }

        async function cargarVentasDia() {
            try {
                const res = await fetch(\`\${URL_SERVIDOR}/ventas-dia\`);
                const data = await res.json();
                document.getElementById("txtTotalDia").innerText = \`$\${data.total.toLocaleString('es-CO')}\`;
                document.getElementById("txtCantVentas").innerText = \`\${data.cantidad} pago(s) registrado(s) hoy\`;
                const tbody = document.getElementById("cuerpoTabla");
                tbody.innerHTML = "";
                if (data.ventas.length === 0) {
                    tbody.innerHTML = \`<tr><td colspan="3" style="text-align: center;">No hay registros hoy.</td></tr>\`;
                    return;
                }
                data.ventas.slice().reverse().forEach(v => {
                    tbody.innerHTML += \`<tr><td>\${v.hora}</td><td>\${v.tipo}</td><td><b>$\${v.monto.toLocaleString('es-CO')}</b></td></tr>\`;
                });
            } catch (err) {}
        }

        async function agregarManual() {
            const monto = document.getElementById("montoManual").value;
            const descripcion = document.getElementById("descManual").value;
            if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
            await fetch(\`\${URL_SERVIDOR}/agregar-manual\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto, descripcion })
            });
            document.getElementById("montoManual").value = "";
            document.getElementById("descManual").value = "";
            cargarVentasDia();
        }

        // Revisa cada 1 segundo para respuesta inmediata
        setInterval(consultarPago, 1000);
        cargarVentasDia();
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`Servidor ultra rápido corriendo en puerto ${PORT}`);
});