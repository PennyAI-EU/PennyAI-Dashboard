require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const Retell = require("retell-sdk").default;
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const nodemailer = require("nodemailer");

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

const DEFAULT_PASSWORD = 'Penny2026!';

// Normalize phone to E164 (+digits). If already has +, keep it; otherwise prepend +.
function toE164(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  return '+' + digits;
}

const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true = SSL on connect (port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }, // Hostinger sometimes uses self-signed certs
});

async function sendWelcomeEmail(email, name, password) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return; // silently skip if not configured
  const loginUrl = process.env.APP_URL || 'https://penny.icaoenglish.org';
  const firstName = (name || 'there').split(' ')[0];
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f6f3;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Penny<span style="color:#93c5fd;">AI</span></div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Your AI English Learning Platform</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Welcome, ${firstName}! 👋</h1>
            <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px;">
              Your Penny AI account has been created and you're all set to start your English learning journey.
            </p>

            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;margin-bottom:14px;">Your Login Details</div>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b6b6b;padding-bottom:8px;width:90px;">Email</td>
                      <td style="font-size:14px;font-weight:600;color:#1a1a1a;padding-bottom:8px;">${email}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b6b6b;">Password</td>
                      <td style="font-size:14px;font-weight:600;color:#1a1a1a;font-family:monospace;background:#dbeafe;padding:3px 8px;border-radius:4px;">${password}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">
              We recommend changing your password after your first login. Your teacher will be in touch soon to guide your learning path.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#2563eb;border-radius:8px;">
                  <a href="${loginUrl}/signin.html" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Sign In to Penny AI →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #e8e6e0;">
            <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
              You're receiving this email because an account was created for you on Penny AI.<br/>
              If you have any questions, reply to this email and we'll help you out.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await mailer.sendMail({
    from: `"Penny AI" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: `Welcome to Penny AI — your account is ready, ${firstName}!`,
    html,
  });
}

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
    .select("english_level, role")
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

  if (data.role === 'school_admin' || data.role === 'system_admin') {
    console.log("[check-onboarding] ADMIN — phone:", phone);
    return res.json({ status: "admin" });
  }

  if (data.role === 'teacher') {
    console.log("[check-onboarding] TEACHER — phone:", phone);
    return res.json({ status: "teacher" });
  }

  if (!data.english_level) {
    console.log("[check-onboarding] PENDING — english_level is null for phone:", phone);
    return res.json({ status: "pending", reason: "english_level_null", phone });
  }

  console.log("[check-onboarding] COMPLETE — phone:", phone, "level:", data.english_level);
  return res.json({ status: "complete" });
});

// Authenticated user profile — looks up by auth UUID, falls back to phone if UUID not in users table
app.get("/api/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  let { data, error } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();

  if (!data && !error) {
    const phone = user.user_metadata?.phone || user.phone;
    if (phone) {
      ({ data, error } = await supabase.from("users").select("*").eq("phone", phone).maybeSingle());
    }
  }

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "User not found" });

  res.json(data);
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

app.get("/api/upcoming-calls", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });
  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) return res.status(400).json({ error: "Phone not found" });
  const { data, error } = await supabase
    .from("call_triggers")
    .select("id, scheduled_time, call_status, name")
    .eq("phone_number", phone)
    .eq("call_status", "pending")
    .order("scheduled_time", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/history", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: attempts, error: attError } = await supabase
    .from("lesson_attempts")
    .select("*, lessons(title)")
    .eq("user_id", user.id)
    .order("attempt_time", { ascending: false });
  if (attError) return res.status(500).json({ error: attError.message });

  const callIds = (attempts || []).filter(a => a.call_id).map(a => a.call_id);
  let callLogsMap = {};
  if (callIds.length > 0) {
    const { data: logs } = await supabase
      .from("call_logs")
      .select("*")
      .in("call_id", callIds);
    if (logs) logs.forEach(l => { callLogsMap[l.call_id] = l; });
  }

  const merged = (attempts || []).map(a => ({
    ...a,
    recording_url: callLogsMap[a.call_id]?.["Recording Link"] || null,
    transcript:    callLogsMap[a.call_id]?.["Transcript"] || null,
    duration_sec:  callLogsMap[a.call_id]?.["Duration (Sec)"] || null,
  }));
  res.json(merged);
});

// --- TEACHER API ENDPOINTS ---
async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });
  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) return res.status(401).json({ error: "No phone on user" });
  const { data, error } = await supabase.from("users").select("id, role, school_id, name").eq("phone", phone).maybeSingle();
  if (error || !data) return res.status(403).json({ error: "User not found" });
  req.dbUser = data;
  next();
}

async function requireTeacher(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing token" });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid token" });
  const phone = user.user_metadata?.phone || user.phone;
  if (!phone) return res.status(401).json({ error: "No phone on user" });
  const { data, error } = await supabase
    .from("users")
    .select("id, role, school_id, name")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data || !['teacher', 'school_admin', 'system_admin'].includes(data.role)) {
    return res.status(403).json({ error: "Forbidden: Teacher access required" });
  }
  req.teacherDbId = data.id;
  req.teacherSchoolId = data.school_id;
  req.teacherName = data.name;
  next();
}

app.get("/api/teacher/students", requireTeacher, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, phone, english_level, allocated_lesson_count, current_lesson_id")
    .eq("teacher_id", req.teacherDbId)
    .eq("role", "student")
    .order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/teacher/students/:id/history", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const { data: student, error: sErr } = await supabase
    .from("users").select("teacher_id, phone").eq("id", id).maybeSingle();
  if (sErr || !student || student.teacher_id !== req.teacherDbId) {
    return res.status(403).json({ error: "Not your student" });
  }
  const { data: attempts, error } = await supabase
    .from("lesson_attempts")
    .select("*, lessons(title)")
    .eq("user_id", id)
    .order("attempt_time", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const callIds = (attempts || []).filter(a => a.call_id).map(a => a.call_id);
  let callLogsMap = {};
  if (callIds.length > 0) {
    const { data: logs } = await supabase.from("call_logs").select("*").in("call_id", callIds);
    if (logs) logs.forEach(l => { callLogsMap[l.call_id] = l; });
  }
  res.json((attempts || []).map(a => ({
    ...a,
    recording_url: callLogsMap[a.call_id]?.["Recording Link"] || null,
    transcript:    callLogsMap[a.call_id]?.["Transcript"] || null,
  })));
});

app.get("/api/teacher/students/:id/upcoming", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const { data: student, error: sErr } = await supabase
    .from("users").select("teacher_id, phone").eq("id", id).maybeSingle();
  if (sErr || !student || student.teacher_id !== req.teacherDbId) {
    return res.status(403).json({ error: "Not your student" });
  }
  const { data, error } = await supabase
    .from("call_triggers")
    .select("id, scheduled_time, call_status")
    .eq("phone_number", student.phone)
    .eq("call_status", "pending")
    .order("scheduled_time", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.put("/api/teacher/attempts/:id/feedback", requireTeacher, async (req, res) => {
  const { id } = req.params;
  const { teacher_feedback } = req.body;
  if (teacher_feedback === undefined) return res.status(400).json({ error: "teacher_feedback is required" });
  const { error } = await supabase
    .from("lesson_attempts")
    .update({ teacher_feedback })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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
    .select("role, school_id")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data || !['school_admin', 'system_admin'].includes(data.role)) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  req.adminUser = user;
  req.adminSchoolId = data.school_id;
  next();
}

app.get("/api/admin/students", requireAdmin, async (req, res) => {
  let query = supabase.from("users").select("*, teacher:teacher_id(id, name)").eq("role", "student").order("name");
  if (req.adminSchoolId) {
    query = query.eq("school_id", req.adminSchoolId);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/admin/teachers", requireAdmin, async (req, res) => {
  let query = supabase.from("users").select("id, name, email").eq("role", "teacher").order("name");
  if (req.adminSchoolId) {
    query = query.eq("school_id", req.adminSchoolId);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/students", requireAdmin, async (req, res) => {
  const allowed = [
    "name", "email", "phone", "english_level", "goal", "consent_given",
    "preferred_times", "lesson_frequency", "lesson_duration", "preferred_days",
    "current_lesson_id", "approved_for_outbound", "conversation_lesson",
    "allocated_time_this_month", "total_time_used", "used_time_this_month",
    "personal_details", "allocated_lesson_count", "call_feedback_score", "call_feedback_notes",
    "teacher_id"
  ];
  const row = { role: "student" };
  if (req.adminSchoolId) row.school_id = req.adminSchoolId;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      row[key] = req.body[key];
    }
  }
  if (!row.phone) return res.status(400).json({ error: "Phone number is required." });
  if (!row.email) return res.status(400).json({ error: "Email is required." });

  const e164Phone = toE164(row.phone);

  // Create auth user first so we can use the auth UUID as the users table id
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: row.email,
    phone: e164Phone,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { phone: e164Phone, name: row.name || '', must_change_password: true },
  });
  if (authError) return res.status(500).json({ error: "Auth account creation failed: " + authError.message });

  const { data, error } = await supabase.from("users").insert({ ...row, id: authData.user.id, phone: e164Phone }).select().single();
  if (error) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: error.message });
  }

  // Fire welcome email — non-blocking, don't fail the request if it errors
  sendWelcomeEmail(row.email, row.name, DEFAULT_PASSWORD).catch(err =>
    console.error("[welcome email] failed to send:", err.message)
  );

  res.json({ ...data, defaultPassword: DEFAULT_PASSWORD });
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
    "personal_details", "role", "allocated_lesson_count",
    "call_feedback_score", "call_feedback_notes", "teacher_id"
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

app.delete("/api/admin/students/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/admin/teachers", requireAdmin, async (req, res) => {
  const { name, email, phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number is required." });
  if (!email) return res.status(400).json({ error: "Email is required." });

  const e164Phone = toE164(phone);

  // Create auth user first so we can use the auth UUID as the users table id
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    phone: e164Phone,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { phone: e164Phone, name: name || '', must_change_password: true },
  });
  if (authError) return res.status(500).json({ error: "Auth account creation failed: " + authError.message });

  const row = { name, email, phone: e164Phone, role: "teacher" };
  if (req.adminSchoolId) row.school_id = req.adminSchoolId;
  const { data, error } = await supabase.from("users").insert({ ...row, id: authData.user.id }).select().single();
  if (error) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ...data, defaultPassword: DEFAULT_PASSWORD });
});

app.put("/api/admin/teachers/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  const { error } = await supabase.from("users").update({ name, email, phone }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete("/api/admin/teachers/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  // Unassign teacher from their students before deleting
  await supabase.from("users").update({ teacher_id: null }).eq("teacher_id", id);
  const { error } = await supabase.from("users").delete().eq("id", id);
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

// ─── MESSAGING ENDPOINTS ─────────────────────────────────────────────────────

// ─── MESSAGING ───────────────────────────────────────────────────────────────

// List of people the current user can DM
app.get("/api/messages/contacts", requireAuth, async (req, res) => {
  const { id: userId, role, school_id } = req.dbUser;
  let contacts = [];

  if (role === "student") {
    const { data: me } = await supabase.from("users").select("teacher_id, school_id").eq("id", userId).maybeSingle();
    if (me?.teacher_id) {
      const { data: teacher } = await supabase.from("users").select("id, name, role, email").eq("id", me.teacher_id).maybeSingle();
      if (teacher) contacts.push(teacher);
    }
    if (me?.school_id) {
      const { data: admins } = await supabase.from("users").select("id, name, role, email")
        .eq("school_id", me.school_id).in("role", ["school_admin", "system_admin"]);
      contacts.push(...(admins || []));
    }
  } else if (role === "teacher") {
    const { data: students } = await supabase.from("users").select("id, name, role, email")
      .eq("teacher_id", userId).eq("role", "student");
    contacts.push(...(students || []));
    if (school_id) {
      const { data: admins } = await supabase.from("users").select("id, name, role, email")
        .eq("school_id", school_id).in("role", ["school_admin", "system_admin"]);
      contacts.push(...(admins || []));
    }
  } else {
    const scId = school_id || req.adminSchoolId;
    if (scId) {
      const { data: members } = await supabase.from("users").select("id, name, role, email")
        .eq("school_id", scId).in("role", ["student", "teacher"]);
      contacts.push(...(members || []));
    }
  }

  res.json(contacts);
});

// List all conversations for the current user (pair-based)
app.get("/api/messages/conversations", requireAuth, async (req, res) => {
  const { id: userId } = req.dbUser;

  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, created_at, participant_a, participant_b")
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

  if (error) return res.status(500).json({ error: error.message });
  if (!convs || !convs.length) return res.json([]);

  const otherIds = [...new Set(convs.map(c => c.participant_a === userId ? c.participant_b : c.participant_a))];
  const convIds = convs.map(c => c.id);

  const [{ data: users }, { data: allMsgs }, { data: reads }] = await Promise.all([
    supabase.from("users").select("id, name, email, role").in("id", otherIds),
    supabase.from("messages").select("id, conversation_id, content, created_at, sender_id")
      .in("conversation_id", convIds).order("created_at", { ascending: false }),
    supabase.from("conversation_reads").select("conversation_id, last_read_at")
      .eq("user_id", userId).in("conversation_id", convIds),
  ]);

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  const readMap = {};
  (reads || []).forEach(r => { readMap[r.conversation_id] = r.last_read_at; });

  const result = convs.map(c => {
    const otherId = c.participant_a === userId ? c.participant_b : c.participant_a;
    const msgs = (allMsgs || []).filter(m => m.conversation_id === c.id);
    const lastMsg = msgs[0] || null;
    const lastRead = readMap[c.id];
    const unread = msgs.filter(m => m.sender_id !== userId && (!lastRead || new Date(m.created_at) > new Date(lastRead))).length;
    return {
      id: c.id,
      created_at: c.created_at,
      other_participant: userMap[otherId] || { id: otherId, name: "Unknown", role: "unknown" },
      last_message: lastMsg ? { content: lastMsg.content, created_at: lastMsg.created_at } : null,
      unread_count: unread,
    };
  }).sort((a, b) => {
    const at = a.last_message?.created_at || a.created_at;
    const bt = b.last_message?.created_at || b.created_at;
    return new Date(bt) - new Date(at);
  });

  res.json(result);
});

// Get or create a 1:1 DM conversation between the current user and a target user
app.post("/api/messages/dm/:targetUserId", requireAuth, async (req, res) => {
  const { id: userId, role, school_id } = req.dbUser;
  const { targetUserId } = req.params;

  if (userId === targetUserId) return res.status(400).json({ error: "Cannot DM yourself" });

  const { data: target } = await supabase.from("users").select("id, name, role, email, school_id, teacher_id").eq("id", targetUserId).maybeSingle();
  if (!target) return res.status(404).json({ error: "User not found" });

  // Access control: verify the pair is allowed
  if (role === "student") {
    const { data: me } = await supabase.from("users").select("teacher_id, school_id").eq("id", userId).maybeSingle();
    const isMyTeacher = me?.teacher_id === targetUserId;
    const isAdmin = ["school_admin", "system_admin"].includes(target.role) && target.school_id === me?.school_id;
    if (!isMyTeacher && !isAdmin) return res.status(403).json({ error: "Forbidden" });
  } else if (role === "teacher") {
    const isMyStudent = target.teacher_id === userId && target.role === "student";
    const isAdmin = ["school_admin", "system_admin"].includes(target.role) && target.school_id === school_id;
    if (!isMyStudent && !isAdmin) return res.status(403).json({ error: "Forbidden" });
  }

  // Ensure consistent ordering to satisfy the unique index
  const a = userId < targetUserId ? userId : targetUserId;
  const b = userId < targetUserId ? targetUserId : userId;

  let { data: conv, error } = await supabase.from("conversations")
    .select("id").eq("participant_a", a).eq("participant_b", b).maybeSingle();

  if (!conv && !error) {
    const newRow = { participant_a: a, participant_b: b };
    const scId = school_id || target.school_id;
    if (scId) newRow.school_id = scId;
    const { data: created, error: ce } = await supabase.from("conversations").insert(newRow).select("id").single();
    if (ce) return res.status(500).json({ error: ce.message });
    conv = created;
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ conversation_id: conv.id, other_participant: target });
});

// Get messages in a conversation
app.get("/api/messages/conversations/:convId", requireAuth, async (req, res) => {
  const { convId } = req.params;
  const { id: userId } = req.dbUser;

  const { data: conv } = await supabase.from("conversations")
    .select("participant_a, participant_b").eq("id", convId).maybeSingle();
  if (!conv) return res.status(404).json({ error: "Not found" });
  if (conv.participant_a !== userId && conv.participant_b !== userId) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("messages")
    .select("id, content, created_at, sender:sender_id(id, name, role)")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Send a message
app.post("/api/messages/conversations/:convId", requireAuth, async (req, res) => {
  const { convId } = req.params;
  const { content } = req.body;
  const { id: userId } = req.dbUser;

  if (!content?.trim()) return res.status(400).json({ error: "Content required" });

  const { data: conv } = await supabase.from("conversations")
    .select("participant_a, participant_b").eq("id", convId).maybeSingle();
  if (!conv) return res.status(404).json({ error: "Not found" });
  if (conv.participant_a !== userId && conv.participant_b !== userId) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: convId, sender_id: userId, content: content.trim() })
    .select("id, content, created_at, sender:sender_id(id, name, role)")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("conversation_reads").upsert(
    { conversation_id: convId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: "conversation_id,user_id" }
  );

  res.json(data);
});

// Mark conversation as read
app.put("/api/messages/conversations/:convId/read", requireAuth, async (req, res) => {
  const { convId } = req.params;
  const { id: userId } = req.dbUser;
  await supabase.from("conversation_reads").upsert(
    { conversation_id: convId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: "conversation_id,user_id" }
  );
  res.json({ success: true });
});

// Total unread message count
app.get("/api/messages/unread", requireAuth, async (req, res) => {
  const { id: userId } = req.dbUser;

  const { data: convs } = await supabase.from("conversations")
    .select("id").or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

  const convIds = (convs || []).map(c => c.id);
  if (!convIds.length) return res.json({ unread: 0 });

  const [{ data: reads }, { data: msgs }] = await Promise.all([
    supabase.from("conversation_reads").select("conversation_id, last_read_at")
      .eq("user_id", userId).in("conversation_id", convIds),
    supabase.from("messages").select("conversation_id, sender_id, created_at")
      .in("conversation_id", convIds).neq("sender_id", userId),
  ]);

  const readMap = {};
  (reads || []).forEach(r => { readMap[r.conversation_id] = r.last_read_at; });
  const total = (msgs || []).filter(m => {
    const lr = readMap[m.conversation_id];
    return !lr || new Date(m.created_at) > new Date(lr);
  }).length;

  res.json({ unread: total });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
