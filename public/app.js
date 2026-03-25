const CLINIC_WHATSAPP = "201001234567"; // عدّل رقم العيادة دوليًا

const waQuick = document.getElementById("waQuick");
if (waQuick) {
  waQuick.href = `https://wa.me/${CLINIC_WHATSAPP}?text=${encodeURIComponent("السلام عليكم، عايز أحجز موعد.")}`;
}

const bookBtn = document.getElementById("bookBtn");
const clearBtn = document.getElementById("clearBtn");
const closeToast = document.getElementById("closeToast");

const toast = document.getElementById("toast");
const waLink = document.getElementById("waLink");

function resetForm(){
  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("date").value = "";
  document.getElementById("time").value = "";
}

function hideToast(){
  toast.classList.remove("show");
}

if (closeToast) closeToast.addEventListener("click", hideToast);
if (clearBtn) clearBtn.addEventListener("click", resetForm);

if (bookBtn) {
  bookBtn.addEventListener("click", async () => {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;

    if(!name || !phone || !date || !time){
      alert("من فضلك املأ كل البيانات.");
      return;
    }

    bookBtn.disabled = true;
    bookBtn.textContent = "جاري الحجز...";

    try{
      const res = await fetch("/book", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ name, phone, date, time })
      });

      const data = await res.json();
      if(!data.success) throw new Error("failed");

      const msg =
        `حجز جديد:%0Aالاسم: ${encodeURIComponent(name)}%0Aالموبايل: ${encodeURIComponent(phone)}%0Aالتاريخ: ${encodeURIComponent(date)}%0Aالوقت: ${encodeURIComponent(time)}`;

      waLink.href = `https://wa.me/${CLINIC_WHATSAPP}?text=${msg}`;
      toast.classList.add("show");
      resetForm();
    }catch(e){
      alert("حصلت مشكلة، حاول تاني.");
      console.error(e);
    }finally{
      bookBtn.disabled = false;
      bookBtn.textContent = "احجز الآن";
    }
  });
}
// AI Assistant logic
const aiAssistant = {
  async startChat(patient) {
    // يسأل أسئلة ذكية:
    const questions = [
      "ما هو سبب الزيارة؟ (ألم - تنظيف - تبييض - تقويم - استشارة)",
      "هل تعاني من أي أمراض مزمنة؟ (سكر - ضغط - قلب - لا شيء)",
      "هل تتناول أي أدوية بانتظام؟",
      "هل لديك حساسية من أي أدوية؟ (بنسلين - مخدر - لا شيء)",
      "متى كانت آخر زيارة لطبيب الأسنان؟"
    ];
    
    // جمع الإجابات وإرسالها للدكتور
    const medicalHistory = await collectAnswers(questions);
    sendToDoctorViaWhatsApp(medicalHistory);
  }
};