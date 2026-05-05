require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const Retell = require("retell-sdk").default;
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const LESSON_PREAMBLE = `You are an AI English tutor conducting a live, interactive voice lesson with a student. The student's level will be provided (e.g. A1, A2, B1), and you must adapt your language, vocabulary, and pace to match that level. For A1 learners, use very simple words, short sentences, and lots of repetition.

You will be given a lesson script. This script is a guide for the structure and flow of the lesson, not something to read word-for-word. Do not read labels, formatting, or instructions such as "pause", "repeat", or section titles out loud. Instead, interpret them and naturally guide the conversation.

Your goal is to teach interactively, not to recite. Speak in short turns (one to two sentences), then stop and wait for the student to respond. Always allow space for the student to speak. Do not continue speaking without giving the student time to answer.

When the script says "pause", you must stop speaking and wait for the student's response. Do not say the word "pause". When the script says "repeat", ask the student to repeat and wait for them. Always simulate a real conversation.

You are allowed to improvise and expand on the script when needed. You can add extra examples, simplify explanations, or rephrase sentences to help the student understand better. However, you must stay aligned with the lesson topic and objective.

Always encourage participation. Ask simple questions, check understanding, and guide the student step by step. If the student gives a very short answer, ask them to say more. If they struggle or stay silent, first encourage them ("Take your time"), then give an example, and if needed, move forward.

Correct the student's mistakes gently. Start with positive feedback, then give the correct version, and often ask them to repeat it. Keep your tone friendly, supportive, and patient.

Your priority is to create a natural, engaging learning experience where the student is actively speaking and practicing throughout the lesson, not just listening.

At the end of the lesson always review what the student has learned today and encourage them to keep practicing. Also tell the student this is a product actively in development and ask if they have any feedback to help captain max improve this application

--- LESSON SCRIPT ---`;

// Expose public Supabase config to the browser (anon key only — never the service key)
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// Register a new user: creates Supabase Auth account + inserts call_triggers row
app.post("/api/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "name, email, phone, and password are required" });
  }

  // Create auth user with email pre-confirmed so they can sign in immediately
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already")) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return res.status(400).json({ error: authError.message });
  }

  // Insert into call_triggers to fire an onboarding call
  const { error: triggerError } = await supabase.from("call_triggers").insert({
    phone_number: phone,
    name,
    email,
    call_status: "pending",
    scheduled_time: new Date().toISOString(),
  });

  if (triggerError) {
    console.error("call_triggers insert error:", triggerError);
    // Auth user was created — don't fail the whole registration, just log
  }

  res.json({ success: true });
});

// Check whether a signed-in user has completed phone onboarding
// Expects: Authorization: Bearer <supabase_access_token>
app.post("/api/check-onboarding", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  const phone = user.user_metadata?.phone;
  if (!phone) return res.json({ status: "pending" });

  const { data, error } = await supabase
    .from("users")
    .select("english_level")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("users lookup error:", error);
    return res.status(500).json({ error: "Lookup failed" });
  }

  if (data && data.english_level) {
    return res.json({ status: "complete" });
  }
  return res.json({ status: "pending" });
});

app.post("/create-call", async (req, res) => {
  const { level, lesson_number, instruction } = req.body;

  if (!level || lesson_number === undefined) {
    return res.status(400).json({ error: "level and lesson_number are required" });
  }

  let finalInstruction = instruction;
  let lessonName = null;

  if (!finalInstruction) {
    const { data, error } = await supabase
      .from("lessons")
      .select("lesson_instruction, title")
      .eq("level", level)
      .eq("lesson_number", Number(lesson_number))
      .single();

    if (error || !data) {
      return res.status(404).json({ error: `No lesson found for ${level} lesson ${lesson_number}` });
    }
    finalInstruction = data.lesson_instruction;
    lessonName = data.title || null;
  }

  try {
    const webCallResponse = await retell.call.createWebCall({
      agent_id: process.env.RETELL_AGENT_ID,
      retell_llm_dynamic_variables: { instruction: `${LESSON_PREAMBLE}\n\n${finalInstruction}` },
    });
    res.json({
      access_token: webCallResponse.access_token,
      lesson_name: lessonName,
      level,
      lesson_number,
    });
  } catch (err) {
    console.error("Retell error:", err);
    res.status(500).json({ error: err.message || "Failed to create call" });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
