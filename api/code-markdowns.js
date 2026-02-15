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

const normalizeTemplateObject = (template) => {
  if (!template || typeof template !== "object") {
    return null;
  }

  const nombre = typeof template.nombre === "string" ? template.nombre.trim() : "";
  const markdown = typeof template.markdown === "string" ? template.markdown : "";
  const tipo = typeof template.tipo === "string" ? template.tipo.trim() : "";

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

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeItem = (item) => {
  const jsonPayload = parseJsonPayload(item?.json);
  const jsonProyecto = jsonPayload?.proyecto;

  const proyecto = typeof item?.proyecto === "string" && item.proyecto.trim()
    ? item.proyecto.trim()
    : (typeof jsonProyecto?.nombre === "string" ? jsonProyecto.nombre.trim() : "");
  const subfuncion = typeof item?.subfuncion === "string" && item.subfuncion.trim()
    ? item.subfuncion.trim()
    : "Sin subfunción";

  const projectTemplates = Array.isArray(jsonProyecto?.plantillas)
    ? jsonProyecto.plantillas.map(normalizeTemplateObject).filter(Boolean)
    : [];
  const rawPlantillas = item?.plantillas ?? item?.plantilla ?? jsonPayload?.plantillas ?? jsonPayload?.plantilla;
  const fallbackTemplates = splitPlantillas(rawPlantillas)
    .map((name) => ({ nombre: name, markdown: "" }));

  const templates = [...projectTemplates, ...fallbackTemplates];
  const seen = new Set();
  const plantillas = templates.filter((template) => {
    const key = `${template.nombre}::${template.markdown}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    id: item?.id,
    created_at: item?.created_at || null,
    proyecto,
    subfuncion,
    plantillas,
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
};
