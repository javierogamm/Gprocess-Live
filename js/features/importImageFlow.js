(function () {
  const CDN_TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const CDN_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const CDN_PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const state = {
    libsReady: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    const el = $("imageFlowStatus");
    if (el) el.textContent = message;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "1") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureLibraries() {
    if (state.libsReady) return;

    await loadScript(CDN_TESSERACT);
    await loadScript(CDN_PDFJS);

    if (!window.Tesseract) throw new Error("Tesseract no está disponible en este navegador.");
    if (!window.pdfjsLib) throw new Error("PDF.js no está disponible en este navegador.");

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDFJS_WORKER;
    state.libsReady = true;
  }

  function cleanText(raw) {
    return String(raw || "")
      .replace(/[|_]{2,}/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isUsefulToken(token) {
    if (!token) return false;
    const txt = cleanText(token.text || token.str || "");
    if (!txt) return false;
    if (/^[^\p{L}\p{N}]+$/u.test(txt)) return false;
    if (txt.length === 1 && !/[a-záéíóúüñ0-9]/i.test(txt)) return false;
    return true;
  }

  function isConnectorTokenText(text) {
    const t = cleanText(text).toLowerCase();
    if (!t) return false;
    return /^(?:->|=>|>|<|→|←|↔|↕|⟶|⟵|↓|↑|⇢|⇠|=?>|<?=)$/.test(t);
  }

  function normalizeToken(token) {
    const text = cleanText(token.text || token.str || "");
    const left = Number.isFinite(token.left) ? token.left : 0;
    const top = Number.isFinite(token.top) ? token.top : 0;
    const width = Math.max(2, Number.isFinite(token.width) ? token.width : 8);
    const height = Math.max(2, Number.isFinite(token.height) ? token.height : 8);
    return {
      text,
      left,
      top,
      right: left + width,
      bottom: top + height,
      cx: left + width / 2,
      cy: top + height / 2,
      width,
      height,
      confidence: Number.isFinite(token.confidence) ? token.confidence : 100
    };
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function splitTokens(rawWords, confidenceFloor = 35) {
    const words = (rawWords || []).map((w) => ({
      text: w.text,
      left: w.left,
      top: w.top,
      width: w.width,
      height: w.height,
      confidence: w.confidence
    }));

    const nodesTokens = words
      .filter(isUsefulToken)
      .map(normalizeToken)
      .filter((w) => w.confidence >= confidenceFloor || w.text.length >= 5)
      .filter((w) => !isConnectorTokenText(w.text));

    const connectorTokens = words
      .map(normalizeToken)
      .filter((w) => isConnectorTokenText(w.text));

    return { nodesTokens, connectorTokens };
  }

  async function extractImageTokens(file) {
    const result = await window.Tesseract.recognize(file, "spa+eng");
    const rawWords = (result?.data?.words || [])
      .map((w) => ({
        text: w.text,
        left: w.bbox?.x0,
        top: w.bbox?.y0,
        width: (w.bbox?.x1 || 0) - (w.bbox?.x0 || 0),
        height: (w.bbox?.y1 || 0) - (w.bbox?.y0 || 0),
        confidence: w.confidence
      }));
    const { nodesTokens, connectorTokens } = splitTokens(rawWords, 35);

    return {
      tokens: nodesTokens,
      connectorTokens,
      sourceWidth: result?.data?.imageSize?.width || 1600,
      sourceHeight: result?.data?.imageSize?.height || 900,
      mode: "ocr-image"
    };
  }

  async function extractPdfTokensFromTextLayer(file) {
    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const all = [];
    let maxW = 0;
    let sumH = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const content = await page.getTextContent();

      maxW = Math.max(maxW, viewport.width);
      const pageYOffset = sumH;
      sumH += viewport.height + 80;

      for (const item of content.items || []) {
        const txt = cleanText(item.str || "");
        if (!txt) continue;

        const tx = item.transform || [1, 0, 0, 1, 0, 0];
        const x = tx[4] || 0;
        const y = tx[5] || 0;
        const h = Math.abs(tx[3]) || item.height || 10;
        const w = Math.max(item.width || txt.length * h * 0.5, 8);

        all.push({
          text: txt,
          left: x,
          top: pageYOffset + (viewport.height - y - h),
          width: w,
          height: h,
          confidence: 100
        });
      }
    }

    const { nodesTokens, connectorTokens } = splitTokens(all, 0);
    return {
      tokens: nodesTokens,
      connectorTokens,
      sourceWidth: maxW || 1600,
      sourceHeight: sumH || 1200,
      mode: "pdf-text-layer"
    };
  }

  async function renderPdfPageToCanvas(page) {
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  async function extractPdfTokensWithOCR(file) {
    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const all = [];
    let maxW = 0;
    let sumH = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const canvas = await renderPdfPageToCanvas(page);
      maxW = Math.max(maxW, canvas.width);

      const result = await window.Tesseract.recognize(canvas, "spa+eng");
      const words = (result?.data?.words || []).map((w) => ({
        text: w.text,
        left: w.bbox?.x0,
        top: (w.bbox?.y0 || 0) + sumH,
        width: (w.bbox?.x1 || 0) - (w.bbox?.x0 || 0),
        height: (w.bbox?.y1 || 0) - (w.bbox?.y0 || 0),
        confidence: w.confidence
      }));
      all.push(...words);
      sumH += canvas.height + 80;
    }

    const { nodesTokens, connectorTokens } = splitTokens(all, 35);
    return {
      tokens: nodesTokens,
      connectorTokens,
      sourceWidth: maxW || 1600,
      sourceHeight: sumH || 1200,
      mode: "pdf-ocr"
    };
  }

  function shouldMergeCluster(cluster, token, gapX, gapY) {
    const overlapY = Math.max(0, Math.min(cluster.bottom, token.bottom) - Math.max(cluster.top, token.top));
    const minH = Math.min(cluster.height, token.height);
    const horizontalNear = token.left <= cluster.right + gapX && token.right >= cluster.left - gapX;
    const verticalNear = token.top <= cluster.bottom + gapY && token.bottom >= cluster.top - gapY;
    const lineAligned = overlapY >= minH * 0.3;
    return horizontalNear && verticalNear && (lineAligned || Math.abs(token.top - cluster.top) <= gapY);
  }

  function clusterTokens(tokens) {
    if (!tokens.length) return [];
    const medianH = median(tokens.map((t) => t.height)) || 12;
    const gapX = Math.max(18, medianH * 2.2);
    const gapY = Math.max(12, medianH * 1.4);

    const sorted = [...tokens].sort((a, b) => (a.top - b.top) || (a.left - b.left));
    const clusters = [];

    for (const token of sorted) {
      let target = null;
      for (let i = clusters.length - 1; i >= 0; i -= 1) {
        if (shouldMergeCluster(clusters[i], token, gapX, gapY)) {
          target = clusters[i];
          break;
        }
      }

      if (!target) {
        clusters.push({
          tokens: [token],
          left: token.left,
          top: token.top,
          right: token.right,
          bottom: token.bottom,
          width: token.width,
          height: token.height
        });
      } else {
        target.tokens.push(token);
        target.left = Math.min(target.left, token.left);
        target.top = Math.min(target.top, token.top);
        target.right = Math.max(target.right, token.right);
        target.bottom = Math.max(target.bottom, token.bottom);
        target.width = target.right - target.left;
        target.height = target.bottom - target.top;
      }
    }

    return clusters
      .map((cluster) => {
        const ordered = [...cluster.tokens].sort((a, b) => (a.top - b.top) || (a.left - b.left));
        const lineBreakY = Math.max(14, median(ordered.map((o) => o.height)) * 1.1);
        const lines = [];

        for (const tok of ordered) {
          const last = lines[lines.length - 1];
          if (!last || Math.abs(last.y - tok.top) > lineBreakY) {
            lines.push({ y: tok.top, parts: [tok] });
          } else {
            last.parts.push(tok);
          }
        }

        const label = lines
          .map((line) => line.parts.sort((a, b) => a.left - b.left).map((p) => p.text).join(" "))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        return {
          label,
          left: cluster.left,
          top: cluster.top,
          right: cluster.right,
          bottom: cluster.bottom,
          width: cluster.width,
          height: cluster.height,
          cx: (cluster.left + cluster.right) / 2,
          cy: (cluster.top + cluster.bottom) / 2
        };
      })
      .filter((n) => n.label && n.label.length >= 2)
      .filter((n) => !/^\d+(\.\d+)?$/.test(n.label));
  }

  function groupRows(nodes) {
    const sorted = [...nodes].sort((a, b) => a.cy - b.cy);
    const rowTolerance = Math.max(26, median(nodes.map((n) => n.height)) * 2.2);
    const rows = [];

    for (const node of sorted) {
      const row = rows.find((r) => Math.abs(r.cy - node.cy) <= rowTolerance);
      if (!row) {
        rows.push({ cy: node.cy, nodes: [node] });
      } else {
        row.nodes.push(node);
        row.cy = median(row.nodes.map((n) => n.cy));
      }
    }

    rows.forEach((row) => row.nodes.sort((a, b) => a.cx - b.cx));
    rows.sort((a, b) => a.cy - b.cy);
    return rows;
  }

  function dedupeNodes(nodes) {
    const byLabel = new Map();
    for (const node of nodes) {
      const key = node.label.toLowerCase();
      if (!byLabel.has(key)) {
        byLabel.set(key, node);
        continue;
      }
      const prev = byLabel.get(key);
      const areaPrev = prev.width * prev.height;
      const areaCurr = node.width * node.height;
      if (areaCurr > areaPrev) byLabel.set(key, node);
    }
    return Array.from(byLabel.values());
  }

  function hasConnectorBetween(from, to, connectorTokens) {
    if (!Array.isArray(connectorTokens) || !connectorTokens.length) return false;
    const margin = 30;
    const minX = Math.min(from.cx, to.cx) - margin;
    const maxX = Math.max(from.cx, to.cx) + margin;
    const minY = Math.min(from.cy, to.cy) - margin;
    const maxY = Math.max(from.cy, to.cy) + margin;
    return connectorTokens.some((c) => c.cx >= minX && c.cx <= maxX && c.cy >= minY && c.cy <= maxY);
  }

  function hasIntermediateNodeBetween(from, to, nodes, axis) {
    const pad = 16;
    if (axis === "h") {
      const minX = Math.min(from.cx, to.cx) + pad;
      const maxX = Math.max(from.cx, to.cx) - pad;
      const minY = Math.min(from.cy, to.cy) - 26;
      const maxY = Math.max(from.cy, to.cy) + 26;
      return nodes.some((n) => n.id !== from.id && n.id !== to.id && n.cx >= minX && n.cx <= maxX && n.cy >= minY && n.cy <= maxY);
    }

    const minY = Math.min(from.cy, to.cy) + pad;
    const maxY = Math.max(from.cy, to.cy) - pad;
    const minX = Math.min(from.cx, to.cx) - 40;
    const maxX = Math.max(from.cx, to.cx) + 40;
    return nodes.some((n) => n.id !== from.id && n.id !== to.id && n.cy >= minY && n.cy <= maxY && n.cx >= minX && n.cx <= maxX);
  }

  function seemsConnectedByGeometry(from, to, nodes, metrics) {
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const maxGapX = Math.max(90, metrics.medianWidth * 2.6);
    const maxGapY = Math.max(90, metrics.medianHeight * 3.0);

    const horizontal = dx > 0 && absDy <= Math.max(22, metrics.rowTolerance * 0.8) && absDx <= maxGapX;
    if (horizontal && !hasIntermediateNodeBetween(from, to, nodes, "h")) return true;

    const vertical = dy > 0 && absDx <= Math.max(42, metrics.colTolerance * 1.1) && absDy <= maxGapY;
    if (vertical && !hasIntermediateNodeBetween(from, to, nodes, "v")) return true;

    return false;
  }

  function inferEdges(nodes, connectorTokens) {
    const rows = groupRows(nodes);
    const edges = [];
    const seen = new Set();
    const metrics = {
      medianWidth: median(nodes.map((n) => n.width)) || 120,
      medianHeight: median(nodes.map((n) => n.height)) || 60,
      rowTolerance: Math.max(26, median(nodes.map((n) => n.height)) * 2.2),
      colTolerance: Math.max(42, median(nodes.map((n) => n.width)) * 0.6)
    };
    const hasConnectorHints = Array.isArray(connectorTokens) && connectorTokens.length > 0;

    function addEdge(from, to) {
      if (!from || !to || from.id === to.id) return;
      const key = `${from.id}->${to.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from: from.id, to: to.id });
    }

    for (const row of rows) {
      for (let i = 0; i < row.nodes.length - 1; i += 1) {
        const from = row.nodes[i];
        const to = row.nodes[i + 1];
        const byConnector = hasConnectorHints && hasConnectorBetween(from, to, connectorTokens);
        const byGeometry = !hasConnectorHints && seemsConnectedByGeometry(from, to, nodes, metrics);
        if (byConnector || byGeometry) addEdge(from, to);
      }
    }

    for (let r = 0; r < rows.length - 1; r += 1) {
      const current = rows[r].nodes;
      const next = rows[r + 1].nodes;

      for (const n of current) {
        let best = null;
        let bestDist = Infinity;
        for (const candidate of next) {
          const dx = Math.abs(candidate.cx - n.cx);
          const dy = candidate.cy - n.cy;
          if (dy <= 0) continue;
          if (dx > metrics.colTolerance) continue;
          const dist = dy + dx * 0.7;
          if (dist < bestDist) {
            best = candidate;
            bestDist = dist;
          }
        }

        if (!best) continue;
        const byConnector = hasConnectorHints && hasConnectorBetween(n, best, connectorTokens);
        const byGeometry = !hasConnectorHints && seemsConnectedByGeometry(n, best, nodes, metrics);
        if (byConnector || byGeometry) addEdge(n, best);
      }
    }

    return edges;
  }

  function mapToCanvas(nodes, sourceWidth, sourceHeight) {
    const minX = Math.min(...nodes.map((n) => n.left));
    const maxX = Math.max(...nodes.map((n) => n.right));
    const minY = Math.min(...nodes.map((n) => n.top));
    const maxY = Math.max(...nodes.map((n) => n.bottom));

    const boxW = Math.max(200, maxX - minX);
    const boxH = Math.max(120, maxY - minY);

    const canvasW = Math.max(sourceWidth || 1800, 1400);
    const canvasH = Math.max(sourceHeight || 1200, 900);

    const marginX = 120;
    const marginY = 100;
    const targetW = Math.max(400, canvasW - marginX * 2);
    const targetH = Math.max(300, canvasH - marginY * 2);

    const scale = Math.min(targetW / boxW, targetH / boxH);

    const usedW = boxW * scale;
    const usedH = boxH * scale;
    const offsetX = marginX + (targetW - usedW) / 2;
    const offsetY = marginY + (targetH - usedH) / 2;

    return nodes.map((n) => {
      const nx = Math.round(offsetX + (n.left - minX) * scale);
      const ny = Math.round(offsetY + (n.top - minY) * scale);
      return {
        ...n,
        drawX: nx,
        drawY: ny
      };
    });
  }

  function resolveOverlaps(nodes) {
    const width = 144;
    const height = 68;
    const pad = 18;
    const placed = [];

    for (const node of [...nodes].sort((a, b) => (a.drawY - b.drawY) || (a.drawX - b.drawX))) {
      let x = node.drawX;
      let y = node.drawY;
      let moved = false;

      for (let attempts = 0; attempts < 40; attempts += 1) {
        const collides = placed.some((p) => {
          const overlapX = x < p.drawX + width + pad && x + width + pad > p.drawX;
          const overlapY = y < p.drawY + height + pad && y + height + pad > p.drawY;
          return overlapX && overlapY;
        });

        if (!collides) break;

        moved = true;
        const shiftX = (attempts % 4 === 0) ? width + pad : ((attempts % 4 === 1) ? -(width + pad) : 0);
        const shiftY = (attempts % 4 >= 2) ? height + pad : 0;
        x += shiftX;
        y += shiftY;
      }

      placed.push({ ...node, drawX: x, drawY: y, moved });
    }

    return placed;
  }

  function chooseNodeType(label) {
    const text = (label || "").toLowerCase();
    if (text.includes("?") || text.startsWith("si ") || text.startsWith("no ")) return "decision";
    if (text.includes("plazo") || text.includes("día") || text.includes("dias")) return "plazo";
    return "formulario";
  }

  function buildFlowFromTokens(extraction) {
    const clustered = clusterTokens(extraction.tokens);
    const filtered = dedupeNodes(clustered).filter((n) => n.label.length <= 120);

    if (!filtered.length) {
      throw new Error("No se detectaron nodos con texto útil. Prueba con una imagen más nítida o PDF digital.");
    }

    const positionedRaw = mapToCanvas(filtered, extraction.sourceWidth, extraction.sourceHeight)
      .map((n, idx) => ({ ...n, id: `ocr_${idx}_${Math.random().toString(36).slice(2, 6)}` }));
    const positioned = resolveOverlaps(positionedRaw);

    const connectorTokens = (extraction.connectorTokens || []).map((c) => {
      const minX = Math.min(...filtered.map((n) => n.left));
      const maxX = Math.max(...filtered.map((n) => n.right));
      const minY = Math.min(...filtered.map((n) => n.top));
      const maxY = Math.max(...filtered.map((n) => n.bottom));
      const boxW = Math.max(200, maxX - minX);
      const boxH = Math.max(120, maxY - minY);
      const canvasW = Math.max(extraction.sourceWidth || 1800, 1400);
      const canvasH = Math.max(extraction.sourceHeight || 1200, 900);
      const marginX = 120;
      const marginY = 100;
      const targetW = Math.max(400, canvasW - marginX * 2);
      const targetH = Math.max(300, canvasH - marginY * 2);
      const scale = Math.min(targetW / boxW, targetH / boxH);
      const usedW = boxW * scale;
      const usedH = boxH * scale;
      const offsetX = marginX + (targetW - usedW) / 2;
      const offsetY = marginY + (targetH - usedH) / 2;
      return {
        cx: offsetX + (c.cx - minX) * scale,
        cy: offsetY + (c.cy - minY) * scale
      };
    });

    const edges = inferEdges(positioned, connectorTokens);

    Engine.clearAll();

    const engineIdByTemp = new Map();
    for (const node of positioned) {
      const created = Engine.createNode(chooseNodeType(node.label), node.drawX, node.drawY);
      Engine.updateNode(created.id, { titulo: node.label });
      engineIdByTemp.set(node.id, created.id);
    }

    for (const edge of edges) {
      const fromId = engineIdByTemp.get(edge.from);
      const toId = engineIdByTemp.get(edge.to);
      if (!fromId || !toId || fromId === toId) continue;

      const fromNode = positioned.find((n) => n.id === edge.from);
      const toNode = positioned.find((n) => n.id === edge.to);
      const isVertical = Math.abs((toNode?.cx || 0) - (fromNode?.cx || 0)) < Math.abs((toNode?.cy || 0) - (fromNode?.cy || 0));
      Engine.createConnection(fromId, toId, isVertical ? "bottom" : "right", isVertical ? "top" : "left");
    }

    Renderer.redrawConnections();

    return {
      nodeCount: positioned.length,
      edgeCount: edges.length,
      mode: extraction.mode
    };
  }

  async function processFile(file) {
    if (!file) throw new Error("Selecciona un archivo antes de procesar.");

    await ensureLibraries();

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    let extraction;

    if (isPdf) {
      extraction = await extractPdfTokensFromTextLayer(file);
      if (!extraction.tokens.length || extraction.tokens.length < 8) {
        extraction = await extractPdfTokensWithOCR(file);
      }
    } else {
      extraction = await extractImageTokens(file);
    }

    return buildFlowFromTokens(extraction);
  }

  function bindEvents() {
    const btnOpen = $("btnImportImageFlow");
    const modal = $("imageFlowModal");
    const btnClose = $("imageFlowClose");
    const btnProcess = $("imageFlowProcess");
    const input = $("imageFlowInput");

    if (!btnOpen || !modal || !btnClose || !btnProcess || !input) return;

    btnOpen.addEventListener("click", () => {
      modal.classList.remove("hidden");
      setStatus("Selecciona una imagen/PDF. Se intentará mantener posiciones aproximadas y conexiones detectadas por layout.");
    });

    btnClose.addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) modal.classList.add("hidden");
    });

    btnProcess.addEventListener("click", async () => {
      try {
        btnProcess.disabled = true;
        setStatus("Procesando OCR/layout... puede tardar unos segundos.");
        const result = await processFile(input.files && input.files[0]);
        setStatus(`✅ Flujo generado con aproximación espacial.\nNodos: ${result.nodeCount}\nConexiones: ${result.edgeCount}\nModo: ${result.mode}`);
      } catch (err) {
        console.error("Error importando imagen/PDF:", err);
        setStatus(`❌ ${err.message}`);
      } finally {
        btnProcess.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
