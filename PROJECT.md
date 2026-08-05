# Penny AI — Project Notes

---

## Goals & Deadline

**Target: 2 weeks → ~July 6, 2026**
Next presentation is to the decision-maker at the prospective client. They must be able to play with the product live in the room — no raw Supabase, no Retell, no backend tools shown.

| # | Goal | Owner | Status |
|---|---|---|---|
| 1 | Admin + Student Dashboard | Developer | Not started (admin) / ~85% (student) |
| 2 | Polish lessons & call content | Max | In progress |
| — | Domain migration (PennyAI.eu) | Developer | Task — not a goal |

---

## POC Demo Scenario

1. Open admin dashboard live in the room
2. Upload a small Excel file (name + phone number, 2–3 rows)
3. Set campaign: how many to call per day, what time window
4. Trigger calls — audience members play three roles:
   - Person A: very interested, has 10 employees
   - Person B: somewhat interested
   - Person C: not interested, "don't call again"
5. Reports appear on the dashboard as each call completes

---

## Background

### System Architecture

| Layer | Tool | Role |
|---|---|---|
| Frontend | Vanilla HTML/JS (`public/`) | Student dashboard, landing page, auth pages |
| Backend | Express/Node.js (`server.js`) | API, call creation, auth middleware |
| Database | Supabase | All data storage + auth |
| Voice AI | Retell AI | Penny (teaching agent), Emma (outbound sales) |
| Workflows | N8N | Pre-lesson instruction injection, call orchestration |
| Hosting | Hostinger | PennyAI.eu (active, ready to connect) |

### Supabase Tables

**Student-side**
- `call_logs` — phone, duration, summary, transcript, recording link
- `call_triggers` — phone + scheduled time + status (pending = triggers outbound call)
- `lesson_attempts` — score, time attempted, completion status per attempt
- `lessons` — lesson library by CEFR level; content in `lesson_instructions` column
- `users` — phone, email, name, English level, goals, preferred call time, weekly frequency

**Prospect-side**
- `prospects` — phone, name, summary, language type, lead temperature, hold reason; status "pending" triggers Emma

### Lesson Instruction Hierarchy
```
Retell universal personality (Penny's base behavior)
  └── N8N pre-lesson instructions (level-specific rules, applies to ALL lessons)
        └── Supabase lessons.lesson_instructions (per-lesson content)
```
- Global behavior changes → N8N
- Per-lesson content changes → Supabase `lesson_instructions` field

### White-Label Approach
Not a built-in platform feature. To give a client their own instance:
1. Clone the repo
2. Create a new Supabase project (copy table schema)
3. Point environment variables to the new project
~90% code reuse. Client gets a fresh database with their own data and can rename Penny/Emma to whatever they want.

### Business Model
- Upfront deposit: €1,000–2,000 (smaller schools)
- Per lesson: €7–8 per 10-minute session
- Pricing for larger institutions: TBD

---

## Feature Details

### 1. Student Dashboard (`public/dashboard.html`) — ~85–90% Done

**Already built**
- Overview: English level, lessons completed, learning time progress bar, next scheduled call
- My Lessons: current lesson card, Start Live Session button, call preferences (read-only)
- History: past lesson attempts — date, title, summary, score badge (green ≥80 / yellow 60–79 / red <60)
- Profile Settings: name, email, level, bio, learning goal (all read-only)
- Call interface: modal with audio visualizer, agent animation, End Call button

**Still missing**
- Editing preferences (frequency, duration, preferred days)
- Editing profile
- Detailed per-attempt feedback / drill-down view
- Progress visualizations beyond the time bar

---

### 2. Admin Dashboard — Not Started

#### Section A: Student Management

| Feature | Notes |
|---|---|
| Student list | Browse/search all students in the school |
| Student profile | Name, email, level, goals, call time, frequency, notes, DOB |
| Student progress | Every lesson attempted, scores, completion % |
| Schedule lesson | Pick lesson + time → inserts into call_triggers |
| Set lesson allocation | How many lessons purchased (count, not just time) |
| Lesson library | Browse all lessons by CEFR level + lesson number |

#### Section B: Prospect Management

| Feature | Notes |
|---|---|
| Excel upload | Template: name + phone only. No scheduled times in file. |
| Campaign setup (post-upload) | UI asks: call window (from → to), how many per day. Backend handles pacing. |
| Drag-and-drop ordering | Reorder who gets called first; today's quota is highlighted |
| Pause / edit campaign | Pause, increase or decrease daily call count at any time |
| Manual single entry | Add one number; set immediate or future scheduled time |
| Prospect list | Name, phone, status, lead temperature |
| Filter by lead temp | Hot / warm / cold filter |
| Call reports | Post-call summary per prospect — appears after call completes, not real-time |

---

### 3. Lesson Polishing (Max's responsibility — system support from developer)

Changes to implement in N8N pre-lesson instructions:
1. **Adaptive speed** — not just slower for A1, but adjusted across all CEFR levels
2. **Italian fallback** — if student doesn't understand after 2nd attempt, switch to Italian to explain, then return to English
3. **Pronunciation coaching** — don't just say "repeat." Say: *"I want you to repeat because I'm not happy with the pronunciation. I want a clear pronunciation, so let's try again."* If still unclear, explain in Italian so the student knows the repetition is intentional coaching.

Max to send current N8N instruction text via WhatsApp as the base to edit from.

---

## Known Issues

| Issue | Impact | Notes |
|---|---|---|
| Web caller out of sync with phone agent | Demo risk | Web caller shows "English or Italiano"; phone agent says "English, Italian or Portuguese." Retell web caller config is separate from live agent config — needs investigation |
| Lesson limit is time-based only | Enrollment gap | No lesson count limit exists. Need to add count field to users + N8N guardrail that tells student "you've used up your assigned lessons" when limit is hit. Must be enforced in both dashboard AND N8N. |

---

## Tasks

### Developer
- [ ] Build admin dashboard (Student Management section)
- [ ] Build admin dashboard (Prospect Management section — Excel upload, campaign setup, drag-and-drop)
- [ ] Add lesson count allocation field to users table + enforcement guardrail in N8N
- [ ] Fix web caller sync issue in Retell
- [ ] Connect PennyAI.eu domain in Hostinger
- [ ] Add profile editing to student dashboard
- [ ] Add preferences editing to student dashboard

### Max
- [ ] Polish lesson scripts (update lesson_instructions in Supabase)
- [ ] Send current N8N lesson-specific instructions text via WhatsApp
- [ ] Review and approve Excel upload template format

---

## Cost Breakdown

Total for this phase: **$550**

| Item | Cost |
|---|---|
| Admin dashboard — Prospect Management | $250 |
| Admin dashboard — Student Management | $175 |
| Student dashboard — remaining features + lesson feedback | $50 |
| Lesson count limit + N8N guardrail | $50 |
| Web caller sync fix + domain connection | $25 |
| **Total** | **$550** |

---

## Future Considerations

The following features have been scoped and documented but are deferred to a later phase. They are not part of the current build.

### Mobile App

- Same feature set as the web dashboard (everything on the website = available on the app)
- Role-based access after login (not separate apps per role)
- Budget target: ~$300 — developer to break down by feature so non-essentials can be cut
- Design: Claude handles initial design, developer tweaks; mobile dev uses the website + mockup as reference
- App Store registration: TBD

*Deferred reason: The website is already accessible on mobile via browser. Rebuilding on a separate platform is not a priority at this stage.*

### User Role System

| Role | Access |
|---|---|
| **Admin** (school owner) | Full access to everything |
| **Admin Assistant** | Add/enroll students, schedule lessons — not full student DB, not financial |
| **Teacher** | Only students assigned to them |
| **Student** | Their own data only |

**Student enrollment flow (done by Admin Assistant)**
1. Collect: name, phone, email, level, notes/interests, DOB, lesson frequency
2. Assign a teacher
3. Set lesson count allocation (how many lessons purchased)
4. System activates the student

**Teacher assignment rules**
Staging deployment pipeline verified 5 August 2026.
- Admin assigns teacher at enrollment
- Assignment is changeable later
- Student can exist temporarily with no teacher (just-enrolled, not yet assigned)

*Deferred reason: This phase is a proof of concept. The full role hierarchy will be built when we deliver the client's own instance.*
