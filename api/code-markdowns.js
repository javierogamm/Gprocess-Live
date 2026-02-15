const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const splitPlantillas = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNameKey = (value) => {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
};

const readKeyInsensitive = (obj, key) => {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];

  const lowerKey = key.toLowerCase();
  const matchedKey = Object.keys(obj).find((candidate) => candidate.toLowerCase() === lowerKey);
  return matchedKey ? obj[matchedKey] : undefined;
};

const normalizeTemplateObject = (template) => {
  if (!template || typeof template !== "object") {
    return null;
  }

  const nombreRaw = readKeyInsensitive(template, "nombre");
  const markdownRaw = readKeyInsensitive(template, "markdown");
  const tipoRaw = readKeyInsensitive(template, "tipo");

  const nombre = typeof nombreRaw === "string" ? nombreRaw.trim() : "";
  const markdown = typeof markdownRaw === "string" ? markdownRaw : "";
  const tipo = typeof tipoRaw === "string" ? tipoRaw.trim() : "";

  if (!nombre && !markdown) {
    return null;
  }

  return {
    nombre: nombre || "Plantilla",
    markdown,
    ...(tipo ? { tipo } : {}),
  };
};

const parseJsonPayload = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  let current = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (typeof current === "object" && current !== null) {
      return current;
    }

    if (typeof current !== "string") {
      return null;
    }

    try {
      current = JSON.parse(current);
    } catch (error) {
      return null;
    }
  }

  return typeof current === "object" && current !== null ? current : null;
};

const extractTemplatesFromJsonPayload = (jsonPayload) => {
  if (!jsonPayload || typeof jsonPayload !== "object") {
    return [];
  }

  const candidates = [];

  if (Array.isArray(jsonPayload)) {
    candidates.push(...jsonPayload);
  }

  const proyectoPayload = readKeyInsensitive(jsonPayload, "proyecto");
  const proyecto = proyectoPayload && typeof proyectoPayload === "object" ? proyectoPayload : null;

  candidates.push(readKeyInsensitive(proyecto, "plantillas"));
  candidates.push(readKeyInsensitive(jsonPayload, "plantillas"));
  candidates.push(readKeyInsensitive(jsonPayload, "plantilla"));

  if (proyecto) {
    candidates.push(readKeyInsensitive(proyecto, "plantilla"));
  }

  if (typeof readKeyInsensitive(jsonPayload, "nombre") === "string" || typeof readKeyInsensitive(jsonPayload, "markdown") === "string") {
    candidates.push(jsonPayload);
  }

  return candidates
    .flatMap((candidate) => {
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === "object") return [candidate];
      return [];
    })
    .map(normalizeTemplateObject)
    .filter(Boolean);
};

const mergeTemplatesPreferMarkdown = (templates) => {
  const merged = new Map();

  templates.forEach((template) => {
    const key = normalizeNameKey(template.nombre) || template.nombre;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, template);
      return;
    }

    const hasExistingMarkdown = Boolean(existing.markdown);
    const hasCurrentMarkdown = Boolean(template.markdown);

    if (!hasExistingMarkdown && hasCurrentMarkdown) {
      merged.set(key, { ...template, tipo: template.tipo || existing.tipo });
      return;
    }

    if (hasExistingMarkdown && hasCurrentMarkdown && existing.markdown !== template.markdown) {
      merged.set(key, template);
      return;
    }

    if (!existing.tipo && template.tipo) {
      merged.set(key, { ...existing, tipo: template.tipo });
    }
  });

  return Array.from(merged.values());
};

const buildTemplateDiagnostics = ({ mergedTemplates, projectTemplates, fallbackTemplates }) => {
  const projectByName = new Map();
  const fallbackByName = new Map();

  projectTemplates.forEach((template) => {
    const key = normalizeNameKey(template.nombre) || template.nombre;
    const entries = projectByName.get(key) || [];
    entries.push(template);
    projectByName.set(key, entries);
  });

  fallbackTemplates.forEach((template) => {
    const key = normalizeNameKey(template.nombre) || template.nombre;
    const entries = fallbackByName.get(key) || [];
    entries.push(template);
    fallbackByName.set(key, entries);
  });

  return mergedTemplates.map((template) => {
    const key = normalizeNameKey(template.nombre) || template.nombre;
    const fromJson = projectByName.get(key) || [];
    const fromPlain = fallbackByName.get(key) || [];

    let causaMarkdown = "markdown cargado correctamente desde JSON";

    if (!template.markdown) {
      if (fromJson.length > 0) {
        causaMarkdown = "plantilla localizada en JSON pero sin campo markdown (o vacío)";
      } else if (fromPlain.length > 0) {
        causaMarkdown = "plantilla encontrada solo en columna plantillas/plantilla (texto plano), no existe markdown en JSON";
      } else {
        causaMarkdown = "no se encontró plantilla correlacionada en JSON para recuperar markdown";
      }
    }

    return {
      nombre: template.nombre,
      markdown: template.markdown,
      causaMarkdown,
      origen: fromJson.length > 0 ? "json" : (fromPlain.length > 0 ? "texto_plano" : "desconocido"),
    };
  });
};

const normalizeItem = (item) => {
  const jsonPayload = parseJsonPayload(item?.json ?? item?.JSON ?? item?.Json);
  const jsonProyectoRaw = readKeyInsensitive(jsonPayload, "proyecto");
  const jsonProyecto = jsonProyectoRaw && typeof jsonProyectoRaw === "object" ? jsonProyectoRaw : null;

  const proyecto = typeof item?.proyecto === "string" && item.proyecto.trim()
    ? item.proyecto.trim()
    : (typeof readKeyInsensitive(jsonProyecto, "nombre") === "string" ? readKeyInsensitive(jsonProyecto, "nombre").trim() : "");
  const subfuncion = typeof item?.subfuncion === "string" && item.subfuncion.trim()
    ? item.subfuncion.trim()
    : "Sin subfunción";

  const projectTemplates = extractTemplatesFromJsonPayload(jsonPayload);
  const rawPlantillas = item?.plantillas
    ?? item?.plantilla
    ?? readKeyInsensitive(jsonProyecto, "plantillas")
    ?? readKeyInsensitive(jsonProyecto, "plantilla")
    ?? readKeyInsensitive(jsonPayload, "plantillas")
    ?? readKeyInsensitive(jsonPayload, "plantilla");
  const fallbackTemplates = splitPlantillas(rawPlantillas)
    .map((name) => ({ nombre: name, markdown: "" }));
  const plantillas = mergeTemplatesPreferMarkdown([...projectTemplates, ...fallbackTemplates]);
  const trazasPlantillas = buildTemplateDiagnostics({
    mergedTemplates: plantillas,
    projectTemplates,
    fallbackTemplates,
  });

  return {
    id: item?.id,
    created_at: item?.created_at || null,
    proyecto,
    subfuncion,
    plantillas,
    trazasPlantillas,
  };
};

const handler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { data, error } = await supabase
    .from("Code_Markdowns")
    .select("*")
    .order("subfuncion", { ascending: true })
    .order("proyecto", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const normalized = (data || []).map(normalizeItem);
  return res.status(200).json({ data: normalized });
};

module.exports = handler;
module.exports.__test__ = {
  splitPlantillas,
  normalizeItem,
  extractTemplatesFromJsonPayload,
  mergeTemplatesPreferMarkdown,
};
