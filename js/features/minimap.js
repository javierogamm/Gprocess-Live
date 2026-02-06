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
  viewportDragging: false,
  viewportOffset: { x: 0, y: 0 },

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
          <div class="minimap-viewport"></div>
          <div class="minimap-nodes"></div>
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
    this.attachViewportDragHandlers();
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

  attachViewportDragHandlers() {
    const startDrag = (event, centerOnPointer = false) => {
      event.preventDefault();
      const rect = this.viewportEl.getBoundingClientRect();
      this.viewportDragging = true;
      this.viewportOffset = {
        x: centerOnPointer ? rect.width / 2 : event.clientX - rect.left,
        y: centerOnPointer ? rect.height / 2 : event.clientY - rect.top
      };
      document.body.style.userSelect = "none";
      this.updateViewportFromDrag(event.clientX, event.clientY);
    };

    this.viewportEl.addEventListener("mousedown", (event) => {
      startDrag(event);
    });

    this.bodyEl.addEventListener(
      "mousedown",
      (event) => {
        if (event.target.closest(".minimap-node")) return;
        startDrag(event, true);
      },
      true
    );

    document.addEventListener("mousemove", (event) => {
      if (!this.viewportDragging) return;
      this.updateViewportFromDrag(event.clientX, event.clientY);
    });

    document.addEventListener("mouseup", () => {
      if (!this.viewportDragging) return;
      this.viewportDragging = false;
      document.body.style.userSelect = "auto";
    });
  },

  updateViewportFromDrag(clientX, clientY) {
    const canvas = document.getElementById("canvasArea");
    if (!canvas || !this.bounds) return;

    const bodyRect = this.bodyEl.getBoundingClientRect();
    const pointerX = clientX - bodyRect.left - this.viewportOffset.x;
    const pointerY = clientY - bodyRect.top - this.viewportOffset.y;

    const maxX = bodyRect.width - canvas.clientWidth * this.scale;
    const maxY = bodyRect.height - canvas.clientHeight * this.scale;

    const clampedX = Math.max(0, Math.min(pointerX, maxX));
    const clampedY = Math.max(0, Math.min(pointerY, maxY));

    const targetScrollLeft = clampedX / this.scale + this.bounds.minX;
    const targetScrollTop = clampedY / this.scale + this.bounds.minY;

    canvas.scrollLeft = targetScrollLeft;
    canvas.scrollTop = targetScrollTop;
    this.updateViewport();
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
        this.syncSelectionFromState();
      };
    }

    if (Engine?.selectConnection) {
      const oldSelectConnection = Engine.selectConnection;
      Engine.selectConnection = (connId) => {
        oldSelectConnection.call(Engine, connId);
        this.syncSelectionFromState();
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

  getHandleCoordinatesFromNode(node, side) {
    const width = node.width || 144;
    const height = node.height || 68;
    const cx = node.x + width / 2;
    const cy = node.y + height / 2;

    switch (side) {
      case "top":
        return { x: cx, y: node.y };
      case "bottom":
        return { x: cx, y: node.y + height };
      case "left":
        return { x: node.x, y: cy };
      case "right":
        return { x: node.x + width, y: cy };
      default:
        return { x: cx, y: cy };
    }
  },

  scalePathData(d) {
    if (!d) return "";
    const nums = d.match(/-?\d+(\.\d+)?/g);
    if (!nums) return d;
    let i = 0;
    return d.replace(/-?\d+(\.\d+)?/g, () => {
      const value = parseFloat(nums[i++]);
      if (Number.isNaN(value)) return value;
      if (i % 2 === 1) {
        return ((value - this.bounds.minX) * this.scale).toFixed(2);
      }
      return ((value - this.bounds.minY) * this.scale).toFixed(2);
    });
  },

  renderMiniShape(svg, nodo, width, height) {
    const fillBase = nodo.color || "#dff3f9";
    const strokeBase = "#2f6f82";
    const strokeWidth = Math.max(1, width * 0.03);

    const create = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

    if (nodo.tipo === "formulario") {
      const r = create("rect");
      const rx = Math.min(width, height) * 0.18;
      r.setAttribute("x", 1);
      r.setAttribute("y", 1);
      r.setAttribute("width", width - 2);
      r.setAttribute("height", height - 2);
      r.setAttribute("rx", rx);
      r.setAttribute("ry", rx);
      r.setAttribute("fill", fillBase);
      r.setAttribute("stroke", strokeBase);
      r.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(r);
      return;
    }

    if (nodo.tipo === "documento") {
      const path = create("path");
      const d = `
        M 2 2
        H ${width - 2}
        V ${height - 6}
        Q ${width * 0.5} ${height + 6}, 2 ${height - 6}
        Z
      `;
      path.setAttribute("d", d);
      path.setAttribute("fill", fillBase);
      path.setAttribute("stroke", strokeBase);
      path.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(path);
      return;
    }

    if (nodo.tipo === "decision") {
      const path = create("path");
      const d = `
        M ${width / 2} 2
        L ${width - 2} ${height / 2}
        L ${width / 2} ${height - 2}
        L 2 ${height / 2}
        Z
      `;
      path.setAttribute("d", d);
      path.setAttribute("fill", fillBase);
      path.setAttribute("stroke", strokeBase);
      path.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(path);
      return;
    }

    if (nodo.tipo === "plazo") {
      const circle = create("circle");
      circle.setAttribute("cx", width / 2);
      circle.setAttribute("cy", height / 2);
      circle.setAttribute("r", Math.min(width, height) / 2 - 2);
      circle.setAttribute("fill", fillBase);
      circle.setAttribute("stroke", strokeBase);
      circle.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(circle);
      return;
    }

    if (nodo.tipo === "operacion_externa") {
      const body = create("rect");
      const rx = Math.min(width, height) * 0.18;
      body.setAttribute("x", 2);
      body.setAttribute("y", height * 0.2);
      body.setAttribute("width", width - 4);
      body.setAttribute("height", height * 0.6);
      body.setAttribute("rx", rx);
      body.setAttribute("ry", rx);
      body.setAttribute("fill", fillBase);
      body.setAttribute("stroke", strokeBase);
      body.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(body);

      const top = create("ellipse");
      top.setAttribute("cx", width / 2);
      top.setAttribute("cy", height * 0.2);
      top.setAttribute("rx", width * 0.48);
      top.setAttribute("ry", height * 0.18);
      top.setAttribute("fill", fillBase);
      top.setAttribute("stroke", strokeBase);
      top.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(top);
      return;
    }

    if (nodo.tipo === "libre") {
      const el = create("ellipse");
      el.setAttribute("cx", width / 2);
      el.setAttribute("cy", height / 2);
      el.setAttribute("rx", width / 2 - 2);
      el.setAttribute("ry", height / 2 - 2);
      el.setAttribute("fill", fillBase);
      el.setAttribute("stroke", strokeBase);
      el.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(el);
      return;
    }

    if (nodo.tipo === "circuito") {
      const poly = create("polygon");
      const inset = Math.min(width, height) * 0.12;
      const points = `
        ${inset},${inset}
        ${width - inset},${inset}
        ${width - inset * 0.6},${height - inset}
        ${inset * 0.6},${height - inset}
      `;
      poly.setAttribute("points", points);
      poly.setAttribute("fill", fillBase);
      poly.setAttribute("stroke", strokeBase);
      poly.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(poly);
      return;
    }

    const rect = create("rect");
    rect.setAttribute("x", 1);
    rect.setAttribute("y", 1);
    rect.setAttribute("width", width - 2);
    rect.setAttribute("height", height - 2);
    rect.setAttribute("rx", Math.min(width, height) * 0.1);
    rect.setAttribute("ry", Math.min(width, height) * 0.1);
    rect.setAttribute("fill", fillBase);
    rect.setAttribute("stroke", strokeBase);
    rect.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(rect);
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

      const from = this.getHandleCoordinatesFromNode(fromNode, conn.fromPos);
      const to = this.getHandleCoordinatesFromNode(toNode, conn.toPos);

      const OFFSET = 14;
      let adjToX = to.x;
      let adjToY = to.y;
      if (conn.toPos === "top") adjToY += OFFSET;
      if (conn.toPos === "bottom") adjToY -= OFFSET;
      if (conn.toPos === "left") adjToX += OFFSET;
      if (conn.toPos === "right") adjToX -= OFFSET;

      const basePath = Renderer?.generateOrthogonalPath
        ? Renderer.generateOrthogonalPath(from, { x: adjToX, y: adjToY }, conn.fromPos, conn.toPos)
        : `M ${from.x} ${from.y} L ${adjToX} ${adjToY}`;
      const scaledPath = this.scalePathData(basePath);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", scaledPath);
      path.classList.add("minimap-connection");
      const canvasPath = document.getElementById(conn.id) || document.querySelector(`.conn-path[data-conn-id="${conn.id}"]`);
      if (canvasPath?.classList.contains("highlighted-conn")) {
        path.classList.add("highlighted");
      }
      if (canvasPath?.classList.contains("selected-conn")) {
        path.classList.add("selected");
      }
      if (conn.id === this.selectedConnection) {
        path.classList.add("selected");
      }
      this.svgLayer.appendChild(path);
    });

    (Engine?.data?.nodos || []).forEach((nodo) => {
      const nodeDiv = document.createElement("button");
      nodeDiv.type = "button";
      const nodeWidth = (nodo.width || 144) * this.scale;
      const nodeHeight = (nodo.height || 68) * this.scale;
      const x = (nodo.x - this.bounds.minX) * this.scale;
      const y = (nodo.y - this.bounds.minY) * this.scale;
      nodeDiv.className = "minimap-node";
      const canvasNode = document.getElementById(nodo.id);
      if (canvasNode?.classList.contains("node-highlight")) {
        nodeDiv.classList.add("assign-highlight");
      }
      if (canvasNode?.classList.contains("node-highlight-cambio")) {
        nodeDiv.classList.add("cambio-highlight");
      }
      if (canvasNode?.classList.contains("highlighted-node")) {
        nodeDiv.classList.add("related-highlight");
      }
      if (canvasNode?.classList.contains("selected-conn")) {
        nodeDiv.classList.add("selected-conn");
      }
      if (this.selectedNodes.has(nodo.id)) {
        nodeDiv.classList.add("selected");
      }
      Object.assign(nodeDiv.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`
      });
      nodeDiv.addEventListener("click", (event) => {
        event.stopPropagation();
        const canvas = document.getElementById("canvasArea");
        if (!canvas) return;
        const scrollToX = nodo.x + (nodo.width || 144) / 2 - canvas.clientWidth / 2;
        const scrollToY = nodo.y + (nodo.height || 68) / 2 - canvas.clientHeight / 2;
        canvas.scrollTo({ left: scrollToX, top: scrollToY, behavior: "smooth" });
        const nodeEl = document.getElementById(nodo.id);
        if (event.ctrlKey || event.metaKey) {
          if (window.Interactions?.selectedNodes) {
            if (Interactions.selectedNodes.has(nodo.id)) {
              Interactions.selectedNodes.delete(nodo.id);
              nodeEl?.classList.remove("selected-multi");
            } else {
              Interactions.selectedNodes.add(nodo.id);
              nodeEl?.classList.add("selected-multi");
            }
            if (Interactions.selectedNodes.size > 1) {
              UI.showGroupProperties();
              Renderer.highlightConnectionsForNode(Array.from(Interactions.selectedNodes));
            } else if (Interactions.selectedNodes.size === 1) {
              const unico = Array.from(Interactions.selectedNodes)[0];
              Engine.selectNode(unico);
              Renderer.highlightConnectionsForNode([unico]);
              toggleRightPanel(true);
            } else {
              toggleRightPanel(false);
              Renderer.highlightConnectionsForNode([]);
            }
          }
        } else if (window.Interactions?.selectedNodes) {
          Interactions.selectedNodes.forEach((id) => {
            const selectedEl = document.getElementById(id);
            selectedEl?.classList.remove("selected-multi");
          });
          Interactions.selectedNodes.clear();
          Interactions.selectedNodes.add(nodo.id);
          nodeEl?.classList.add("selected-multi");
          if (Engine?.selectNode) {
            Engine.selectNode(nodo.id);
          }
          Renderer.highlightConnectionsForNode(Array.from(Interactions.selectedNodes));
          toggleRightPanel(true);
        } else if (Engine?.selectNode) {
          Engine.selectNode(nodo.id);
        }
      });

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("viewBox", `0 0 ${nodeWidth} ${nodeHeight}`);
      this.renderMiniShape(svg, nodo, nodeWidth, nodeHeight);
      nodeDiv.appendChild(svg);

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
