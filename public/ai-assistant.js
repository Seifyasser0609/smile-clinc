// AI Assistant للمحادثة التفاعلية
class DentalAIAssistant {
  constructor() {
    this.conversationState = {};
    this.questions = {
      greeting: "👋 مرحباً! أنا المساعد الذكي لعيادة الأسنان. هل تحب تحجز موعد؟",
      
      reason: "ما هو سبب الزيارة؟ (اختر رقم)\n1️⃣ ألم في الأسنان\n2️⃣ تنظيف وجير\n3️⃣ تبييض\n4️⃣ تقويم\n5️⃣ حشو وعلاج\n6️⃣ استشارة عامة",
      
      pain_level: "على مقياس من ١ إلى ٥، كم مستوى الألم؟ (١=خفيف، ٥=مزعج جداً)",
      
      symptoms: "هل تعاني من أي أعراض أخرى؟ (ورم - حساسية - نزيف - لا شيء)",
      
      medical_conditions: "هل تعاني من أي أمراض مزمنة؟ (سكر - ضغط - قلب - لا شيء)",
      
      medications: "هل تتناول أي أدوية بانتظام؟ (اكتب اسم الدواء أو 'لا شيء')",
      
      allergies: "هل لديك حساسية من أي أدوية؟ (بنسلين - مخدر - لا شيء)",
      
      last_visit: "متى كانت آخر زيارة لطبيب الأسنان؟",
      
      date_preference: "ما هو التاريخ المناسب لك؟",
      
      time_preference: "وما هو الوقت المناسب؟ (صباح - مساء - محدد)"
    };
  }

  async processMessage(userId, message) {
    if (!this.conversationState[userId]) {
      this.conversationState[userId] = {
        step: 0,
        answers: {}
      };
      return {
        message: this.questions.greeting,
        options: ["نعم", "لا"],
        step: 0
      };
    }

    const state = this.conversationState[userId];
    
    switch(state.step) {
      case 0: // بعد التحية
        if (message === "نعم") {
          state.step = 1;
          return {
            message: this.questions.reason,
            options: ["١", "٢", "٣", "٤", "٥", "٦"],
            step: 1
          };
        } else {
          return {
            message: "لا مشكلة! ممكن تتواصل معانا في أي وقت. هل تحب نرسلك عرض خاص؟",
            options: ["نعم", "لا شكراً"],
            step: 0
          };
        }

      case 1: // سبب الزيارة
        const reasons = {
          "١": "ألم في الأسنان",
          "٢": "تنظيف وجير",
          "٣": "تبييض",
          "٤": "تقويم",
          "٥": "حشو وعلاج",
          "٦": "استشارة عامة"
        };
        
        if (reasons[message]) {
          state.answers.reason = reasons[message];
          
          if (message === "١") { // إذا كان ألم
            state.step = 2; // نسأل عن مستوى الألم
            return {
              message: this.questions.pain_level,
              options: ["١", "٢", "٣", "٤", "٥"],
              step: 2
            };
          } else {
            state.step = 3; // نتخطى سؤال الألم
            return this.processMessage(userId, message); // ننتقل للخطوة التالية
          }
        }
        break;

      case 2: // مستوى الألم
        if (["١", "٢", "٣", "٤", "٥"].includes(message)) {
          state.answers.pain_level = parseInt(message);
          state.step = 3;
          return {
            message: this.questions.symptoms,
            options: ["ورم", "حساسية", "نزيف", "لا شيء"],
            step: 3
          };
        }
        break;

      case 3: // الأعراض
        state.answers.symptoms = message;
        state.step = 4;
        return {
          message: this.questions.medical_conditions,
          options: ["سكر", "ضغط", "قلب", "لا شيء"],
          step: 4
        };

      case 4: // الأمراض المزمنة
        state.answers.medical_conditions = message;
        state.step = 5;
        return {
          message: this.questions.medications,
          step: 5
        };

      case 5: // الأدوية
        state.answers.medications = message;
        state.step = 6;
        return {
          message: this.questions.allergies,
          options: ["بنسلين", "مخدر", "لا شيء"],
          step: 6
        };

      case 6: // الحساسية
        state.answers.allergies = message;
        state.step = 7;
        return {
          message: this.questions.last_visit,
          options: ["أقل من ٦ شهور", "٦ شهور - سنة", "أكثر من سنة", "أول مرة"],
          step: 7
        };

      case 7: // آخر زيارة
        state.answers.last_visit = message;
        state.step = 8;
        return {
          message: "شكراً! بناءً على إجاباتك، هل تفضل:\n" +
                   "🔹 موعد صباحي (٩ص - ١٢م)\n" +
                   "🔹 موعد مسائي (٤م - ٩م)\n" +
                   "🔹 تحديد موعد محدد",
          options: ["صباحي", "مسائي", "تحديد"],
          step: 8
        };

      case 8: // تفضيل الوقت
        if (message === "تحديد") {
          return {
            message: "أدخل الوقت المحدد (مثال: ٥:٣٠ مساءً)",
            step: 9
          };
        } else {
          state.answers.time_preference = message;
          // هنا بنرسل البيانات للسيرفر
          return this.completeBooking(userId, state.answers);
        }

      default:
        return {
          message: "عفواً، حدث خطأ. هل تريد البدء من جديد؟",
          options: ["نعم", "لا"]
        };
    }
  }

  async completeBooking(userId, answers) {
    // توليد ملخص ذكي للحالة
    const summary = generateAISummary(answers);
    
    // توليد نصائح
    const tips = generateSmartTips(answers);
    
    // هنا بنفتح نموذج الحجز مع البيانات المجمعة
    return {
      message: "✅ رائع! تم تجميع كل المعلومات.\n\n" +
               "📋 **ملخص حالتك:**\n" + summary + "\n\n" +
               "💡 **نصائح سريعة:**\n" + tips.map(t => "• " + t).join("\n") + "\n\n" +
               "الرجاء إكمال بياناتك في النموذج أدناه:",
      completeBooking: true,
      answers: answers
    };
  }
}

window.aiAssistant = new DentalAIAssistant();