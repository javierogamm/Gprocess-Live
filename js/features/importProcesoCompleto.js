/* ========================================================
   IMPORT PROCESO COMPLETO DESDE GESTIONA
   - Tesauros (CSV RPA o copypaste)
   - Proceso (JSON o copypaste)
   - Ficha del procedimiento
   - Confirmación final
======================================================== */

const ImportProcesoCompleto = {
    step: 0,
    steps: ["Tesauros", "Proceso", "Ficha", "Confirmación"],
    state: {
        tesauro: { mode: null, done: false, message: "" },
        proceso: { mode: null, done: false, message: "", preview: null },
        ficha: { procedimiento: "", actividad: "", descripcion: "" }
    },
    init() {
        this.modal = document.getElementById("importFullProcessModal");
        this.stepsEl = document.getElementById("importFullSteps");
        this.contentEl = document.getElementById("importFullContent");
        this.btnOpen = document.getElementById("btnImportProcesoCompleto");
        this.btnClose = document.getElementById("importFullClose");
        this.btnBack = document.getElementById("importFullBack");
        this.btnNext = document.getElementById("importFullNext");

        if (this.btnOpen) {
            this.btnOpen.addEventListener("click", () => this.open());
        }
        if (this.btnClose) {
            this.btnClose.addEventListener("click", () => this.close());
        }
        if (this.modal) {
            this.modal.addEventListener("click", (e) => {
                if (e.target === this.modal) this.close();
            });
        }
        if (this.btnBack) {
            this.btnBack.addEventListener("click", () => this.prev());
        }
        if (this.btnNext) {
            this.btnNext.addEventListener("click", () => this.next());
        }
    },
    open() {
        this.reset();
        if (this.modal) this.modal.classList.remove("hidden");
    },
    close() {
        if (this.modal) this.modal.classList.add("hidden");
    },
    reset() {
        this.step = 0;
        this.state = {
            tesauro: { mode: null, done: false, message: "" },
            proceso: { mode: null, done: false, message: "", preview: null },
            ficha: {
                procedimiento: Engine.fichaProyecto?.procedimiento || "",
                actividad: Engine.fichaProyecto?.actividad || "",
                descripcion: Engine.fichaProyecto?.descripcion || ""
            }
        };
        this.render();
    },
    render() {
        if (!this.stepsEl || !this.contentEl) return;
        this.stepsEl.innerHTML = this.steps
            .map((step, idx) => {
                const active = idx === this.step ? "active" : "";
                return `<div class="import-full-step ${active}">${idx + 1}. ${step}</div>`;
            })
            .join("");

        if (this.step === 0) this.renderTesauros();
        if (this.step === 1) this.renderProceso();
        if (this.step === 2) this.renderFicha();
        if (this.step === 3) this.renderConfirmacion();

        if (this.btnBack) {
            this.btnBack.disabled = this.step === 0;
        }
        if (this.btnNext) {
            this.btnNext.textContent = this.step === 3 ? "Montar en la app" : "Siguiente";
        }
    },
    renderTesauros() {
        const { mode, done, message } = this.state.tesauro;
        this.contentEl.innerHTML = `
            <div>
                <h3>1. Importa los tesauros</h3>
                <p>Selecciona si quieres cargar el CSV de RPA o usar copypaste desde Gestiona.</p>
            </div>
            <div class="import-full-choice">
                <button class="import-full-option ${mode === "csv" ? "active" : ""}" data-mode="csv">
                    📥 CSV de RPA
                    <small>Sube Tesauro.csv (y opcional valores).</small>
                </button>
                <button class="import-full-option ${mode === "paste" ? "active" : ""}" data-mode="paste">
                    📋 Copypaste de Gestiona
                    <small>Pega la tabla copiada desde la app.</small>
                </button>
            </div>
            ${this.renderTesauroPanel()}
            ${done ? `<div class="import-full-status">✅ ${message}</div>` : ""}
        `;

        this.contentEl.querySelectorAll(".import-full-option").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.state.tesauro.mode = btn.dataset.mode;
                this.state.tesauro.done = false;
                this.state.tesauro.message = "";
                this.render();
            });
        });

        const loadBtn = this.contentEl.querySelector("#importTesauroLoad");
        if (loadBtn) {
            loadBtn.addEventListener("click", () => this.handleTesauroCSV());
        }

        const pasteOpenBtn = this.contentEl.querySelector("#importTesauroPasteOpen");
        if (pasteOpenBtn) {
            pasteOpenBtn.addEventListener("click", () => {
                if (window.DataTesauro?.openPasteImportModal) {
                    DataTesauro.openPasteImportModal();
                } else {
                    alert("❌ No se encontró el módulo de tesauros.");
                }
            });
        }

        const pasteConfirmBtn = this.contentEl.querySelector("#importTesauroPasteConfirm");
        if (pasteConfirmBtn) {
            pasteConfirmBtn.addEventListener("click", () => {
                this.state.tesauro.done = true;
                const total = window.DataTesauro?.campos?.length || 0;
                this.state.tesauro.message = `Tesauros listos (${total} campos en catálogo).`;
                this.render();
            });
        }
    },
    renderTesauroPanel() {
        const { mode } = this.state.tesauro;
        if (!mode) return "";
        if (mode === "csv") {
            return `
                <div class="import-full-panel">
                    <label>Selecciona uno o dos CSV (Tesauro.csv y opcional Valores.csv)</label>
                    <input type="file" id="importTesauroFiles" accept=".csv" multiple />
                    <button id="importTesauroLoad" class="btn">Cargar tesauros</button>
                </div>
            `;
        }
        return `
            <div class="import-full-panel">
                <p>Se abrirá el modal de copypaste. Cuando termines, marca como completado.</p>
                <button id="importTesauroPasteOpen" class="btn">Abrir copypaste</button>
                <button id="importTesauroPasteConfirm" class="btn btn-secundario">Ya he importado</button>
            </div>
        `;
    },
    async handleTesauroCSV() {
        const input = this.contentEl.querySelector("#importTesauroFiles");
        if (!input || !input.files?.length) {
            alert("Selecciona al menos un CSV.");
            return;
        }
        if (!window.DataTesauro?.importTesauroFromCSV) {
            alert("❌ No se encontró el módulo de tesauros.");
            return;
        }

        const files = [...input.files];
        const contents = await Promise.all(files.map((file) => file.text()));
        let mainCSV = null;
        let valCSV = null;

        contents.forEach((text, index) => {
            const firstLine = text.trimStart().split("\n")[0].toLowerCase();
            if (firstLine.includes("nombre entidad") && firstLine.includes("referencia") && firstLine.includes("castellano")) {
                mainCSV = text;
            }
            if (firstLine.startsWith("referencia tesauro;") ||
                firstLine.startsWith("referencia;i18n") ||
                firstLine.includes("idioma;valor")) {
                valCSV = text;
            }
        });

        if (!mainCSV) {
            alert("❌ Debes seleccionar el archivo Tesauro.csv principal.");
            return;
        }

        try {
            DataTesauro.importTesauroFromCSV(mainCSV, valCSV);
            const total = window.DataTesauro?.campos?.length || 0;
            this.state.tesauro.done = true;
            this.state.tesauro.message = `Tesauros importados (${total} campos en catálogo).`;
            this.render();
        } catch (err) {
            alert(`❌ Error al importar tesauros: ${err.message}`);
        }
    },
    renderProceso() {
        const { mode, done, message } = this.state.proceso;
        this.contentEl.innerHTML = `
            <div>
                <h3>2. Importa el proceso</h3>
                <p>Elige entre cargar un JSON o pegar el texto desde Gestiona.</p>
            </div>
            <div class="import-full-choice">
                <button class="import-full-option ${mode === "json" ? "active" : ""}" data-mode="json">
                    📂 JSON del proceso
                    <small>Selecciona un archivo .json exportado.</small>
                </button>
                <button class="import-full-option ${mode === "paste" ? "active" : ""}" data-mode="paste">
                    📋 Copypaste de Gestiona
                    <small>Pega la definición del flujo.</small>
                </button>
            </div>
            ${this.renderProcesoPanel()}
            ${done ? `<div class="import-full-status">✅ ${message}</div>` : ""}
        `;

        this.contentEl.querySelectorAll(".import-full-option").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.state.proceso.mode = btn.dataset.mode;
                this.state.proceso.done = false;
                this.state.proceso.message = "";
                this.render();
            });
        });

        const jsonBtn = this.contentEl.querySelector("#importProcesoJsonLoad");
        if (jsonBtn) {
            jsonBtn.addEventListener("click", () => this.handleProcesoJSON());
        }

        const pasteBtn = this.contentEl.querySelector("#importProcesoPasteLoad");
        if (pasteBtn) {
            pasteBtn.addEventListener("click", () => this.handleProcesoPaste());
        }
    },
    renderProcesoPanel() {
        const { mode } = this.state.proceso;
        if (!mode) return "";
        if (mode === "json") {
            return `
                <div class="import-full-panel">
                    <label>Selecciona el archivo JSON del proceso</label>
                    <input type="file" id="importProcesoJsonFile" accept=".json" />
                    <button id="importProcesoJsonLoad" class="btn">Cargar JSON</button>
                </div>
            `;
        }
        return `
            <div class="import-full-panel">
                <label>Pega aquí la definición del flujo</label>
                <textarea id="importProcesoPasteInput" placeholder="Pega la definición de tareas desde Gestiona"></textarea>
                <button id="importProcesoPasteLoad" class="btn">Cargar copypaste</button>
            </div>
        `;
    },
    async handleProcesoJSON() {
        const input = this.contentEl.querySelector("#importProcesoJsonFile");
        if (!input || !input.files?.length) {
            alert("Selecciona un archivo JSON.");
            return;
        }

        try {
            const text = await input.files[0].text();
            const parsed = JSON.parse(text);
            const nodos = parsed?.nodos?.length || 0;
            const conexiones = parsed?.conexiones?.length || 0;
            Engine.importFromJSON(text);
            this.state.proceso.done = true;
            this.state.proceso.message = `JSON cargado (${nodos} nodos, ${conexiones} conexiones).`;
            this.state.proceso.preview = { nodos, conexiones };
            this.render();
        } catch (err) {
            alert("❌ No se pudo leer el JSON.");
        }
    },
    handleProcesoPaste() {
        const textarea = this.contentEl.querySelector("#importProcesoPasteInput");
        const text = textarea?.value?.trim();
        if (!text) {
            alert("Pega antes el texto del flujo.");
            return;
        }
        const preview = window.ImportText?.parsePreview?.(text);
        if (!preview?.nodos?.length) {
            alert("No se detectaron tareas válidas en el texto.");
            return;
        }
        ImportText.import(text);
        this.state.proceso.done = true;
        this.state.proceso.message = `Copypaste cargado (${preview.nodos.length} nodos, ${preview.conexiones.length} conexiones).`;
        this.state.proceso.preview = preview;
        this.render();
    },
    renderFicha() {
        const ficha = this.state.ficha;
        this.contentEl.innerHTML = `
            <div>
                <h3>3. Completa la ficha del procedimiento</h3>
                <p>Estos datos se guardarán junto al flujo importado.</p>
            </div>
            <div class="import-full-panel">
                <label>Procedimiento</label>
                <input id="importFichaProcedimiento" type="text" value="${this.escape(ficha.procedimiento)}" />
                <label>Actividad</label>
                <input id="importFichaActividad" type="text" value="${this.escape(ficha.actividad)}" />
                <label>Descripción del procedimiento</label>
                <textarea id="importFichaDescripcion">${this.escape(ficha.descripcion)}</textarea>
                <button id="importFichaGuardar" class="btn">Guardar ficha</button>
            </div>
        `;

        const saveBtn = this.contentEl.querySelector("#importFichaGuardar");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                this.state.ficha.procedimiento = this.contentEl.querySelector("#importFichaProcedimiento").value.trim();
                this.state.ficha.actividad = this.contentEl.querySelector("#importFichaActividad").value.trim();
                this.state.ficha.descripcion = this.contentEl.querySelector("#importFichaDescripcion").value.trim();

                Engine.updateFichaProyecto({
                    procedimiento: this.state.ficha.procedimiento,
                    actividad: this.state.ficha.actividad,
                    descripcion: this.state.ficha.descripcion
                });

                this.render();
            });
        }
    },
    renderConfirmacion() {
        const { tesauro, proceso, ficha } = this.state;
        this.contentEl.innerHTML = `
            <div>
                <h3>4. Validación final</h3>
                <p>Revisa todo lo cargado antes de montar el proceso completo en la app.</p>
            </div>
            <div class="import-full-summary">
                <div class="import-full-summary-item">
                    <strong>Tesauros</strong>
                    <p>${tesauro.done ? tesauro.message : "Pendiente de importar."}</p>
                </div>
                <div class="import-full-summary-item">
                    <strong>Proceso</strong>
                    <p>${proceso.done ? proceso.message : "Pendiente de importar."}</p>
                </div>
                <div class="import-full-summary-item">
                    <strong>Ficha del procedimiento</strong>
                    <ul>
                        <li><strong>Procedimiento:</strong> ${this.escape(ficha.procedimiento) || "Sin definir"}</li>
                        <li><strong>Actividad:</strong> ${this.escape(ficha.actividad) || "Sin definir"}</li>
                        <li><strong>Descripción:</strong> ${this.escape(ficha.descripcion) || "Sin definir"}</li>
                    </ul>
                </div>
            </div>
        `;
    },
    next() {
        if (this.step === 0 && !this.state.tesauro.done) {
            alert("Completa la importación de tesauros antes de continuar.");
            return;
        }
        if (this.step === 1 && !this.state.proceso.done) {
            alert("Completa la importación del proceso antes de continuar.");
            return;
        }
        if (this.step === 2 && !this.state.ficha.procedimiento) {
            alert("Indica al menos el nombre del procedimiento.");
            return;
        }
        if (this.step < this.steps.length - 1) {
            this.step += 1;
            this.render();
            return;
        }
        this.finish();
    },
    prev() {
        if (this.step > 0) {
            this.step -= 1;
            this.render();
        }
    },
    finish() {
        if (!this.state.tesauro.done || !this.state.proceso.done) {
            alert("Faltan datos por importar.");
            return;
        }
        this.close();
        alert("✅ Proceso completo importado y montado en la app.");
    },
    escape(value) {
        return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    ImportProcesoCompleto.init();
});
