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

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const { id } = req.query || {};
    let query = supabase
      .from("Process_Flows")
      .select("id, created_at, nombre, subfuncion, flow");

    if (id) {
      query = query.eq("id", id).single();
    } else {
      query = query.order("id", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
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
      flow: item.flow ?? item,
    }));

    if (!items.length) {
      return res.status(400).json({ error: "Payload must include at least one item." });
    }

    const { data, error } = await supabase
      .from("Process_Flows")
      .insert(items)
      .select("id, created_at, nombre, subfuncion, flow");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ data });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
};
