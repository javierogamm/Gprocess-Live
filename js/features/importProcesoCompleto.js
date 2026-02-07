/* ========================================================
   IMPORT PROCESO COMPLETO DESDE GESTIONA
   - Copypaste del flujo
   - Copypaste de tesauros
   - Coincidencias
   - Resumen
   - Valores de selectores coincidentes
   - Confirmación final
======================================================== */

const ImportProcesoCompleto = {
    step: 0,
    steps: ["Flujo", "Tesauros", "Coincidencias", "Resumen", "Valores", "Confirmación"],
    state: {
        flujo: {
            done: false,
            message: "",
            rawText: "",
            preview: null,
            campos: []
        },
        tesauro: {
            done: false,
            message: "",
            rawText: "",
            items: [],
            matched: [],
            unmatched: [],
            matchingSelectors: [],
            selectorRefs: {},
            selectorValues: {}
        },
        review: {
            coincidencias: false,
            resumen: false,
            valores: false
        }
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
            flujo: {
                done: false,
                message: "",
                rawText: "",
                preview: null,
                campos: []
            },
            tesauro: {
                done: false,
                message: "",
                rawText: "",
                items: [],
                matched: [],
                unmatched: [],
                matchingSelectors: [],
                selectorRefs: {},
                selectorValues: {}
            },
            review: {
                coincidencias: false,
                resumen: false,
                valores: false
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

        if (this.step === 0) this.renderFlujo();
        if (this.step === 1) this.renderTesauros();
        if (this.step === 2) this.renderCoincidencias();
        if (this.step === 3) this.renderResumen();
        if (this.step === 4) this.renderValores();
        if (this.step === 5) this.renderConfirmacion();

        if (this.btnBack) {
            this.btnBack.disabled = this.step === 0;
        }
        if (this.btnNext) {
            this.btnNext.textContent = this.step === this.steps.length - 1 ? "Montar en la app" : "Siguiente";
        }
    },
    renderFlujo() {
        const { done, message, rawText } = this.state.flujo;
        this.contentEl.innerHTML = `
            <div>
                <h3>1. Pega el copypaste del flujo</h3>
                <p>Pega el texto completo del flujo desde Gestiona para detectar tareas y tesauros usados.</p>
            </div>
            <div class="import-full-panel">
                <label>Pega aquí la definición del flujo</label>
                <textarea id="importFlujoPasteInput" placeholder="Pega la definición de tareas desde Gestiona">${this.escape(rawText)}</textarea>
                <button id="importFlujoPasteLoad" class="btn">Cargar copypaste</button>
            </div>
            ${done ? `<div class="import-full-status">✅ ${message}</div>` : ""}
        `;
        const pasteBtn = this.contentEl.querySelector("#importFlujoPasteLoad");
        if (pasteBtn) {
            pasteBtn.addEventListener("click", () => this.handleFlujoPaste());
        }
    },
    handleFlujoPaste() {
        const textarea = this.contentEl.querySelector("#importFlujoPasteInput");
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
        const campos = this.extractCamposFromFlow(text);
        this.state.flujo.done = true;
        this.state.flujo.rawText = text;
        this.state.flujo.message = `Copypaste cargado (${preview.nodos.length} nodos, ${preview.conexiones.length} conexiones, ${campos.length} tesauros referenciados).`;
        this.state.flujo.preview = preview;
        this.state.flujo.campos = campos;
        if (this.state.tesauro.done) {
            this.updateTesauroMatches();
        }
        this.render();
    },
    renderTesauros() {
        const { done, message, rawText } = this.state.tesauro;
        this.contentEl.innerHTML = `
            <div>
                <h3>2. Pega el copypaste de tesauros</h3>
                <p>Pega la tabla de tesauros desde Gestiona. Se analizarán para detectar coincidencias con el flujo.</p>
            </div>
            <div class="import-full-panel">
                <label>Pega aquí la tabla de tesauros</label>
                <textarea id="importTesauroPasteInput" placeholder="Pega la tabla de tesauros desde Gestiona">${this.escape(rawText)}</textarea>
                <button id="importTesauroPasteLoad" class="btn">Cargar tesauros</button>
            </div>
            ${done ? `<div class="import-full-status">✅ ${message}</div>` : ""}
        `;

        const loadBtn = this.contentEl.querySelector("#importTesauroPasteLoad");
        if (loadBtn) {
            loadBtn.addEventListener("click", () => this.handleTesauroPaste());
        }
    },
    handleTesauroPaste() {
        const textarea = this.contentEl.querySelector("#importTesauroPasteInput");
        const text = textarea?.value?.trim();
        if (!text) {
            alert("Pega antes el copypaste de tesauros.");
            return;
        }
        if (!this.state.flujo.done) {
            alert("Primero carga el copypaste del flujo.");
            return;
        }
        const parsed = window.DataTesauro?.parsePasteTesauros?.(text) || [];
        if (!parsed.length) {
            alert("❌ No se detectaron tesauros válidos. Revisa el copypaste.");
            return;
        }
        this.state.tesauro.rawText = text;
        this.state.tesauro.items = parsed;
        this.state.tesauro.selectorRefs = {};
        this.state.tesauro.selectorValues = {};
        this.updateTesauroMatches();
        this.state.tesauro.done = true;
        this.state.tesauro.message = `Tesauros cargados (${parsed.length} campos detectados).`;
        this.state.review.coincidencias = false;
        this.state.review.resumen = false;
        this.state.review.valores = false;
        this.render();
    },
    renderCoincidencias() {
        const { matched, unmatched } = this.state.tesauro;
        this.contentEl.innerHTML = `
            <div>
                <h3>3. Revisa tesauros coincidentes</h3>
                <p>Hemos cruzado el flujo con los tesauros importados. Revisa los coincidentes antes de continuar.</p>
            </div>
            <div class="import-full-summary">
                <div class="import-full-summary-item">
                    <strong>Coincidentes detectados</strong>
                    <p>${matched.length} tesauros coinciden con el flujo.</p>
                </div>
                <div class="import-full-summary-item">
                    <strong>No coincidentes</strong>
                    <p>${unmatched.length} tesauros no aparecen en el flujo.</p>
                </div>
            </div>
            <div class="import-full-panel">
                <button id="importCoincidenciasConfirm" class="btn">He revisado las coincidencias</button>
                ${matched.length ? `
                    <strong>Listado coincidente</strong>
                    <ul class="import-full-list">
                        ${matched.map(item => `<li>${this.escape(item.nombre)} <span>(${this.escape(item.ref)})</span></li>`).join("")}
                    </ul>
                ` : "<p>No se encontraron coincidencias entre flujo y tesauros.</p>"}
            </div>
            ${this.state.review.coincidencias ? `<div class="import-full-status">✅ Coincidencias revisadas.</div>` : ""}
        `;

        const confirmBtn = this.contentEl.querySelector("#importCoincidenciasConfirm");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                this.state.review.coincidencias = true;
                this.render();
            });
        }
    },
    renderResumen() {
        const { items, matched } = this.state.tesauro;
        const ordered = this.getOrderedTesauros(items, matched);
        this.contentEl.innerHTML = `
            <div>
                <h3>4. Resumen de tesauros coincidentes</h3>
                <p>Los tesauros coincidentes aparecen primero y marcados en verde.</p>
            </div>
            <div class="import-full-panel import-full-panel--table">
                <button id="importResumenConfirm" class="btn">Resumen revisado</button>
                ${ordered.length ? `
                    <table class="import-full-table">
                        <thead>
                            <tr>
                                <th>Estado</th>
                                <th>Referencia</th>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Momento</th>
                                <th>Agrupación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ordered.map(item => `
                                <tr class="${item._match ? "is-match" : ""}">
                                    <td>${item._match ? "Coincidente" : "No coincide"}</td>
                                    <td>${this.escape(item.ref)}</td>
                                    <td>${this.escape(item.nombre)}</td>
                                    <td>${this.escape(item.tipo)}</td>
                                    <td>${this.escape(item.momento || "-")}</td>
                                    <td>${this.escape(item.agrupacion || "-")}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                ` : "<p>No hay tesauros cargados para mostrar.</p>"}
            </div>
            ${this.state.review.resumen ? `<div class="import-full-status">✅ Resumen confirmado.</div>` : ""}
        `;

        const confirmBtn = this.contentEl.querySelector("#importResumenConfirm");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                this.state.review.resumen = true;
                this.render();
            });
        }
    },
    renderValores() {
        const { matchingSelectors, selectorRefs, selectorValues } = this.state.tesauro;
        if (!matchingSelectors.length) {
            this.state.review.valores = true;
        }
        this.contentEl.innerHTML = `
            <div>
                <h3>5. Copypaste de valores para selectores coincidentes</h3>
                <p>Solo se solicitarán valores para los selectores que coinciden con el flujo.</p>
            </div>
            ${matchingSelectors.length ? matchingSelectors.map(selector => {
                const ref = selector.ref;
                const refs = selectorRefs[ref];
                const values = selectorValues[ref];
                return `
                    <div class="import-full-panel import-full-selector" data-ref="${this.escapeAttr(ref)}">
                        <strong>${this.escape(selector.nombre)} (${this.escape(ref)})</strong>
                        <label>Pega la tabla de referencias y valores</label>
                        <textarea class="import-selector-textarea" placeholder="Pega la tabla de referencias"></textarea>
                        <button class="btn import-selector-load">Cargar referencias</button>
                        <div class="import-selector-values">
                            ${this.renderSelectorValuesTable(refs, values)}
                        </div>
                        <button class="btn import-selector-save">Guardar valores</button>
                        ${values ? `<div class="import-full-status">✅ Valores guardados (${values.length}).</div>` : ""}
                    </div>
                `;
            }).join("") : `
                <div class="import-full-panel">
                    <p>No hay selectores coincidentes en el flujo.</p>
                </div>
            `}
            ${this.state.review.valores ? `<div class="import-full-status">✅ Valores listos.</div>` : ""}
        `;

        this.contentEl.querySelectorAll(".import-selector-load").forEach(btn => {
            btn.addEventListener("click", () => {
                const panel = btn.closest(".import-full-selector");
                const ref = panel?.dataset?.ref;
                const textarea = panel?.querySelector(".import-selector-textarea");
                if (!ref || !textarea) return;
                const text = textarea.value || "";
                const refs = window.DataTesauro?.parseSelectorRefs?.(text) || [];
                if (!refs.length) {
                    alert("❌ No se detectaron referencias válidas.");
                    return;
                }
                this.state.tesauro.selectorRefs[ref] = refs;
                this.state.tesauro.selectorValues[ref] = null;
                this.state.review.valores = false;
                this.render();
            });
        });

        this.contentEl.querySelectorAll(".import-selector-save").forEach(btn => {
            btn.addEventListener("click", () => {
                const panel = btn.closest(".import-full-selector");
                const ref = panel?.dataset?.ref;
                if (!ref) return;
                const inputs = Array.from(panel.querySelectorAll(".selector-valor-input"));
                if (!inputs.length) {
                    alert("❌ Debes cargar referencias antes de guardar.");
                    return;
                }
                const opciones = [];
                let missing = false;
                inputs.forEach(input => {
                    const valor = (input.value || "").trim();
                    if (!valor) missing = true;
                    opciones.push({
                        id: window.DataTesauro?.generateId?.() || Math.random().toString(36).substring(2, 9),
                        ref: input.dataset.ref || "",
                        valor
                    });
                });
                if (missing) {
                    alert("❌ Completa todos los valores antes de guardar.");
                    return;
                }
                this.state.tesauro.selectorValues[ref] = opciones;
                this.state.review.valores = this.hasAllSelectorValues();
                this.render();
            });
        });
    },
    renderConfirmacion() {
        const { flujo, tesauro } = this.state;
        this.contentEl.innerHTML = `
            <div>
                <h3>6. Confirmación final</h3>
                <p>Confirma para montar el flujo junto a sus tesauros.</p>
            </div>
            <div class="import-full-summary">
                <div class="import-full-summary-item">
                    <strong>Flujo</strong>
                    <p>${flujo.done ? flujo.message : "Pendiente de cargar."}</p>
                </div>
                <div class="import-full-summary-item">
                    <strong>Tesauros</strong>
                    <p>${tesauro.done ? tesauro.message : "Pendiente de cargar."}</p>
                    <p>${tesauro.matched.length} coincidentes detectados.</p>
                </div>
                <div class="import-full-summary-item">
                    <strong>Selectores coincidentes</strong>
                    <p>${tesauro.matchingSelectors.length} selectores requieren valores.</p>
                </div>
            </div>
        `;
    },
    next() {
        if (this.step === 0 && !this.state.flujo.done) {
            alert("Completa el copypaste del flujo antes de continuar.");
            return;
        }
        if (this.step === 1 && !this.state.tesauro.done) {
            alert("Completa el copypaste de tesauros antes de continuar.");
            return;
        }
        if (this.step === 2 && !this.state.review.coincidencias) {
            alert("Revisa las coincidencias antes de continuar.");
            return;
        }
        if (this.step === 3 && !this.state.review.resumen) {
            alert("Confirma el resumen antes de continuar.");
            return;
        }
        if (this.step === 4 && !this.state.review.valores) {
            alert("Completa los valores de los selectores coincidentes.");
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
        if (!this.state.flujo.done || !this.state.tesauro.done) {
            alert("Faltan datos por importar.");
            return;
        }
        if (!this.state.review.valores) {
            alert("Completa los valores de los selectores coincidentes.");
            return;
        }
        const opcionesPorRef = { ...this.state.tesauro.selectorValues };
        if (window.DataTesauro?.applyPasteImport) {
            DataTesauro.pasteImportState = {
                campos: this.state.tesauro.matched,
                selectorsQueue: [],
                opcionesPorRef
            };
            DataTesauro.applyPasteImport();
        }
        if (window.ImportText?.import) {
            ImportText.import(this.state.flujo.rawText);
        }
        this.close();
        alert("✅ Proceso completo importado y montado en la app.");
    },
    extractCamposFromFlow(text) {
        const campos = [];
        const regex = /Sólo si\s+[“"']([^"”']+)[”"']\s+es igual a/gi;
        let match = regex.exec(text);
        while (match) {
            const value = (match[1] || "").trim();
            if (value && !campos.includes(value)) campos.push(value);
            match = regex.exec(text);
        }
        return campos;
    },
    updateTesauroMatches() {
        const campos = this.state.flujo.campos || [];
        const campoKeys = new Set(campos.map(value => this.normalizeKey(value)));
        const matched = [];
        const unmatched = [];
        this.state.tesauro.items.forEach(item => {
            const refKey = this.normalizeKey(item.ref);
            const nameKey = this.normalizeKey(item.nombre);
            const isMatch = campoKeys.has(refKey) || campoKeys.has(nameKey);
            if (isMatch) matched.push(item);
            else unmatched.push(item);
        });
        this.state.tesauro.matched = matched;
        this.state.tesauro.unmatched = unmatched;
        this.state.tesauro.matchingSelectors = matched.filter(item => item.tipo === "selector");
        this.state.review.valores = this.hasAllSelectorValues();
    },
    getOrderedTesauros(items, matched) {
        const matchKeys = new Set(
            matched.flatMap(item => [this.normalizeKey(item.ref), this.normalizeKey(item.nombre)])
        );
        return items
            .map(item => ({
                ...item,
                _match: matchKeys.has(this.normalizeKey(item.ref)) || matchKeys.has(this.normalizeKey(item.nombre))
            }))
            .sort((a, b) => {
                if (a._match && !b._match) return -1;
                if (!a._match && b._match) return 1;
                return (a.nombre || "").localeCompare(b.nombre || "");
            });
    },
    hasAllSelectorValues() {
        const selectors = this.state.tesauro.matchingSelectors || [];
        if (!selectors.length) return true;
        return selectors.every(selector => Array.isArray(this.state.tesauro.selectorValues[selector.ref]));
    },
    renderSelectorValuesTable(refs, values) {
        const rows = values || refs;
        if (!rows || !rows.length) {
            return "<p class=\"import-full-muted\">Sin referencias cargadas.</p>";
        }
        return `
            <table class="import-full-table import-full-table--compact">
                <thead>
                    <tr>
                        <th>Referencia</th>
                        <th>Valor literal</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(({ ref, valor }) => `
                        <tr>
                            <td>${this.escape(ref)}</td>
                            <td>
                                <input data-ref="${this.escapeAttr(ref)}" class="selector-valor-input"
                                  value="${this.escapeAttr(valor || "")}" />
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    },
    normalizeKey(value) {
        return (value || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    },
    escape(value) {
        return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    escapeAttr(value) {
        return (value || "").replace(/"/g, "&quot;");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    ImportProcesoCompleto.init();
});
