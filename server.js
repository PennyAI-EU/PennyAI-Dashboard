require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const Retell = require("retell-sdk").default;
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
  },
  realtime: {
    transport: ws,
  },
});

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
  console.log("Registration attempt:", { name, email, phone });
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "name, email, phone, and password are required" });
  }

  // Create auth user with email pre-confirmed so they can sign in immediately
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { name, phone },
  });

  if (authError) {
    console.error("[register] Supabase auth error:", authError.message, authError.code);
    const msg = authError.message?.toLowerCase() || "";
    if (msg.includes("email") && msg.includes("already")) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    if (msg.includes("phone") && msg.includes("already")) {
      return res.status(409).json({ error: "An account with this phone number already exists." });
    }
    if (msg.includes("already")) {
      return res.status(409).json({ error: "An account with these details already exists." });
    }
    return res.status(400).json({ error: authError.message });
  }

    console.log("Inserting into call_triggers with phone:", phone);
    const { error: triggerError } = await supabase.from("call_triggers").insert({
      phone_number: phone,
      name,
      email,
      call_status: "pending",
      scheduled_time: new Date().toISOString(),
    });

    if (triggerError) {
      console.error("call_triggers insert error:", triggerError);
    }

    const authUserId = authData.user.id;

    // Insert into users table
    console.log("Inserting into users with phone:", phone, "and id:", authUserId);
    const { error: usersError } = await supabase.from("users").insert({
      id: authUserId,
      phone: phone,
      name: name,
      email: email,
    });

    if (usersError) {
      console.error("users insert error:", usersError);
    }

  res.json({ success: true });
});

// Check whether a signed-in user has completed phone onboarding
// Expects: Authorization: Bearer <supabase_access_token>
app.post("/api/check-onboarding", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.log("[check-onboarding] PENDING — invalid/expired token:", userError?.message);
    return res.status(401).json({ error: "Invalid token" });
  }

  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) {
    console.log("[check-onboarding] PENDING — no phone on user:", user.id);
    return res.json({ status: "pending", reason: "no_phone" });
  }

  const { data, error } = await supabase
    .from("users")
    .select("english_level, is_admin")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("[check-onboarding] DB error for phone", phone, ":", error.message);
    return res.status(500).json({ error: "Lookup failed" });
  }

  if (!data) {
    console.log("[check-onboarding] PENDING — phone not found in users table:", phone);
    return res.json({ status: "pending", reason: "phone_not_in_users_table", phone });
  }

  if (data.is_admin) {
    console.log("[check-onboarding] ADMIN — phone:", phone);
    return res.json({ status: "admin" });
  }

  if (!data.english_level) {
    console.log("[check-onboarding] PENDING — english_level is null for phone:", phone);
    return res.json({ status: "pending", reason: "english_level_null", phone });
  }

  console.log("[check-onboarding] COMPLETE — phone:", phone, "level:", data.english_level);
  return res.json({ status: "complete" });
});

// Public demo endpoint — no auth required, used by the landing page free session
app.post("/create-demo-call", async (req, res) => {
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
    console.error("Retell demo error:", err);
    res.status(500).json({ error: err.message || "Failed to create demo call" });
  }
});

app.post("/create-call", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  const phone = user.user_metadata?.phone;
  if (!phone) return res.status(400).json({ error: "User phone number not found" });

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
      retell_llm_dynamic_variables: { 
        instruction: `${LESSON_PREAMBLE}\n\n${finalInstruction}`,
        user_phone: phone,
        user_id: user.id
      },
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

// --- PACING ALGORITHM ---
async function recalculateCampaignSchedules(campaign_id) {
  try {
    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaign) return;

    const daily_limit = campaign.daily_limit || 50;
    const window_start = campaign.window_start || '09:00:00';
    const window_end = campaign.window_end || '17:00:00';
    const allowedDays = campaign.days_of_week ? campaign.days_of_week.toLowerCase().split(',').map(d => d.trim()) : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const startParts = window_start.split(':');
    const endParts = window_end.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || 0);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || 0);
    
    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) durationMinutes = 480; 

    const intervalMinutes = durationMinutes / daily_limit;

    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, order_index")
      .eq("campaign_id", campaign_id)
      .eq("call_status", "pending")
      .order("order_index", { ascending: true });

    if (!prospects || prospects.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let currentDate = new Date(today);
    let prospectIndex = 0;

    if (allowedDays.length === 0 || (allowedDays.length === 1 && allowedDays[0] === '')) {
      allowedDays.push('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
    }

    while (prospectIndex < prospects.length) {
      if (allowedDays.includes(dayNames[currentDate.getDay()])) {
        for (let i = 0; i < daily_limit && prospectIndex < prospects.length; i++) {
          const scheduledDate = new Date(currentDate);
          const totalMinutes = startMinutes + (i * intervalMinutes);
          const hrs = Math.floor(totalMinutes / 60);
          const mins = Math.floor(totalMinutes % 60);
          
          scheduledDate.setHours(hrs, mins, 0, 0);
          await supabase.from("prospects").update({ scheduled_at: scheduledDate.toISOString() }).eq("id", prospects[prospectIndex].id);
          prospectIndex++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (err) {
    console.error("Error recalculating schedules:", err);
  }
}

// Fetch next scheduled call (using service role to bypass RLS)
app.get("/api/next-call", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) return res.status(400).json({ error: "Phone number not found for user" });

  try {
    const { data: nextCall, error } = await supabase
      .from("call_triggers")
      .select("scheduled_time, call_status")
      .eq("phone_number", phone)
      .eq("call_status", "pending")
      .order("scheduled_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json(nextCall || null);
  } catch (err) {
    console.error("Error fetching next call:", err);
    res.status(500).json({ error: "Failed to fetch scheduled call" });
  }
});

// --- ADMIN API ENDPOINTS ---
async function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) return res.status(401).json({ error: "No phone on user" });

  const { data, error } = await supabase
    .from("users")
    .select("is_admin, school_id")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data || !data.is_admin) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  req.adminUser = user;
  req.adminSchoolId = data.school_id;
  next();
}

app.get("/api/admin/students", requireAdmin, async (req, res) => {
  let query = supabase.from("users").select("*").order("name");
  if (req.adminSchoolId) {
    query = query.eq("school_id", req.adminSchoolId);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/admin/students/:id/allocation", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { count } = req.body;
  const { error } = await supabase
    .from("users")
    .update({ allocated_lesson_count: count })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put("/api/admin/students/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const allowed = [
    "name", "email", "phone", "english_level", "goal", "consent_given",
    "preferred_times", "lesson_frequency", "lesson_duration", "preferred_days",
    "current_lesson_id", "approved_for_outbound", "conversation_lesson",
    "allocated_time_this_month", "total_time_used", "used_time_this_month",
    "personal_details", "is_admin", "allocated_lesson_count",
    "call_feedback_score", "call_feedback_notes"
  ];
  const updates = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[key] = req.body[key];
    }
  }
  const { error } = await supabase.from("users").update(updates).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/admin/prospects", requireAdmin, async (req, res) => {
  const { campaign_id } = req.query;
  let query = supabase
    .from("prospects")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });
    
  if (campaign_id && campaign_id !== 'all') query = query.eq("campaign_id", campaign_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/prospects", requireAdmin, async (req, res) => {
  const { prospects, campaign_id } = req.body; // Array of { contact_name, phone }
  if (!prospects || !prospects.length) return res.status(400).json({ error: "No prospects provided" });
  if (!campaign_id) return res.status(400).json({ error: "campaign_id is required" });
  
  // Assign max order_index to new prospects
  const { data: maxData } = await supabase
    .from("prospects")
    .select("order_index")
    .eq("campaign_id", campaign_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
    
  let maxOrder = (maxData && maxData.order_index) ? maxData.order_index : 0;
  
  const toInsert = prospects.map(p => {
    maxOrder++;
    const rawPhone = (p.phone || '').toString().trim().replace(/\s+/g, '');
    const phone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
    return {
      contact_name: p.contact_name,
      phone,
      order_index: maxOrder,
      call_status: "pending",
      campaign_id: campaign_id
    };
  });

  const { error } = await supabase.from("prospects").insert(toInsert);
  if (error) return res.status(500).json({ error: error.message });
  
  await recalculateCampaignSchedules(campaign_id);
  
  res.json({ success: true, count: toInsert.length });
});

app.put("/api/admin/prospects/reorder", requireAdmin, async (req, res) => {
  const { updates } = req.body; // Array of { id, order_index }
  if (!updates || !updates.length) return res.json({ success: true });

  // Update rows individually
  for (const up of updates) {
    await supabase.from("prospects").update({ order_index: up.order_index }).eq("id", up.id);
  }
  
  const { data: first } = await supabase.from("prospects").select("campaign_id").eq("id", updates[0].id).single();
  if (first && first.campaign_id) {
    await recalculateCampaignSchedules(first.campaign_id);
  }

  res.json({ success: true });
});

app.get("/api/admin/campaigns", requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/campaigns", requireAdmin, async (req, res) => {
  const { name, daily_limit, window_start, window_end, days_of_week } = req.body;
  const { data, error } = await supabase.from("campaigns").insert({
    name, daily_limit, window_start, window_end, days_of_week, status: 'active'
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/admin/campaigns/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put("/api/admin/prospects/:id/schedule", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: "scheduled_at is required" });
  const { error } = await supabase.from("prospects").update({ scheduled_at }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put("/api/admin/campaigns/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, status, daily_limit, window_start, window_end, days_of_week } = req.body;
  const { error } = await supabase.from("campaigns").update({
    name, status, daily_limit, window_start, window_end, days_of_week
  }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  
  await recalculateCampaignSchedules(id);
  
  res.json({ success: true });
});

app.get("/api/admin/lessons", requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from("lessons").select("*").order("level").order("lesson_number");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/lessons", requireAdmin, async (req, res) => {
  const { title, level, lesson_number, lesson_instruction } = req.body;
  const { error } = await supabase.from("lessons").insert({ title, level, lesson_number, lesson_instruction });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put("/api/admin/lessons/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, level, lesson_number, lesson_instruction } = req.body;
  const { error } = await supabase.from("lessons").update({ title, level, lesson_number, lesson_instruction }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/admin/students/:id/attempts", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("lesson_attempts")
    .select(`
      attempt_time,
      score,
      completion_percentage,
      call_summary,
      student_feedback,
      grading_rationale,
      lessons ( title )
    `)
    .eq("user_id", id)
    .order("attempt_time", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/schedule-call", requireAdmin, async (req, res) => {
  const { phone_number, name, email, scheduled_time } = req.body;
  if (!phone_number || !scheduled_time) {
    return res.status(400).json({ error: "phone_number and scheduled_time are required" });
  }

  const { error } = await supabase.from("call_triggers").insert({
    phone_number,
    name,
    email,
    scheduled_time,
    call_status: "pending"
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
