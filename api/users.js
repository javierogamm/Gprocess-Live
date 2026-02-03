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

module.exports = async (req, res) => {
  if (req.method === "POST") {
    let payload;

    try {
      payload = parseJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }

    const name = payload?.name?.trim();
    const pass = payload?.pass?.trim();

    if (!name || !pass) {
      return res.status(400).json({ error: "Name and password are required." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, name, admin")
      .eq("name", name)
      .eq("pass", pass)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    return res.status(200).json({ user: data });
  }

  if (req.method === "PUT") {
    let payload;

    try {
      payload = parseJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }

    const id = payload?.id;
    const name = payload?.name?.trim();
    const pass = payload?.pass?.trim();

    if (!id || !name || !pass) {
      return res.status(400).json({ error: "Id, name, and password are required." });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ name, pass })
      .eq("id", id)
      .select("id, name, admin")
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({ user: data });
  }

  res.setHeader("Allow", ["POST", "PUT"]);
  return res.status(405).json({ error: "Method Not Allowed" });
};
