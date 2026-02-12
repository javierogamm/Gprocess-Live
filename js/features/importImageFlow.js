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
    const status = $("imageFlowStatus");
    if (status) status.textContent = message;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
        if (existing.dataset.loaded === "1") resolve();
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

    if (!window.Tesseract) {
      throw new Error("Tesseract no está disponible en este navegador.");
    }

    if (!window.pdfjsLib) {
      throw new Error("PDF.js no está disponible en este navegador.");
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDFJS_WORKER;
    state.libsReady = true;
  }

  function cleanNodeTitle(raw) {
    return String(raw || "")
      .replace(/^[\d\s.)-]+/, "")
      .replace(/^[•\-\*\u2022\u25E6\u25AA\u25CF]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseGraphFromText(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const edges = [];
    const nodesByTitle = new Map();

    function ensureNode(title) {
      const cleaned = cleanNodeTitle(title);
      if (!cleaned) return null;
      if (!nodesByTitle.has(cleaned)) {
        nodesByTitle.set(cleaned, { title: cleaned });
      }
      return nodesByTitle.get(cleaned);
    }

    for (const line of lines) {
      const segments = line
        .split(/(?:--?>|→|➡|=>|⟶|\s+-\s+>|\s+->\s+|\s+→\s+)/)
        .map((part) => cleanNodeTitle(part))
        .filter(Boolean);

      if (segments.length >= 2) {
        for (let i = 0; i < segments.length - 1; i += 1) {
          const from = ensureNode(segments[i]);
          const to = ensureNode(segments[i + 1]);
          if (from && to) {
            edges.push({ from: from.title, to: to.title });
          }
        }
        continue;
      }

      const asNode = ensureNode(line);
      if (asNode) {
        // Node only.
      }
    }

    if (!edges.length && nodesByTitle.size > 1) {
      const list = Array.from(nodesByTitle.values());
      for (let i = 0; i < list.length - 1; i += 1) {
        edges.push({ from: list[i].title, to: list[i + 1].title });
      }
    }

    return {
      nodes: Array.from(nodesByTitle.values()),
      edges
    };
  }

  function buildFlow(graph) {
    if (!graph.nodes.length) {
      throw new Error("No se detectaron nodos válidos en el OCR.");
    }

    Engine.clearAll();

    const idByTitle = new Map();
    const spacingX = 270;
    const spacingY = 130;
    const perRow = 4;
    const startX = 160;
    const startY = 120;

    graph.nodes.forEach((node, idx) => {
      const col = idx % perRow;
      const row = Math.floor(idx / perRow);
      const created = Engine.createNode("formulario", startX + col * spacingX, startY + row * spacingY);
      Engine.updateNode(created.id, { titulo: node.title });
      idByTitle.set(node.title, created.id);
    });

    graph.edges.forEach((edge) => {
      const fromId = idByTitle.get(edge.from);
      const toId = idByTitle.get(edge.to);
      if (fromId && toId && fromId !== toId) {
        Engine.createConnection(fromId, toId, "right", "left");
      }
    });

    Renderer.redrawConnections();
  }

  async function extractTextFromImage(file) {
    const result = await window.Tesseract.recognize(file, "spa+eng");
    return result?.data?.text || "";
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

  async function extractTextFromPdf(file) {
    const data = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let aggregate = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const canvas = await renderPdfPageToCanvas(page);
      const result = await window.Tesseract.recognize(canvas, "spa+eng");
      aggregate += `\n${result?.data?.text || ""}`;
    }

    return aggregate;
  }

  async function processFile(file) {
    if (!file) throw new Error("Selecciona un archivo antes de procesar.");

    await ensureLibraries();

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const ocrText = isPdf
      ? await extractTextFromPdf(file)
      : await extractTextFromImage(file);

    const graph = parseGraphFromText(ocrText);
    buildFlow(graph);

    return {
      textLength: ocrText.length,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length
    };
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
      setStatus("Listo para procesar. Selecciona una imagen o PDF.");
    });

    btnClose.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) modal.classList.add("hidden");
    });

    btnProcess.addEventListener("click", async () => {
      const file = input.files && input.files[0];
      try {
        btnProcess.disabled = true;
        setStatus("Procesando OCR y reconstruyendo nodos/conexiones…");

        const result = await processFile(file);

        setStatus(
          `✅ Flujo generado.\nNodos: ${result.nodeCount}\nConexiones: ${result.edgeCount}\nTexto OCR: ${result.textLength} caracteres`
        );
      } catch (err) {
        console.error("Error importando imagen/PDF", err);
        setStatus(`❌ ${err.message}`);
      } finally {
        btnProcess.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
