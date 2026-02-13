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

const normalizeItem = (item) => {
  const proyecto = typeof item?.proyecto === "string" ? item.proyecto.trim() : "";
  const subfuncion = typeof item?.subfuncion === "string" && item.subfuncion.trim()
    ? item.subfuncion.trim()
    : "Sin subfunción";

  const rawPlantillas = item?.plantillas ?? item?.plantilla ?? item?.json?.plantillas ?? item?.json?.plantilla;
  const plantillas = [...new Set(splitPlantillas(rawPlantillas))];

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
