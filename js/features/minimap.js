/* ============================================================
   MINIMAP.JS
   Minimap flotante del procedimiento
   - Vista miniaturizada de nodos y conexiones
   - Resalta selección actual
   - Muestra viewport visible del canvas
   - Permite mover y redimensionar
============================================================ */

const MiniMap = {
  btn: null,
  windowEl: null,
  bodyEl: null,
  viewportEl: null,
  nodesLayer: null,
  svgLayer: null,
  bounds: null,
  scale: 1,
  padding: 60,
  selectedNodes: new Set(),
  selectedConnection: null,
  dragging: false,
  dragOffset: { x: 0, y: 0 },
  resizeObserver: null,

  init() {
    if (!document.getElementById("btnMinimap")) {
      const btn = document.createElement("button");
      btn.id = "btnMinimap";
      btn.className = "floating-minimap-btn";
      btn.textContent = "🗺️ Minimap";
      document.body.appendChild(btn);
    }

    if (!document.getElementById("minimapWindow")) {
      const windowEl = document.createElement("div");
      windowEl.id = "minimapWindow";
      windowEl.className = "minimap-window";
      windowEl.innerHTML = `
        <div class="minimap-header">
          <span>🗺️ Minimap</span>
          <button class="minimap-close" type="button" aria-label="Cerrar minimapa">✕</button>
        </div>
        <div class="minimap-body">
          <svg class="minimap-svg" width="100%" height="100%"></svg>
          <div class="minimap-nodes"></div>
          <div class="minimap-viewport"></div>
        </div>
      `;
      document.body.appendChild(windowEl);
    }

    this.btn = document.getElementById("btnMinimap");
    this.windowEl = document.getElementById("minimapWindow");
    this.bodyEl = this.windowEl.querySelector(".minimap-body");
    this.nodesLayer = this.windowEl.querySelector(".minimap-nodes");
    this.svgLayer = this.windowEl.querySelector(".minimap-svg");
    this.viewportEl = this.windowEl.querySelector(".minimap-viewport");

    this.btn.addEventListener("click", () => {
      this.windowEl.classList.toggle("visible");
      if (this.windowEl.classList.contains("visible")) {
        this.render();
        this.updateViewport();
      }
    });

    this.windowEl.querySelector(".minimap-close").addEventListener("click", () => {
      this.windowEl.classList.remove("visible");
    });

    this.attachDragHandlers();
    this.attachResizeObserver();
    this.attachScrollHandler();
    this.attachSelectionSync();
    this.patchCoreHooks();
  },

  attachDragHandlers() {
    const header = this.windowEl.querySelector(".minimap-header");
    header.addEventListener("mousedown", (e) => {
      this.dragging = true;
      const rect = this.windowEl.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;
      this.windowEl.style.left = `${e.clientX - this.dragOffset.x}px`;
      this.windowEl.style.top = `${e.clientY - this.dragOffset.y}px`;
      this.windowEl.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (!this.dragging) return;
      this.dragging = false;
      document.body.style.userSelect = "auto";
    });
  },

  attachResizeObserver() {
    if (!("ResizeObserver" in window)) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.windowEl.classList.contains("visible")) return;
      this.render();
      this.updateViewport();
    });
    this.resizeObserver.observe(this.windowEl);
  },

  attachScrollHandler() {
    const canvas = document.getElementById("canvasArea");
    if (!canvas) return;
    canvas.addEventListener("scroll", () => {
      if (this.windowEl.classList.contains("visible")) {
        this.updateViewport();
      }
    });
    window.addEventListener("resize", () => {
      if (this.windowEl.classList.contains("visible")) {
        this.render();
        this.updateViewport();
      }
    });
  },

  attachSelectionSync() {
    document.addEventListener("click", () => {
      this.syncSelectionFromState();
    });
    document.addEventListener("mouseup", () => {
      this.syncSelectionFromState();
    });
  },

  patchCoreHooks() {
    if (Engine?.selectNode) {
      const oldSelectNode = Engine.selectNode;
      Engine.selectNode = (id) => {
        oldSelectNode.call(Engine, id);
        this.setSelectedNodes(id ? [id] : []);
        this.setSelectedConnection(null);
      };
    }

    if (Engine?.selectConnection) {
      const oldSelectConnection = Engine.selectConnection;
      Engine.selectConnection = (connId) => {
        oldSelectConnection.call(Engine, connId);
        this.setSelectedConnection(connId);
        this.setSelectedNodes([]);
      };
    }

    if (Renderer?.renderNode) {
      const oldRenderNode = Renderer.renderNode;
      Renderer.renderNode = (nodo) => {
        oldRenderNode.call(Renderer, nodo);
        this.scheduleRender();
      };
    }

    if (Renderer?.redrawConnections) {
      const oldRedraw = Renderer.redrawConnections;
      Renderer.redrawConnections = () => {
        oldRedraw.call(Renderer);
        this.scheduleRender();
      };
    }

    if (Engine?.updateNode) {
      const oldUpdateNode = Engine.updateNode;
      Engine.updateNode = (id, props) => {
        oldUpdateNode.call(Engine, id, props);
        this.scheduleRender();
      };
    }

    if (Engine?.createConnection) {
      const oldCreateConn = Engine.createConnection;
      Engine.createConnection = (...args) => {
        const conn = oldCreateConn.apply(Engine, args);
        this.scheduleRender();
        return conn;
      };
    }
  },

  scheduleRender() {
    if (!this.windowEl?.classList.contains("visible")) return;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      this.render();
      this.updateViewport();
    });
  },

  syncSelectionFromState() {
    const selected = (window.Interactions?.selectedNodes && window.Interactions.selectedNodes.size > 0)
      ? Array.from(window.Interactions.selectedNodes)
      : (Engine?.selectedNodeId ? [Engine.selectedNodeId] : []);

    this.setSelectedNodes(selected);
    this.setSelectedConnection(Engine?.selectedConnectionId || null);
  },

  computeBounds() {
    const nodes = Engine?.data?.nodos || [];
    if (!nodes.length) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const width = n.width || 144;
      const height = n.height || 68;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + width);
      maxY = Math.max(maxY, n.y + height);
    });

    minX -= this.padding;
    minY -= this.padding;
    maxX += this.padding;
    maxY += this.padding;

    return { minX, minY, maxX, maxY };
  },

  render() {
    if (!this.windowEl.classList.contains("visible")) return;
    this.bounds = this.computeBounds();

    const bodyRect = this.bodyEl.getBoundingClientRect();
    const width = bodyRect.width;
    const height = bodyRect.height;

    const contentWidth = this.bounds.maxX - this.bounds.minX;
    const contentHeight = this.bounds.maxY - this.bounds.minY;
    const scaleX = width / contentWidth;
    const scaleY = height / contentHeight;
    this.scale = Math.min(scaleX, scaleY);

    this.nodesLayer.innerHTML = "";
    this.svgLayer.innerHTML = "";

    this.svgLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const conexiones = Engine?.data?.conexiones || [];
    conexiones.forEach((conn) => {
      const fromNode = Engine.getNode(conn.from);
      const toNode = Engine.getNode(conn.to);
      if (!fromNode || !toNode) return;

      const fromX = (fromNode.x + (fromNode.width || 144) / 2 - this.bounds.minX) * this.scale;
      const fromY = (fromNode.y + (fromNode.height || 68) / 2 - this.bounds.minY) * this.scale;
      const toX = (toNode.x + (toNode.width || 144) / 2 - this.bounds.minX) * this.scale;
      const toY = (toNode.y + (toNode.height || 68) / 2 - this.bounds.minY) * this.scale;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
      path.setAttribute("x1", fromX);
      path.setAttribute("y1", fromY);
      path.setAttribute("x2", toX);
      path.setAttribute("y2", toY);
      path.classList.add("minimap-connection");
      if (conn.id === this.selectedConnection) {
        path.classList.add("selected");
      }
      this.svgLayer.appendChild(path);
    });

    (Engine?.data?.nodos || []).forEach((nodo) => {
      const nodeDiv = document.createElement("div");
      const width = (nodo.width || 144) * this.scale;
      const height = (nodo.height || 68) * this.scale;
      const x = (nodo.x - this.bounds.minX) * this.scale;
      const y = (nodo.y - this.bounds.minY) * this.scale;
      nodeDiv.className = "minimap-node";
      if (this.selectedNodes.has(nodo.id)) {
        nodeDiv.classList.add("selected");
      }
      Object.assign(nodeDiv.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`
      });
      this.nodesLayer.appendChild(nodeDiv);
    });
  },

  updateViewport() {
    if (!this.bounds || !this.windowEl.classList.contains("visible")) return;
    const canvas = document.getElementById("canvasArea");
    if (!canvas) return;

    const viewX = (canvas.scrollLeft - this.bounds.minX) * this.scale;
    const viewY = (canvas.scrollTop - this.bounds.minY) * this.scale;
    const viewW = canvas.clientWidth * this.scale;
    const viewH = canvas.clientHeight * this.scale;

    Object.assign(this.viewportEl.style, {
      left: `${viewX}px`,
      top: `${viewY}px`,
      width: `${viewW}px`,
      height: `${viewH}px`
    });
  },

  setSelectedNodes(ids) {
    this.selectedNodes = new Set(ids || []);
    this.scheduleRender();
  },

  setSelectedConnection(connId) {
    this.selectedConnection = connId;
    this.scheduleRender();
  }
};

window.addEventListener("DOMContentLoaded", () => {
  MiniMap.init();
});
