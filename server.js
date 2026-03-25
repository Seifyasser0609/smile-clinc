const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");

const app = express();
const PORT = 3000;
const db = new sqlite3.Database("./database.db");

/* ===================== MIDDLEWARE ===================== */
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: "super_secret_key_2024_ai_enhanced",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static("public"));

/* ===================== AUTH MIDDLEWARE ===================== */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ success: false, message: "Unauthorized" });
}

/* ===================== DATABASE ===================== */
db.serialize(() => {
  // Drop the old table if it exists (to recreate with correct schema)
  db.run(`DROP TABLE IF EXISTS appointments`);
  
  // Create new table with all columns and proper unique constraint
  db.run(`
    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      medical_conditions TEXT,
      medications TEXT,
      allergies TEXT,
      last_visit TEXT,
      pain_level TEXT,
      symptoms TEXT,
      ai_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, time) ON CONFLICT FAIL
    )
  `, (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("✅ تم إنشاء جدول المواعيد بنجاح مع منع تكرار المواعيد");
      
      // Create index for faster queries
      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time)`);
    }
  });
});

/* ===================== AUTH ROUTES ===================== */
const ADMIN_USER = "admin";
const ADMIN_PASS = "1234";

app.post("/admin/login", (req, res) => {
  const username = (req.body.username || "").trim();
  const password = (req.body.password || "").trim();

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }

  return res.status(401).json({ success: false, message: "Invalid credentials" });
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* ===================== GET AVAILABLE DATES (Next 7 days) ===================== */
app.get("/available-dates", (req, res) => {
  console.log("📅 جلب التواريخ المتاحة...");
  
  const today = new Date();
  const dates = [];
  
  // Generate dates for the next 7 days
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Format date as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Get day name in Arabic
    const dayName = date.toLocaleDateString('ar-EG', { weekday: 'long' });
    
    dates.push({
      value: dateStr,
      display: `${dayName} ${day}/${month}/${year}`
    });
  }
  
  console.log("✅ التواريخ المتاحة:", dates);
  res.json({ success: true, dates });
});

/* ===================== GET AVAILABLE TIMES ===================== */
app.get("/available-times", (req, res) => {
  const { date } = req.query;
  
  console.log("🕐 جلب المواعيد المتاحة لـ:", date);
  
  if (!date) {
    return res.status(400).json({ success: false, message: "التاريخ مطلوب" });
  }

  // Check if date is within next 7 days
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  
  if (selectedDate < today) {
    return res.status(400).json({ 
      success: false, 
      message: "لا يمكن الحجز في تواريخ سابقة" 
    });
  }
  
  if (selectedDate > maxDate) {
    return res.status(400).json({ 
      success: false, 
      message: "يمكن الحجز فقط للأيام السبعة القادمة" 
    });
  }

  db.all("SELECT time FROM appointments WHERE date = ?", [date], (err, rows) => {
    if (err) {
      console.error("Error fetching times:", err);
      return res.status(500).json({ success: false, message: "خطأ في جلب المواعيد" });
    }

    const bookedTimes = new Set(rows.map(row => row.time));
    
    // Generate all possible time slots (9 AM to 8 PM, every 30 minutes)
    const allTimes = [];
    for (let hour = 9; hour <= 20; hour++) {
      for (let minute of ['00', '30']) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute}`;
        allTimes.push(timeString);
      }
    }

    // Check availability for each time slot
    const availableTimes = [];
    const bookedTimesList = [];
    
    allTimes.forEach(time => {
      if (bookedTimes.has(time)) {
        bookedTimesList.push(time);
      } else {
        availableTimes.push(time);
      }
    });
    
    console.log(`✅ مواعيد متاحة: ${availableTimes.length}, محجوزة: ${bookedTimesList.length}`);
    
    res.json({
      success: true,
      availableTimes,
      bookedTimes: bookedTimesList
    });
  });
});

/* ===================== PUBLIC BOOKING ===================== */
app.post("/book", (req, res) => {
  console.log("📥 استلام طلب حجز:", req.body);

  const {
    name, phone, date, time,
    reason, medical_conditions, medications,
    allergies, last_visit, pain_level, symptoms
  } = req.body;

  if (!name || !phone || !date || !time) {
    return res.status(400).json({ 
      success: false, 
      message: "الرجاء إدخال البيانات الأساسية" 
    });
  }

  // Check if date is within next 7 days
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  
  if (selectedDate < today || selectedDate > maxDate) {
    return res.status(400).json({ 
      success: false, 
      message: "يمكن الحجز فقط للأيام السبعة القادمة" 
    });
  }

  // توليد ملخص بسيط
  let aiSummary = `📋 ملخص الحجز:\n`;
  if (reason) aiSummary += `• السبب: ${reason}\n`;
  if (medical_conditions) aiSummary += `• أمراض مزمنة: ${medical_conditions}\n`;
  if (medications) aiSummary += `• أدوية: ${medications}\n`;
  if (allergies) aiSummary += `• حساسية: ${allergies}\n`;
  if (pain_level) aiSummary += `• مستوى الألم: ${pain_level}/5\n`;
  if (symptoms) aiSummary += `• أعراض: ${symptoms}\n`;

  // Use serialized transaction to prevent race conditions
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    // Check if slot is still available
    db.get(
      "SELECT id FROM appointments WHERE date = ? AND time = ?",
      [date, time],
      (err, row) => {
        if (err) {
          db.run("ROLLBACK");
          console.error("❌ خطأ في التحقق:", err);
          return res.status(500).json({ success: false, error: err.message });
        }

        if (row) {
          db.run("ROLLBACK");
          return res.status(409).json({ 
            success: false, 
            message: "للأسف، هذا الموعد تم حجزه للتو. الرجاء اختيار موعد آخر" 
          });
        }

        // Insert the appointment
        db.run(
          `INSERT INTO appointments 
           (name, phone, date, time, reason, medical_conditions, 
            medications, allergies, last_visit, pain_level, symptoms, ai_summary) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, phone, date, time, reason, medical_conditions,
           medications, allergies, last_visit, pain_level, symptoms, aiSummary],
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              console.error("❌ خطأ في الإدراج:", err);
              if (err.message.includes('UNIQUE')) {
                return res.status(409).json({ 
                  success: false, 
                  message: "للأسف، هذا الموعد تم حجزه للتو. الرجاء اختيار موعد آخر" 
                });
              }
              return res.status(500).json({ success: false, error: err.message });
            }

            db.run("COMMIT");
            console.log("✅ تم الحجز بنجاح، id:", this.lastID);
            res.json({ 
              success: true, 
              appointmentId: this.lastID,
              message: "تم حجز الموعد بنجاح"
            });
          }
        );
      }
    );
  });
});

/* ===================== ADMIN ROUTES ===================== */
app.get("/appointments", requireAdmin, (req, res) => {
  db.all("SELECT * FROM appointments ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false });
    }
    res.json(rows);
  });
});

app.get("/appointments/detailed", requireAdmin, (req, res) => {
  db.all(`
    SELECT * FROM appointments 
    ORDER BY 
      CASE status
        WHEN 'pending' THEN 1
        WHEN 'confirmed' THEN 2
        WHEN 'done' THEN 3
        WHEN 'cancelled' THEN 4
      END,
      date DESC,
      time DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false });
    }
    res.json(rows);
  });
});

app.put("/appointments/:id/status", requireAdmin, (req, res) => {
  const id = req.params.id;
  const status = req.body.status;

  db.run(
    "UPDATE appointments SET status = ? WHERE id = ?",
    [status, id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

app.delete("/appointments/:id", requireAdmin, (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM appointments WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("Error deleting appointment:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ في حذف الموعد" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: "الموعد غير موجود" });
    }

    res.json({ success: true, message: "تم حذف الموعد بنجاح" });
  });
});

/* ===================== AI INSIGHTS ===================== */
app.get("/ai/insights", requireAdmin, (req, res) => {
  db.all(`SELECT * FROM appointments`, [], (err, appointments) => {
    if (err) {
      return res.status(500).json({ success: false });
    }

    // تحليل أيام الأسبوع
    const dayCount = {};
    appointments.forEach(a => {
      if (a.date) {
        const date = new Date(a.date);
        const day = date.getDay();
        dayCount[day] = (dayCount[day] || 0) + 1;
      }
    });

    let maxDay = 0;
    let maxCount = 0;
    for (const [day, count] of Object.entries(dayCount)) {
      if (count > maxCount) {
        maxCount = count;
        maxDay = parseInt(day);
      }
    }

    const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const busiestDay = days[maxDay] || "غير محدد";

    // تحليل الأمراض المزمنة
    const chronicPatients = appointments.filter(a => 
      a.medical_conditions && 
      (a.medical_conditions.includes('سكر') || 
       a.medical_conditions.includes('ضغط') ||
       a.medical_conditions.includes('قلب'))
    ).length;

    const chronicPercentage = appointments.length > 0 
      ? Math.round((chronicPatients / appointments.length) * 100) 
      : 0;

    // تحليل حالات الطوارئ
    const emergencyCases = appointments.filter(a => 
      a.reason && 
      (a.reason.includes('ألم') || 
       a.reason.includes('طوارئ'))
    ).length;

    const insights = {
      success: true,
      predictions: {
        busiest_days: [{ day_of_week: maxDay, count: maxCount }],
        next_week_estimate: maxCount
      },
      ai_recommendations: [
        `اليوم الأكثر ازدحاماً: ${busiestDay} (${maxCount} موعد)`,
        `نسبة مرضى الأمراض المزمنة: ${chronicPercentage}%`,
        `حالات الطوارئ: ${emergencyCases} حالة`
      ]
    };

    res.json(insights);
  });
});

/* ===================== HEALTH CHECK ===================== */
app.get("/_health", (req, res) => {
  res.json({ ok: true });
});

/* ===================== REDIRECT ADMIN ===================== */
app.get("/admin", (req, res) => {
  res.redirect("/admin.html");
});

/* ===================== START SERVER ===================== */
app.listen(PORT, () => {
  console.log("✅ Server running on http://localhost:" + PORT);
  console.log("📝 قاعدة البيانات: database.db (تم إنشاؤها من جديد مع منع تكرار المواعيد)");
  console.log("📅 الحجز متاح للأيام السبعة القادمة فقط");
});