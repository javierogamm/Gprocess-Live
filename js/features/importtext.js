/* ============================================================
   IMPORTAR DIAGRAMA DESDE TEXTO
   - Dos pasadas:
     1) Crear nodos y colocarlos
     2) Crear conexiones (en todo caso / sólo si / cambiar estado)
============================================================ */

const ImportText = {

    /* ------------------------------------------
       Inferir tipo de nodo a partir del título
    ------------------------------------------ */
    inferTipo(titulo) {
        const t = (titulo || "").toLowerCase().trim();

        if (!t) return "formulario";

        // Esperas / plazos
        if (t.startsWith("espera ")) return "plazo";
        if (t.startsWith("espera de")) return "plazo";

        // Plazos explícitos
        if (t.startsWith("plazo ") || t.startsWith("plazo de")) return "plazo";

        // Formularios explícitos
        if (t.includes("formulario")) return "formulario";

        // Documentos: informe / acta / certificado
        if (
            t.includes("informe") ||
            t.includes(" acta") ||
            t.startsWith("acta") ||
            t.includes("certificado")
        ) return "documento";

        // Circuitos
        if (
            t.startsWith("circuito") ||
            t.includes("circuito de") ||
            t.startsWith("liquidación") ||
            t.startsWith("liquidacion")
        ) return "circuito";

        return "formulario";
    },

/* ------------------------------------------
   PREVISUALIZAR TEXTO (SIN MODIFICAR MOTOR)
------------------------------------------ */
parsePreview(texto) {
    const lineas = texto.split(/\r?\n/).map(l => l.trimEnd());
    const mapaNodos = new Map();
    const nodos = [];
    const conexiones = [];

    let previewIndex = 0;

    function parseCols(linea, minCols = 5) {
        let cols = linea.split(/\t/g);
        if (cols.length === 1) {
            cols = linea.split(/\s{2,}/g);
        }
        while (cols.length < minCols) cols.push("");
        return cols;
    }

    function matchesTipoCol(value) {
        return /^(formulario|documento|libre|plazo|circuito)/i.test((value || "").trim());
    }

    function isHeaderRow(cols) {
        const first = (cols[0] || "").trim().toLowerCase();
        const second = (cols[1] || "").trim().toLowerCase();
        return (
            (first === "tipo" && second === "asunto") ||
            (first === "asunto" && second === "al finalizar")
        );
    }

    function isActionText(textoLinea) {
        return (
            /^Sólo si/i.test(textoLinea) ||
            /^Lanzar tarea/i.test(textoLinea) ||
            /^Cambiar estado/i.test(textoLinea)
        );
    }

    function isNodeLine(rawLine, columnas) {
        if (!rawLine.trim()) return false;
        const linea = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");
        const cols = parseCols(linea, columnas);
        if (isHeaderRow(cols)) return false;
        return matchesTipoCol(cols[0]) && (cols[1] || "").trim();
    }

    function detectTipoColumn(lines) {
        for (const rawLine of lines) {
            if (!rawLine.trim()) continue;
            if (isActionText(rawLine.trim())) continue;
            const cols = parseCols(rawLine.replace(/^\t+/, "").replace(/^ {4}/, ""), 7);
            if (isHeaderRow(cols)) return true;
            if (matchesTipoCol(cols[0]) && (cols[1] || "").trim()) return true;
            return false;
        }
        return false;
    }

    function normalizeTipo(tipoRaw) {
        const t = (tipoRaw || "").toLowerCase().trim();
        if (!t) return "";
        if (t.includes("formulario")) return "formulario";
        if (t.includes("documento")) return "documento";
        if (t.includes("libre")) return "libre";
        if (t.includes("plazo")) return "plazo";
        if (t.includes("circuito")) return "circuito";
        return "";
    }

    function findAssignedFromBlock(lines, startIndex, columnas) {
        for (let i = startIndex + 1; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine.trim()) continue;
            if (isNodeLine(rawLine, columnas)) break;
            const candidato = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "").trim();
            if (!candidato) continue;
            if (isActionText(candidato)) continue;
            if (/^editar\b/i.test(candidato)) continue;
            if (/^acciones\b/i.test(candidato)) continue;
            if (/ALC\d+/i.test(candidato) || /unidad gestora/i.test(candidato)) {
                return candidato;
            }
        }
        return "";
    }

    function extractTaskTitleFromAction(txt) {
        let rest = txt.replace(/^Lanzar tarea\s+/i, "").trim();
        const pairs = { "'": "'", '"': '"', "“": "”", "‘": "’" };
        const qStart = rest.charAt(0);
        const qEnd = pairs[qStart];
        if (qEnd && rest.endsWith(qEnd)) {
            rest = rest.slice(1, -1);
        }
        return rest.trim();
    }

    const usaTipoCol = detectTipoColumn(lineas);
    const columnasMin = usaTipoCol ? 7 : 5;

    lineas.forEach((rawLine, index) => {
        if (!rawLine.trim()) return;

        const lineaRecortada = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");
        if (!isNodeLine(lineaRecortada, columnasMin)) return;

        const partes = parseCols(lineaRecortada, columnasMin);
        if (isHeaderRow(partes)) return;

        const tipoCol = usaTipoCol ? (partes[0] || "").trim() : "";
        const titulo = (usaTipoCol ? partes[1] : partes[0] || "").trim();
        const asignadoLinea = (usaTipoCol ? partes[3] : partes[2] || "").trim();
        const asignadoExtra = asignadoLinea ? "" : findAssignedFromBlock(lineas, index, columnasMin);
        const asignado = asignadoLinea || asignadoExtra;

        if (!titulo) return;

        const tipoDetectado = normalizeTipo(tipoCol) || this.inferTipo(titulo);
        const nodeId = `preview-node-${previewIndex + 1}`;
        const grupoAsignado = asignado ? [asignado] : [];

        const nodo = {
            id: nodeId,
            tipo: tipoDetectado,
            titulo,
            tareaManual: false,
            asignadosGrupos: grupoAsignado,
            asignadosUsuarios: [],
            __order: previewIndex
        };

        nodos.push(nodo);
        mapaNodos.set(titulo, nodeId);
        previewIndex += 1;
    });

    let nodoActualId = null;
    let condicionesPendientes = [];
    let ultimaConexionId = null;
    let branchIndex = 0;

    lineas.forEach(rawLine => {
        if (!rawLine.trim()) return;

        const linea = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");

        if (isNodeLine(rawLine, columnasMin)) {
            const partes = parseCols(linea, columnasMin);
            if (isHeaderRow(partes)) return;
            const titulo = (usaTipoCol ? partes[1] : partes[0] || "").trim();
            const condTxt = (usaTipoCol ? partes[2] : partes[1] || "").trim();
            nodoActualId = mapaNodos.get(titulo) || null;
            condicionesPendientes = [];
            ultimaConexionId = null;
            branchIndex = 0;

            if (condTxt && /^Sólo si/i.test(condTxt)) {
                const match = condTxt.match(/^Sólo si\s+'([^']+)'\s+es igual a\s+'([^']+)'/i);
                if (match) {
                    condicionesPendientes.push({ campo: match[1], valor: match[2] });
                } else {
                    condicionesPendientes.push({ textoLibre: condTxt });
                }
            }
            return;
        }

        if (!nodoActualId) return;

        const txt = linea.trim();
        if (!isActionText(txt)) return;

        if (/^Sólo si/i.test(txt)) {
            const match = txt.match(/^Sólo si\s+'([^']+)'\s+es igual a\s+'([^']+)'/i);
            if (match) {
                condicionesPendientes.push({ campo: match[1], valor: match[2] });
            } else {
                condicionesPendientes.push({ textoLibre: txt });
            }
            return;
        }

        if (/^Lanzar tarea\s+/i.test(txt)) {
            const destinoTitulo = extractTaskTitleFromAction(txt);
            const destinoId = mapaNodos.get(destinoTitulo);
            if (!destinoId) return;

            let fromPos = "bottom";
            let toPos = "top";

            if (condicionesPendientes.length > 0) {
                if (branchIndex === 0) fromPos = "right";
                else if (branchIndex === 1) fromPos = "left";
                else fromPos = "bottom";
                branchIndex += 1;
            }

            const connId = `preview-conn-${conexiones.length + 1}`;
            const conn = {
                id: connId,
                from: nodoActualId,
                to: destinoId,
                fromPos,
                toPos,
                condicionNombre: "",
                condicionValor: "",
                cambioEstado: ""
            };

            if (condicionesPendientes.length > 0) {
                condicionesPendientes.forEach(cond => {
                    conn.condicionNombre = cond.campo || "";
                    conn.condicionValor = cond.valor || cond.textoLibre || "";
                });
            }

            conexiones.push(conn);
            ultimaConexionId = connId;
            condicionesPendientes = [];
            return;
        }

        const cambiarMatch = txt.match(/^Cambiar estado del expediente a\s+'([^']+)'/i);
        if (cambiarMatch && ultimaConexionId) {
            const conn = conexiones.find(c => c.id === ultimaConexionId);
            if (conn) conn.cambioEstado = cambiarMatch[1];
        }
    });

    return { nodos, conexiones };
},

/* ------------------------------------------
   IMPORTAR TEXTO (REEMPLAZO COMPLETO)
------------------------------------------ */
import(texto) {

    const lineas = texto.split(/\r?\n/).map(l => l.trimEnd());
    const mapaNodos = new Map();

    // === Layout base: grid vertical con salto de columna (semilla) ===
    const area = document.getElementById("canvasArea");
    const container = document.getElementById("nodesContainer");

    const MARGIN = 120;
    const saltoY = 160;            // separación vertical entre filas (semilla)
    const saltoX = 320;            // separación horizontal entre columnas (semilla)
    const viewH  = (area?.clientHeight || 900);
    const viewW  = (area?.clientWidth  || 1400);
    const maxFilas = Math.max(6, Math.floor((viewH - 2 * MARGIN) / saltoY));

    let fila = 0;
    let col  = 0;
    const baseX = Math.max(MARGIN, Math.floor((viewW - saltoX) / 2));
    const baseY = MARGIN;

    // === utilidades de límites y tamaños ==============================
    function getNodeSize(n) {
        return { w: n.width  || 200, h: n.height || 100 };
    }
    function getCanvasBounds() {
        // ⭐ CAMBIO: no crecemos en alto; en ancho permitimos crecer (scrollWidth)
        const w = (container?.scrollWidth || area?.scrollWidth || area?.clientWidth || 1400);
        const h = (container?.scrollHeight || area?.scrollHeight || area?.clientHeight || 4000);        return {
            minX: MARGIN,
            minY: MARGIN,
            maxX: Math.max(MARGIN + 600, w - MARGIN),
            maxY: Math.max(MARGIN + 400, h - MARGIN)
        };
    }
    // Clampeo de una posición (esquina superior-izda del nodo)
    function clampPosition(x, y, n) {
        const { w, h } = getNodeSize(n);
        const B = getCanvasBounds();
        const clampedX = Math.min(Math.max(x, B.minX), B.maxX - w);
        const clampedY = Math.min(Math.max(y, B.minY), B.maxY - h);
        return { x: clampedX, y: clampedY };
    }

    // ----------------------------------------------------
    // Función robusta para dividir columnas del copypaste
    // ----------------------------------------------------
    function parseCols(linea, minCols = 5) {
        let cols = linea.split(/\t/g);
        if (cols.length === 1) {
            cols = linea.split(/\s{2,}/g);
        }
        while (cols.length < minCols) cols.push("");
        return cols;
    }

    function matchesTipoCol(value) {
        return /^(formulario|documento|libre|plazo|circuito)/i.test((value || "").trim());
    }

    function isHeaderRow(cols) {
        const first = (cols[0] || "").trim().toLowerCase();
        const second = (cols[1] || "").trim().toLowerCase();
        return (
            (first === "tipo" && second === "asunto") ||
            (first === "asunto" && second === "al finalizar")
        );
    }

    function isActionText(texto) {
        return (
            /^Sólo si/i.test(texto) ||
            /^Lanzar tarea/i.test(texto) ||
            /^Cambiar estado/i.test(texto)
        );
    }

    function isNodeLine(rawLine, columnas) {
        if (!rawLine.trim()) return false;
        const linea = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");
        const cols = parseCols(linea, columnas);
        if (isHeaderRow(cols)) return false;
        return matchesTipoCol(cols[0]) && (cols[1] || "").trim();
    }

    function detectTipoColumn(lines) {
        for (const rawLine of lines) {
            if (!rawLine.trim()) continue;
            if (isActionText(rawLine.trim())) continue;
            const cols = parseCols(rawLine.replace(/^\t+/, "").replace(/^ {4}/, ""), 7);
            if (isHeaderRow(cols)) return true;
            if (matchesTipoCol(cols[0]) && (cols[1] || "").trim()) return true;
            return false;
        }
        return false;
    }

    function normalizeTipo(tipoRaw) {
        const t = (tipoRaw || "").toLowerCase().trim();
        if (!t) return "";
        if (t.includes("formulario")) return "formulario";
        if (t.includes("documento")) return "documento";
        if (t.includes("libre")) return "libre";
        if (t.includes("plazo")) return "plazo";
        if (t.includes("circuito")) return "circuito";
        return "";
    }

    function findAssignedFromBlock(lines, startIndex, columnas) {
        for (let i = startIndex + 1; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine.trim()) continue;
            if (isNodeLine(rawLine, columnas)) break;
            const candidato = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "").trim();
            if (!candidato) continue;
            if (isActionText(candidato)) continue;
            if (/^editar\b/i.test(candidato)) continue;
            if (/^acciones\b/i.test(candidato)) continue;
            if (/ALC\d+/i.test(candidato) || /unidad gestora/i.test(candidato)) {
                return candidato;
            }
        }
        return "";
    }

    const usaTipoCol = detectTipoColumn(lineas);
    const columnasMin = usaTipoCol ? 7 : 5;

    // ============================================================
    // PRIMERA PASADA: CREAR NODOS (sólo líneas NO indentadas)
    // ============================================================
    lineas.forEach((rawLine, index) => {

        if (!rawLine.trim()) return;

        const lineaRecortada = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");
        if (!isNodeLine(lineaRecortada, columnasMin)) return;

        let linea = lineaRecortada;
        const partes = parseCols(linea, columnasMin);
        if (isHeaderRow(partes)) return;

        const tipoCol  = usaTipoCol ? (partes[0] || "").trim() : "";
        const titulo   = (usaTipoCol ? partes[1] : partes[0] || "").trim();
        const condTxt  = (usaTipoCol ? partes[2] : partes[1] || "").trim();
        const asignadoLinea = (usaTipoCol ? partes[3] : partes[2] || "").trim();
        const asignadoExtra = asignadoLinea ? "" : findAssignedFromBlock(lineas, index, columnasMin);
        const asignado = asignadoLinea || asignadoExtra;

        if (!titulo) return;

        const tipoDetectado = normalizeTipo(tipoCol) || this.inferTipo(titulo);

        // Posición semilla en grid
        let x = baseX + col * saltoX;
        let y = baseY + fila * saltoY;
        fila++;
        if (fila >= maxFilas) { fila = 0; col++; }

        const nodo = Engine.createNode(tipoDetectado);

        // Semilla con clamp
        let clamped = clampPosition(x, y, nodo);
        nodo.x = clamped.x;
        nodo.y = clamped.y;

        const nodeDiv = document.getElementById(nodo.id);
        if (nodeDiv) {
            nodeDiv.style.left = nodo.x + "px";
            nodeDiv.style.top  = nodo.y + "px";
        }

        const nodoReal = Engine.getNode(nodo.id);
        if (nodoReal) {
            nodoReal.titulo    = titulo;
            nodoReal.asignadosGrupos = asignado ? [asignado] : [];

            if (asignado) {
                Engine.addGrupo(asignado);
            }

            if (nodeDiv) {
                const titleDiv = nodeDiv.querySelector(".node-title");
                if (titleDiv) titleDiv.innerText = nodoReal.titulo;
            }
        }

        mapaNodos.set(titulo, nodo.id);
    });

    // Re-render para que se vean los títulos recién puestos
    Renderer.clearAll();
    Engine.data.nodos.forEach(n => Renderer.renderNode(n));
        // --- Helper robusto para extraer el título de "Lanzar tarea ..."
        function extractTaskTitleFromAction(txt) {
            // quita el prefijo
            let rest = txt.replace(/^Lanzar tarea\s+/i, "").trim();

            // si viene entre comillas, quita SOLO la 1ª y la última del mismo tipo
            const pairs = { "'": "'", '"': '"', "“": "”", "‘": "’" };
            const qStart = rest.charAt(0);
            const qEnd   = pairs[qStart];
            if (qEnd && rest.endsWith(qEnd)) {
                rest = rest.slice(1, -1);
            }

            // deja apóstrofos internos tal cual (l'espera, d'informe, etc.)
            return rest.trim();
        }
    // ============================================================
    // SEGUNDA PASADA: CONEXIONES + CONDICIONES + CAMBIO DE ESTADO
    // ============================================================
    let nodoActualId = null;
    let condicionesPendientes = [];
    let ultimaConexionId = null;
    let branchIndex = 0;

    lineas.forEach(rawLine => {
        if (!rawLine.trim()) return;

        let linea = rawLine.replace(/^\t+/, "").replace(/^ {4}/, "");

        // ---------------- LÍNEA DE ASUNTO (no indentada) ----------------
        if (isNodeLine(rawLine, columnasMin)) {
            const partes = parseCols(linea, columnasMin);
            if (isHeaderRow(partes)) return;
            const titulo   = (usaTipoCol ? partes[1] : partes[0] || "").trim();
            const condTxt  = (usaTipoCol ? partes[2] : partes[1] || "").trim();
            nodoActualId = mapaNodos.get(titulo) || null;
            condicionesPendientes = [];
            ultimaConexionId = null;
            branchIndex = 0;

            if (condTxt && /^Sólo si/i.test(condTxt)) {
                const match = condTxt.match(/^Sólo si\s+'([^']+)'\s+es igual a\s+'([^']+)'/i);
                if (match) {
                    condicionesPendientes.push({ campo: match[1], valor: match[2] });
                } else {
                    condicionesPendientes.push({ textoLibre: condTxt });
                }
            }
            return;
        }

        // ---------------- LÍNEAS DE ACCIÓN (indentadas) ----------------
        if (!nodoActualId) return;

        const txt = linea.trim();
        if (!isActionText(txt)) return;
        // 1) Condición
        if (/^Sólo si/i.test(txt)) {
            const match = txt.match(/^Sólo si\s+'([^']+)'\s+es igual a\s+'([^']+)'/i);
            if (match) {
                condicionesPendientes.push({ campo: match[1], valor: match[2] });
            } else {
                condicionesPendientes.push({ textoLibre: txt });
            }
            return;
        }

// 2) Lanzar tarea  (soporta comillas simples/dobles y apóstrofos internos)
if (/^Lanzar tarea\s+/i.test(txt)) {
    const destinoTitulo = extractTaskTitleFromAction(txt);
    const destinoId = mapaNodos.get(destinoTitulo);
    if (!destinoId) return;

    let fromPos = "bottom";
    let toPos   = "top";

    if (condicionesPendientes.length > 0) {
        if      (branchIndex === 0) fromPos = "right";
        else if (branchIndex === 1) fromPos = "left";
        else                        fromPos = "bottom";
        branchIndex++;
    }

    Engine.createConnection(nodoActualId, destinoId, fromPos, toPos);

    // id de la última conexión creada
    let connId = null;
    if (Engine.data.conexiones.length > 0) {
        connId = Engine.data.conexiones[Engine.data.conexiones.length - 1].id;
    }
    ultimaConexionId = connId;

    // Registrar subárbol para usar como grafo
    const p = Engine.getNode(nodoActualId);
    if (p) {
        p.outList = p.outList || [];
        p.outList.push({ id: destinoId, connId });
    }

    // Volcar condiciones en la conexión
    if (connId && condicionesPendientes.length > 0) {
        condicionesPendientes.forEach(cond => {
            Engine.updateConnectionCondition(
                connId,
                cond.campo || "",
                cond.valor || cond.textoLibre || ""
            );
        });
    }
    condicionesPendientes = [];
    return;
}

        // 3) Cambiar estado
        const cambiarMatch = txt.match(/^Cambiar estado del expediente a\s+'([^']+)'/i);
        if (cambiarMatch && ultimaConexionId) {
            Engine.updateConnectionCambioEstado(ultimaConexionId, cambiarMatch[1]);
            return;
        }
    });

    if (window.DataTesauro?.transformarCondicionesDesdeConexiones) {
        DataTesauro.transformarCondicionesDesdeConexiones(Engine.data.conexiones, {
            mostrarAlertas: false
        });
    }

    // -----------------------------------------------------------
    // LAYOUT POR NIVELES (vertical por profundidad; horizontal por “primos”)
    // -----------------------------------------------------------

    // Construir grafo a partir de outList
    const allNodes = Engine.data.nodos.slice();            // copia
    const idToNode = new Map(allNodes.map(n => [n.id, n]));
    const parentsOf = new Map();  // id -> Set(parentIds)
    const childrenOf = new Map(); // id -> Set(childIds)
    const appearanceIndex = new Map(); // orden de aparición estable

    allNodes.forEach((n, idx) => {
        appearanceIndex.set(n.id, idx);
        parentsOf.set(n.id, new Set());
        childrenOf.set(n.id, new Set());
    });

    allNodes.forEach(p => {
        (p.outList || []).forEach(entry => {
            const cid = entry.id || entry;
            if (!idToNode.has(cid)) return;
            childrenOf.get(p.id).add(cid);
            parentsOf.get(cid).add(p.id);
        });
    });

    // --- niveles por CAMINO MÁS LARGO (roots → node) con control de back-edges
    const levelOf = new Map(); // id -> nivel (0..N)
    (function computeLevelsByLongestPath() {
        const reachMemo = new Map();

        function canReach(fromId, targetId, visiting = new Set()) {
            if (fromId === targetId) return true;
            const key = `${fromId}->${targetId}`;
            if (reachMemo.has(key)) return reachMemo.get(key);
            if (visiting.has(fromId)) {
                reachMemo.set(key, false);
                return false;
            }
            visiting.add(fromId);
            const kids = Array.from(childrenOf.get(fromId) || []);
            for (const kid of kids) {
                if (canReach(kid, targetId, visiting)) {
                    reachMemo.set(key, true);
                    visiting.delete(fromId);
                    return true;
                }
            }
            visiting.delete(fromId);
            reachMemo.set(key, false);
            return false;
        }

        allNodes.forEach(n => levelOf.set(n.id, 0));
        const edges = [];
        allNodes.forEach(parent => {
            (childrenOf.get(parent.id) || new Set()).forEach(childId => {
                edges.push({ parentId: parent.id, childId });
            });
        });

        const maxIterations = Math.max(1, allNodes.length * 2);
        for (let iter = 0; iter < maxIterations; iter++) {
            let changed = false;
            edges.forEach(({ parentId, childId }) => {
                const isBackEdge = canReach(childId, parentId);
                if (isBackEdge) return;
                const parentLevel = levelOf.get(parentId) || 0;
                const childLevel = levelOf.get(childId) || 0;
                const candidate = parentLevel + 1;
                if (candidate > childLevel) {
                    levelOf.set(childId, candidate);
                    changed = true;
                }
            });
            if (!changed) break;
        }
    })();

    // --- detectar camino principal (para separar subprocesos)
    const mainPath = new Set();
    const depthToLeaf = new Map();
    (function computeDepthToLeaf() {
        const memo = new Map();
        const visiting = new Set();

        function depthForward(id) {
            if (memo.has(id)) return memo.get(id);
            if (visiting.has(id)) {
                memo.set(id, 0);
                return 0;
            }
            visiting.add(id);
            const kids = Array.from(childrenOf.get(id) || []);
            let d = 0;
            for (const kid of kids) {
                d = Math.max(d, 1 + depthForward(kid));
            }
            visiting.delete(id);
            memo.set(id, d);
            return d;
        }

        allNodes.forEach(n => depthToLeaf.set(n.id, depthForward(n.id)));
    })();

    const roots = allNodes.filter(n => (parentsOf.get(n.id) || new Set()).size === 0);
    let mainRoot = null;
    roots.forEach(r => {
        if (!mainRoot) {
            mainRoot = r;
            return;
        }
        const dr = depthToLeaf.get(r.id) || 0;
        const dm = depthToLeaf.get(mainRoot.id) || 0;
        if (dr > dm) {
            mainRoot = r;
            return;
        }
        if (dr === dm) {
            const ar = appearanceIndex.get(r.id) || 0;
            const am = appearanceIndex.get(mainRoot.id) || 0;
            if (ar < am) mainRoot = r;
        }
    });

    let walker = mainRoot?.id || null;
    while (walker) {
        mainPath.add(walker);
        const kids = Array.from(childrenOf.get(walker) || []);
        if (!kids.length) break;
        kids.sort((a, b) => {
            const da = depthToLeaf.get(a) || 0;
            const db = depthToLeaf.get(b) || 0;
            if (da !== db) return db - da;
            return (appearanceIndex.get(a) || 0) - (appearanceIndex.get(b) || 0);
        });
        walker = kids[0] || null;
        if (mainPath.has(walker)) break;
    }

    const sideByNode = new Map();
    const SUBPROCESS_OFFSET = 360;

    function forceRightByTitle(id) {
        const title = (idToNode.get(id)?.titulo || "").toLowerCase();
        return title.includes("subsanaci");
    }

    function branchRejoinsMain(startId) {
        const visited = new Set();
        const stack = [startId];
        while (stack.length) {
            const currentId = stack.pop();
            if (!currentId || visited.has(currentId)) continue;
            visited.add(currentId);
            const kids = Array.from(childrenOf.get(currentId) || []);
            if (kids.some(kid => mainPath.has(kid))) return true;
            kids.forEach(kid => {
                if (!mainPath.has(kid)) stack.push(kid);
            });
        }
        return false;
    }

    function assignSide(startId, side) {
        const boostForRejoin = branchRejoinsMain(startId) ? 2 : 1;
        const queue = [startId];
        while (queue.length) {
            const currentId = queue.shift();
            if (!currentId || mainPath.has(currentId)) continue;
            if (sideByNode.has(currentId)) continue;
            const finalSide = forceRightByTitle(currentId) ? 1 : side;
            const magnitude = Math.max(1, Math.abs(finalSide)) * boostForRejoin;
            const signedSide = Math.sign(finalSide || 1) * magnitude;
            sideByNode.set(currentId, signedSide);
            const kids = Array.from(childrenOf.get(currentId) || []);
            kids.forEach(kid => {
                if (!mainPath.has(kid)) queue.push(kid);
            });
        }
    }

    mainPath.forEach(pid => {
        const branchKids = Array.from(childrenOf.get(pid) || [])
            .filter(cid => !mainPath.has(cid));
        let localIndex = 0;
        branchKids.forEach(cid => {
            const side = forceRightByTitle(cid) ? 1 : (localIndex % 2 === 0 ? 1 : -1);
            assignSide(cid, side);
            localIndex += 1;
        });
    });

    // Agrupar por nivel
    const levels = [];
    allNodes.forEach(n => {
        const lv = levelOf.get(n.id) || 0;
        if (!levels[lv]) levels[lv] = [];
        levels[lv].push(n.id);
    });

    // Orden en cada nivel (coherencia horizontal)
    function avgParentX(nid) {
        const ps = Array.from(parentsOf.get(nid) || []);
        if (!ps.length) return idToNode.get(nid).x;
        const sum = ps.reduce((acc, pid) => acc + (idToNode.get(pid)?.x || 0), 0);
        return sum / ps.length;
    }
    levels.forEach((arr) => {
        if (!arr) return;
        arr.sort((a, b) => {
            const ax = avgParentX(a), bx = avgParentX(b);
            if (ax !== bx) return ax - bx;
            return (appearanceIndex.get(a) || 0) - (appearanceIndex.get(b) || 0);
        });
    });

    // Colocar niveles dentro de los límites del canvas (vertical por profundidad, horizontal por “primos”)
    let B = getCanvasBounds();

    const utilPaddingX = 40;
    let utilLeftBase   = B.minX + utilPaddingX;
    let utilRightBase  = B.maxX - utilPaddingX;
    let baseUtilWidth  = Math.max(400, utilRightBase - utilLeftBase);

    // ⭐ CAMBIO: si un nivel tiene muchos “primos”, ensanchar el contenedor en X (no en Y)
    const NODE_GAP_X = 90;
    const SIDE_PAD   = 120;

    function getLevelMetrics(ids) {
        let totalWidth = 0;
        let maxHeight = 0;
        ids.forEach((nid, idx) => {
            const { w, h } = getNodeSize(idToNode.get(nid));
            totalWidth += w;
            if (idx > 0) totalWidth += NODE_GAP_X;
            maxHeight = Math.max(maxHeight, h);
        });
        return { totalWidth, maxHeight };
    }

    const maxSideMagnitude = Math.max(
        0,
        ...Array.from(sideByNode.values()).map(v => Math.abs(v))
    );
    const sidePadding = maxSideMagnitude * SUBPROCESS_OFFSET;
    const maxLevelWidth = Math.max(
        baseUtilWidth,
        ...levels.filter(Boolean).map(ids => {
            const metrics = getLevelMetrics(ids);
            return metrics.totalWidth + 2 * SIDE_PAD + sidePadding * 2;
        })
    );
    const neededContainerWidth = MARGIN + maxLevelWidth + MARGIN;

    if (container) {
        const currentW = container.scrollWidth || container.clientWidth || 0;
        if (neededContainerWidth > currentW) {
            container.style.width = `${neededContainerWidth}px`;
        }
    }
    const svg = document.getElementById("svgConnections");
    if (svg) {
        const svgW = Math.max(
            parseInt(svg.getAttribute("width") || "0", 10) || 0,
            container?.scrollWidth || container?.clientWidth || 0,
            neededContainerWidth
        );
        svg.setAttribute("width", `${svgW}`);
    }

    // Recalcular bounds tras posible cambio de ancho
    B = getCanvasBounds();
    utilLeftBase   = B.minX + utilPaddingX;
    utilRightBase  = B.maxX - utilPaddingX;
    baseUtilWidth  = Math.max(400, utilRightBase - utilLeftBase);

    // Vertical (profundidad)
    const TOP_PAD   = 20;
    const GAP_Y     = 180;
    const startY    = B.minY + TOP_PAD;

    // Posicionar por niveles
    let currentY = startY;
    levels.forEach((ids) => {
        if (!ids || !ids.length) return;
        const metrics = getLevelMetrics(ids);
        const levelWidth = Math.max(baseUtilWidth, metrics.totalWidth + 2 * SIDE_PAD + sidePadding * 2);
        const levelLeft = utilLeftBase + (levelWidth - metrics.totalWidth) / 2;

        const preferred = ids.map((nid) => {
            const n = idToNode.get(nid);
            const { w } = getNodeSize(n);
            return { id: nid, node: n, w, preferredX: 0 };
        });

        let cursorX = levelLeft;
        preferred.forEach((item) => {
            item.preferredX = cursorX;
            cursorX += item.w + NODE_GAP_X;
        });

        preferred.forEach((item) => {
            const nid = item.id;
            const myLevel = levelOf.get(nid) || 0;
            const hasBackEdge = Array.from(childrenOf.get(nid) || [])
                .some(tid => (levelOf.get(tid) || 0) < myLevel);
            if (hasBackEdge) {
                item.preferredX += 140;
            }
            if (sideByNode.has(nid)) {
                item.preferredX += sideByNode.get(nid) * SUBPROCESS_OFFSET;
            }
        });

        preferred.sort((a, b) => a.preferredX - b.preferredX);

        let prevRight = -Infinity;
        preferred.forEach((item) => {
            const minX = prevRight === -Infinity ? item.preferredX : prevRight + NODE_GAP_X;
            item.x = Math.max(item.preferredX, minX);
            prevRight = item.x + item.w;
        });

        let levelMinX = Infinity;
        let levelMaxX = -Infinity;
        preferred.forEach((item) => {
            levelMinX = Math.min(levelMinX, item.x);
            levelMaxX = Math.max(levelMaxX, item.x + item.w);
        });
        const spanWidth = levelMaxX - levelMinX;
        const availableLeft = utilLeftBase;
        const targetLeft = availableLeft + (levelWidth - spanWidth) / 2;
        const shift = targetLeft - levelMinX;

        preferred.forEach((item) => {
            let tx = item.x + shift;
            const ty = currentY;
            const cl = clampPosition(tx, ty, item.node);
            item.node.x = cl.x;
            item.node.y = cl.y;
            const div = document.getElementById(item.node.id);
            if (div) { div.style.left = item.node.x + "px"; div.style.top = item.node.y + "px"; }
        });

        currentY += metrics.maxHeight + GAP_Y;
    });

    // (Opcional) Forzar conexiones verticales
    /*
    Engine.data.conexiones.forEach(conn => {
        conn.fromPos = "bottom";
        conn.toPos = "top";
    });
    */

    // ===========================================================
    // NORMALIZAR Y AJUSTAR A ÁREA (fit + márgenes seguros)
    // ===========================================================
    (function normalizeAndFit() {

        if (!Engine.data.nodos.length) return;

        // 1) BBox actual
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        Engine.data.nodos.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + (n.width || 200));
            maxY = Math.max(maxY, n.y + (n.height || 100));
        });

        // 2) Desplazar si toca margen superior/izquierdo
        let shiftX = 0, shiftY = 0;
        const B2 = getCanvasBounds();

        if (minX < B2.minX) shiftX = B2.minX - minX;
        if (minY < B2.minY) shiftY = B2.minY - minY;

        if (shiftX !== 0 || shiftY !== 0) {
            Engine.data.nodos.forEach(n => {
                const trialX = n.x + shiftX;
                const trialY = n.y + shiftY;
                const cl = clampPosition(trialX, trialY, n);
                n.x = cl.x; n.y = cl.y;
                const div = document.getElementById(n.id);
                if (div) { div.style.left = n.x + "px"; div.style.top = n.y + "px"; }
            });
        }

        // 3) Fit si sobrepasa el área útil (con clamp posterior)
        let bboxMinX = Infinity, bboxMinY = Infinity, bboxMaxX = -Infinity, bboxMaxY = -Infinity;
        Engine.data.nodos.forEach(n => {
            bboxMinX = Math.min(bboxMinX, n.x);
            bboxMinY = Math.min(bboxMinY, n.y);
            bboxMaxX = Math.max(bboxMaxX, n.x + (n.width || 200));
            bboxMaxY = Math.max(bboxMaxY, n.y + (n.height || 100));
        });

        const width  = bboxMaxX - bboxMinX;
        const height = bboxMaxY - bboxMinY;

        const availW = (B2.maxX - B2.minX);
        const availH = (B2.maxY - B2.minY);

        const sW = availW / width;
        const sH = availH / height;
        const scale = Math.min(1, sW, sH);

        if (scale < 0.98) {
            Engine.data.nodos.forEach(n => {
                const sx = B2.minX + (n.x - bboxMinX) * scale;
                const sy = B2.minY + (n.y - bboxMinY) * scale;
                const cl = clampPosition(Math.round(sx), Math.round(sy), n);
                n.x = cl.x; n.y = cl.y;
                const div = document.getElementById(n.id);
                if (div) { div.style.left = n.x + "px"; div.style.top = n.y + "px"; }
            });
        }

        // 4) Centrar la vista
        if (area) {
            let vMinX = Infinity, vMinY = Infinity, vMaxX = -Infinity, vMaxY = -Infinity;
            Engine.data.nodos.forEach(n => {
                vMinX = Math.min(vMinX, n.x);
                vMinY = Math.min(vMinY, n.y);
                vMaxX = Math.max(vMaxX, n.x + (n.width || 200));
                vMaxY = Math.max(vMaxY, n.y + (n.height || 100));
            });
            const bboxW = vMaxX - vMinX;
            const bboxH = vMaxY - vMinY;
            area.scrollLeft = Math.max(0, (vMinX + bboxW/2) - area.clientWidth/2);
            area.scrollTop  = Math.max(0, (vMinY + bboxH/2) - area.clientHeight/2);
        }
    })();

    // Redibujar y guardar
    Renderer.redrawConnections();
    Engine.saveHistory();

    // Saneador final (idempotente)
    Engine.data.nodos.forEach(n => {
        const cl = clampPosition(n.x, n.y, n);
        if (cl.x !== n.x || cl.y !== n.y) {
            n.x = cl.x; n.y = cl.y;
            const div = document.getElementById(n.id);
            if (div) { div.style.left = n.x + "px"; div.style.top = n.y + "px"; }
        }
    });
}

};

if (typeof window !== "undefined") {
  window.ImportText = ImportText;
} else if (typeof global !== "undefined") {
  global.ImportText = ImportText;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ImportText };
}
