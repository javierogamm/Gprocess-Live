const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const parseJsonBody = (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  return null;
};

const normalizePayload = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.items && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [payload];
};

const normalizeNodeType = (tipo) => {
  const raw = typeof tipo === "string" ? tipo.trim() : "";
  if (!raw) return "formulario";

  const compact = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

  const aliases = {
    formulario: "formulario",
    subproceso: "subproceso",
    subprocess: "subproceso",
    subprocesso: "subproceso",
    documento: "documento",
    decision: "decision",
    decisionr: "decisionR",
    plazo: "plazo",
    operacionexterna: "operacion_externa",
    circuito: "circuito",
    libre: "libre",
    notas: "notas",
  };

  if (aliases[compact]) return aliases[compact];
  if (compact.includes("sub") && compact.includes("proceso")) return "subproceso";
  return raw.toLowerCase();
};

const normalizeTemplatesPayload = (rawTemplates) => {
  if (!rawTemplates || typeof rawTemplates !== "object") {
    return {};
  }

  if (Array.isArray(rawTemplates)) {
    return rawTemplates.reduce((acc, item) => {
      const nodeId = item?.id ?? item?.nodeId;
      if (!nodeId) return acc;
      const content = item?.contenido ?? item?.texto ?? item?.plantillaTexto;
      if (typeof content === "string") {
        acc[nodeId] = content;
      }
      return acc;
    }, {});
  }

  return Object.entries(rawTemplates).reduce((acc, [nodeId, value]) => {
    if (!nodeId) return acc;
    if (typeof value === "string") {
      acc[nodeId] = value;
      return acc;
    }

    const content = value?.contenido ?? value?.texto ?? value?.plantillaTexto;
    if (typeof content === "string") {
      acc[nodeId] = content;
    }

    return acc;
  }, {});
};

const buildTemplatesPayload = (nodes = []) => (Array.isArray(nodes) ? nodes : []).reduce((acc, node) => {
  if (!node?.id) return acc;
  const content = typeof node.plantillaTexto === "string" ? node.plantillaTexto : "";
  if (content.length > 0) {
    acc[node.id] = content;
  }
  return acc;
}, {});

const normalizeFlow = (flow) => {
  if (!flow || typeof flow !== "object") {
    return flow;
  }

  const payload = { ...flow };
  const templateByNodeId = normalizeTemplatesPayload(payload.plantillas);
  const nodos = Array.isArray(payload.nodos)
    ? payload.nodos
    : (Array.isArray(payload.nodes) ? payload.nodes : []);

  payload.nodos = nodos.map((node) => {
    const safe = { ...node };
    safe.tipo = normalizeNodeType(safe.tipo ?? safe.nodeType ?? safe.tipoNodo);
    const templateContent = templateByNodeId[safe.id];
    if (typeof templateContent === "string") {
      safe.plantillaTexto = templateContent;
    }
    return safe;
  });

  if (!Array.isArray(payload.conexiones) && Array.isArray(payload.connections)) {
    payload.conexiones = payload.connections.map((conn) => ({ ...conn }));
  }

  payload.plantillas = buildTemplatesPayload(payload.nodos);

  delete payload.nodes;
  delete payload.connections;
  return payload;
};
const normalizeFlowRecord = (item) => ({
  ...item,
  flow: normalizeFlow(item.flow),
  ID_Origen: item?.ID_Origen ?? item?.id ?? null,
});

const createBackupRows = (items, insertedRows = []) => {
  const nowIso = new Date().toISOString();
  return (insertedRows || []).map((row, idx) => {
    const source = items[idx] || {};
    return {
      nombre: row?.nombre ?? source?.nombre ?? null,
      flow: normalizeFlow(row?.flow ?? source?.flow ?? source),
      subfuncion: row?.subfuncion ?? source?.subfuncion ?? null,
      creador: row?.creador ?? source?.creador ?? null,
      fecha_guardado: nowIso,
      ID_Origen: source?.ID_Origen ?? row?.ID_Origen ?? row?.id ?? null,
    };
  });
};

const persistBackups = async (items, insertedRows) => {
  const backupRows = createBackupRows(items, insertedRows);
  if (!backupRows.length) return null;

  const { error } = await supabase
    .from("Process_Flows_BACKUP")
    .insert(backupRows);

  return error || null;
};


module.exports = async (req, res) => {
  if (req.method === "GET") {
    const { id, backup, originId } = req.query || {};

    if (backup === "1") {
      if (!originId) {
        return res.status(400).json({ error: "Missing originId for backup query." });
      }

      const { data, error } = await supabase
        .from("Process_Flows_BACKUP")
        .select("id, created_at, nombre, subfuncion, creador, flow, fecha_guardado, ID_Origen")
        .eq("ID_Origen", String(originId))
        .order("id", { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const normalizedBackups = Array.isArray(data)
        ? data.map((item) => ({ ...item, flow: normalizeFlow(item.flow) }))
        : [];

      return res.status(200).json({ data: normalizedBackups });
    }

    let query = supabase
      .from("Process_Flows")
      .select("id, created_at, nombre, subfuncion, creador, flow");

    if (id) {
      query = query.eq("id", id).single();
    } else {
      query = query.order("id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const normalizedData = Array.isArray(data)
      ? data.map((item) => normalizeFlowRecord(item))
      : (data ? normalizeFlowRecord(data) : data);

    return res.status(200).json({ data: normalizedData });
  }

  if (req.method === "POST") {
    let payload;

    try {
      payload = parseJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }

    const items = normalizePayload(payload).map((item) => ({
      nombre: item.nombre ?? null,
      subfuncion: item.subfuncion ?? null,
      creador: item.creador ?? null,
      flow: normalizeFlow(item.flow ?? item),
      ID_Origen: item.ID_Origen ?? null,
    }));

    if (!items.length) {
      return res.status(400).json({ error: "Payload must include at least one item." });
    }

    const { data, error } = await supabase
      .from("Process_Flows")
      .insert(items.map(({ ID_Origen, ...rest }) => rest))
      .select("id, created_at, nombre, subfuncion, creador, flow");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const backupError = await persistBackups(items, data);
    if (backupError) {
      return res.status(500).json({ error: backupError.message });
    }

    return res.status(201).json({ data: Array.isArray(data) ? data.map((item) => normalizeFlowRecord(item)) : [] });
  }

  if (req.method === "PUT") {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "Missing id query parameter." });
    }

    let payload;
    try {
      payload = parseJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }

    const actor = typeof payload?.actor === "string" ? payload.actor.trim() : "";

    const { data: existing, error: existingError } = await supabase
      .from("Process_Flows")
      .select("id, creador")
      .eq("id", id)
      .single();

    if (existingError) {
      return res.status(404).json({ error: "Flow not found." });
    }

    const creator = typeof existing?.creador === "string" ? existing.creador.trim() : "";
    if (!creator || !actor || creator !== actor) {
      return res.status(403).json({ error: "Only the creator can overwrite this flow." });
    }

    const updateData = {
      nombre: payload?.nombre ?? null,
      subfuncion: payload?.subfuncion ?? null,
      creador: payload?.creador ?? existing.creador ?? null,
      flow: normalizeFlow(payload?.flow ?? payload),
    };

    const { data, error } = await supabase
      .from("Process_Flows")
      .update(updateData)
      .eq("id", id)
      .select("id, created_at, nombre, subfuncion, creador, flow")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const backupError = await persistBackups([{ ...payload, ID_Origen: payload?.ID_Origen ?? id }], [data]);
    if (backupError) {
      return res.status(500).json({ error: backupError.message });
    }

    return res.status(200).json({ data: normalizeFlowRecord(data) });
  }

  if (req.method === "DELETE") {
    const { id, actor: actorParam } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "Missing id query parameter." });
    }

    const actor = typeof actorParam === "string" ? actorParam.trim() : "";

    const { data: existing, error: existingError } = await supabase
      .from("Process_Flows")
      .select("id, creador")
      .eq("id", id)
      .single();

    if (existingError) {
      return res.status(404).json({ error: "Flow not found." });
    }

    const creator = typeof existing?.creador === "string" ? existing.creador.trim() : "";
    if (!creator || !actor || creator !== actor) {
      return res.status(403).json({ error: "Only the creator can delete this flow." });
    }

    const { error } = await supabase
      .from("Process_Flows")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
};
