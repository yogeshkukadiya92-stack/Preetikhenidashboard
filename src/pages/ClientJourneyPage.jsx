import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { loadAllLocalResponses, loadForms } from '../data/formStore.js';

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

function clientName(row) {
  return Array.isArray(row) ? (row.length >= 7 ? row[1] : row[0]) : row?.name ?? row?.Client ?? row?.client ?? '';
}

function clientMobile(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[2] ?? '' : row[1] ?? '';
  return row?.mobile ?? row?.Mobile ?? row?.phone ?? row?.Phone ?? '';
}

function clientId(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[0] ?? '' : '';
  return row?.clientId ?? row?.['Client ID'] ?? row?.ClientId ?? row?.ID ?? row?.id ?? '';
}

function clientAge(row) {
  if (Array.isArray(row)) return row.length >= 8 ? row[5] ?? '' : row.length >= 7 ? row[4] ?? '' : row[3] ?? '';
  return row?.age ?? row?.Age ?? '';
}

function clientBirthday(row) {
  if (Array.isArray(row)) return row.length >= 8 ? row[4] ?? '' : row.length >= 7 ? row[3] ?? '' : row[2] ?? '';
  return row?.birthday ?? row?.Birthday ?? row?.dob ?? row?.DOB ?? row?.dateOfBirth ?? row?.['Date of Birth'] ?? '';
}

function clientGender(row) {
  if (Array.isArray(row)) return '';
  return row?.gender ?? row?.Gender ?? row?.sex ?? row?.Sex ?? '';
}

function patientAgeGender(row) {
  const birthday = clientBirthday(row);
  const birthDate = birthday ? new Date(birthday) : null;
  let age = String(clientAge(row) ?? '').trim();
  if (birthDate && !Number.isNaN(birthDate.getTime()) && birthDate <= new Date()) {
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (today.getDate() < birthDate.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    age = `${years}y${months}m`;
  }
  const gender = String(clientGender(row) ?? '').trim();
  const formattedAge = age && /^\d+(?:\.\d+)?$/.test(age) ? `${age}y` : age;
  const formattedGender = gender ? gender.slice(0, 1).toUpperCase() : '';
  return [formattedAge, formattedGender].filter(Boolean).join(', ');
}

function patientIdentity(name, row) {
  const id = String(clientId(row) ?? '').replace(/^#/, '');
  const demographics = patientAgeGender(row);
  return `${name}${id ? ` (#${id})` : ''}${demographics ? `, ${demographics}` : ''}`;
}

function clinicalMedicines(treatmentData = {}) {
  if (Array.isArray(treatmentData.medicines)) {
    return treatmentData.medicines.filter((item) => item?.medicine);
  }
  return String(treatmentData.medicine ?? '').split(',').map((medicine, index) => ({
    medicine: medicine.trim(),
    dose: String(treatmentData.dose ?? '').split(',')[index]?.trim() ?? '',
    timing: String(treatmentData.timing ?? '').split(',')[index]?.trim() ?? '',
  })).filter((item) => item.medicine);
}

function consultationSectionsFromData(data = {}) {
  if (Array.isArray(data?.sections) && data.sections.length > 0) {
    return data.sections.map((sec, idx) => ({
      id: sec.id || `consultation-sec-${idx + 1}`,
      service: sec.service || 'Consultation',
      complaint: sec.complaint || '',
      notes: sec.notes || '',
      vitals: sec.vitals || '',
      diagnosis: sec.diagnosis || '',
      investigation: sec.investigation || '',
      doctorNotes: sec.doctorNotes || '',
    }));
  }
  if (data && (data.complaint || data.notes || data.vitals || data.diagnosis || data.investigation || data.doctorNotes || data.service)) {
    return [{
      id: 'consultation-sec-1',
      service: data.service || 'Consultation',
      complaint: data.complaint || '',
      notes: data.notes || '',
      vitals: data.vitals || '',
      diagnosis: data.diagnosis || '',
      investigation: data.investigation || '',
      doctorNotes: data.doctorNotes || '',
    }];
  }
  return [{
    id: 'consultation-sec-1',
    service: 'Consultation',
    complaint: '',
    notes: '',
    vitals: '',
    diagnosis: '',
    investigation: '',
    doctorNotes: '',
  }];
}

function treatmentSectionsFromData(data = {}) {
  if (Array.isArray(data?.sections) && data.sections.length > 0) {
    return data.sections.map((sec, idx) => {
      const medicines = Array.isArray(sec.medicines) && sec.medicines.length > 0
        ? sec.medicines
        : (sec.medicine ? clinicalMedicines(sec) : [{ medicine: '', dose: '', timing: '' }]);
      return {
        id: sec.id || `treatment-sec-${idx + 1}`,
        service: sec.service || 'Consultation',
        goal: sec.goal || '',
        duration: sec.duration || '30 days',
        status: sec.status || 'Active',
        medicines: medicines.length ? medicines : [{ medicine: '', dose: '', timing: '' }],
      };
    });
  }
  if (data && (data.service || data.goal || data.medicines?.length || data.medicine)) {
    const medicines = clinicalMedicines(data);
    return [{
      id: 'treatment-sec-1',
      service: data.service || 'Consultation',
      goal: data.goal || '',
      duration: data.duration || '30 days',
      status: data.status || 'Active',
      medicines: medicines.length > 0 ? medicines : [{ medicine: '', dose: '', timing: '' }],
    }];
  }
  return [{
    id: 'treatment-sec-1',
    service: 'Consultation',
    goal: '',
    duration: '30 days',
    status: 'Active',
    medicines: [{ medicine: '', dose: '', timing: '' }],
  }];
}

function clientVisitDate(row) {
  if (Array.isArray(row)) return row.length >= 8 ? row[3] ?? '' : '';
  return row?.visitDate ?? row?.['Visit Date'] ?? row?.createdAt ?? row?.date ?? '';
}

function dateTimeValue(date, time = '') {
  if (!date) return 0;
  const normalizedDate = String(date).slice(0, 10);
  const normalizedTime = String(time || '00:00').slice(0, 5);
  const value = new Date(`${normalizedDate}T${normalizedTime}`).getTime();
  return Number.isFinite(value) ? value : 0;
}

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reception priority keeps today's work first. Future appointments remain at
// the bottom until their date arrives, while completed/past visits follow today.
function journeyPriority(date, time = '', today = localDateKey()) {
  const dateKey = String(date ?? '').slice(0, 10);
  const value = dateTimeValue(dateKey, time);
  if (!dateKey || !value) return { group: 3, value: 0 };
  if (dateKey === today) return { group: 0, value };
  if (dateKey < today) return { group: 1, value };
  return { group: 2, value };
}

function formatJourneyDateTime(date, time = '') {
  const value = dateTimeValue(date, time);
  if (!value) return 'No visit yet';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function normalizePersonName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(dr|doctor|mr|mrs|ms|miss|shri|smt)\.?\s+/i, '')
    .replace(/[^a-z0-9\u0900-\u097f\u0a80-\u0aff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function answerValue(response, matcher) {
  const answers = response?.answers ?? {};
  return Object.entries(answers).find(([key]) => matcher(key))?.[1] ?? '';
}

function responseFieldValue(response, form, matcher) {
  const field = form?.fields?.find((item) => matcher(item));
  if (!field) return '';
  return response?.answers?.[field.id] ?? '';
}

function responsePhone(response, form) {
  const phoneMatcher = (value) => /phone|mobile|whats?\s*app|contact\s*(?:no|number)?|મોબાઇલ|मोबाइल/i.test(String(value ?? ''));
  const value = responseFieldValue(response, form, (field) => field.type === 'phone' || phoneMatcher(field.label))
    || answerValue(response, phoneMatcher);
  return normalizePhoneNumber(value);
}

function responseName(response, form) {
  const value = responseFieldValue(response, form, (field) => /name|client|patient/i.test(field.label))
    || answerValue(response, (key) => /name|client|patient/i.test(key));
  return normalizePersonName(value);
}

function formTitle(form) {
  return String(form?.title || form?.name || form?.slug || form?.id || '').trim();
}

function formatResponseDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function displayAnswer(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value && typeof value === 'object') return value.name ?? value.url ?? JSON.stringify(value);
  return String(value ?? '').trim();
}

function escapePrintHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function responsePreview(response, form) {
  const answers = response?.answers && typeof response.answers === 'object' ? response.answers : {};
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const labelsById = new Map(fields.map((field) => [field.id, field.label || field.id]));
  return Object.entries(answers)
    .map(([key, value]) => [labelsById.get(key) ?? key, displayAnswer(value)])
    .filter(([, value]) => value)
    .slice(0, 4);
}

function clinicalListItems(value) {
  return String(value ?? '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

const STAGES = [
  ['registration', 'Registration'],
  ['appointment', 'Appointment'],
  ['consultation', 'Doctor Consultation'],
  ['treatment', 'Treatment Plan'],
  ['diet', 'Diet Plan (Optional)'],
  ['billing', 'Invoice & Payment'],
  ['followup', 'Next Follow-up'],
  ['forms', 'Required Forms'],
];

const DIAGNOSIS_OPTIONS = ['General consultation', 'Obesity', 'Prediabetes', 'Type 2 diabetes', 'Hypertension', 'Dyslipidemia', 'Hypothyroidism', 'PCOS', 'Digestive disorder', 'Joint disorder', 'Skin disorder', 'Hair disorder', 'Stress-related condition'];
const NOTE_OPTIONS = ['Diet and lifestyle counselling given', 'Continue current medicines', 'Lab tests advised', 'Hydration and sleep guidance given', 'Review after 7 days', 'Review after 15 days', 'Review after 30 days'];
const VITAL_OPTIONS = ['BP 120/80, Pulse 72', 'BP 130/80, Pulse 76', 'BP 140/90, Pulse 80', 'Vitals stable'];
const SERVICE_OPTIONS = ['Consultation', 'Follow-up', 'Weight Loss', 'Skin Care', 'Hair Treatment', 'Panchakarma', 'Garbhasanskar', 'Diet Counseling', 'Therapy Session'];
const DURATION_OPTIONS = ['7 days', '15 days', '30 days', '45 days', '60 days', '90 days', '120 days'];
const PAYMENT_AMOUNTS = ['500', '1000', '1500', '3000', '5000', '10000'];
const QUICK_TREATMENTS = [
  { label: 'Weight loss', service: 'Weight Loss', goal: 'Weight loss and inch loss', duration: '90 days' },
  { label: 'Follow-up', service: 'Follow-up', goal: 'Review progress and continue plan', duration: '30 days' },
  { label: 'Skin care', service: 'Skin Care', goal: 'Improve skin health', duration: '45 days' },
  { label: 'Hair care', service: 'Hair Treatment', goal: 'Reduce hair fall and support regrowth', duration: '60 days' },
];
const QUICK_CONSULTATIONS = [
  { label: 'Weight loss', complaint: 'Weight gain, Fatigue', diagnosis: 'Obesity', notes: 'Diet and lifestyle counselling given', vitals: 'Vitals stable' },
  { label: 'Diabetes', complaint: 'High blood sugar, Fatigue', diagnosis: 'Type 2 diabetes', notes: 'Lab tests advised', vitals: 'BP 130/80, Pulse 76' },
  { label: 'Acidity', complaint: 'Acidity, Bloating, Poor appetite', diagnosis: 'Digestive disorder', notes: 'Hydration and sleep guidance given', vitals: 'Vitals stable' },
  { label: 'Hair fall', complaint: 'Hair fall, Stress', diagnosis: 'Hair disorder', notes: 'Review after 30 days', vitals: 'Vitals stable' },
];

export const COMMON_MEAL_NAMES = [
  'Early Morning',
  'Breakfast',
  'Mid-Morning Snack',
  'Lunch',
  'Evening Snack',
  'Dinner',
  'Bedtime Drink',
];

export const DIET_GOAL_PRESETS = [
  'Fat loss & Metabolism',
  'PCOS / Hormonal balance',
  'Garbh Sanskar & Prenatal nutrition',
  'Ayurvedic Detox (Deepana / Pachana)',
  'Diabetes & Blood sugar control',
  'Muscle gain & Vitality (Dhatu Poshan)',
  'Thyroid care & Weight control',
  'Digestive health & Acidity relief',
];

export const CLINICAL_DIET_PRESETS = [
  {
    id: 'fatLoss',
    label: '🥗 Fat Loss & Metabolism',
    goal: 'Fat loss & Weight Management',
    calories: '1200-1400 kcal',
    water: '2.5-3.0 L',
    duration: '30 days',
    service: 'Diet Counseling',
    weekLabel: 'Phase 1 - Detox & Fat Loss',
    instructions: '• Drink 1 glass of warm water 30 mins before meals.\n• Finish light dinner before 7:30 PM.\n• 100 steps gentle walk (Shatapadi) after lunch and dinner.\n• Strictly avoid cold drinks, refined white sugar, maida, and deep-fried items.',
    meals: [
      { time: '06:30', meal: 'Early Morning', food: '1 glass warm lemon water with chia seeds + 4 soaked almonds', notes: 'Drink warm sitting down' },
      { time: '08:30', meal: 'Breakfast', food: 'Moong dal chilla with mint coriander chutney OR vegetable oats', notes: 'High protein, low oil' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: '1 fresh seasonal fruit (Apple / Papaya / Guava) + Green tea', notes: 'No fruit juice' },
      { time: '13:30', meal: 'Lunch', food: '1 Jowar/Bajra rotla + 1 bowl green vegetable + 1 bowl thin dal + cucumber salad', notes: 'Chew slowly 32 times' },
      { time: '17:00', meal: 'Evening Snack', food: 'Roasted makhana OR boiled chana chaat + herbal tea', notes: 'Light healthy snack' },
      { time: '19:30', meal: 'Dinner', food: '1 bowl bottle gourd (Lauki) soup OR warm Moong khichdi', notes: 'Finish before 8:00 PM' },
      { time: '21:30', meal: 'Bedtime Drink', food: 'Warm water with 1/2 tsp triphala powder', notes: 'Supports overnight digestion' },
    ],
  },
  {
    id: 'garbhsanskar',
    label: '🤰 Garbh Sanskar & Prenatal',
    goal: 'Prenatal Nutrition & Fetal Development',
    calories: '1800-2200 kcal',
    water: '2.5-3.0 L',
    duration: '30 days',
    service: 'Garbhsanskar Diet',
    weekLabel: 'Trimester Nutrition',
    instructions: '• Pure Sattvic freshly prepared diet with Cow Ghee (Ghrit).\n• Soak all nuts overnight before eating.\n• Keep adequate hydration with coconut water and buttermilk.\n• Positive, calm mindset while taking meals.',
    meals: [
      { time: '06:30', meal: 'Early Morning', food: '1 glass warm cow milk with saffron (Kesar) + 5 soaked almonds + 1 walnut', notes: 'Nourishes Ojas' },
      { time: '08:30', meal: 'Breakfast', food: 'Vegetable Dalia / Sheera with dry fruits / Poha with sprouts', notes: 'Nutrient rich' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: '1 glass fresh tender coconut water + pomegranate / apple', notes: 'Electrolytes & iron' },
      { time: '13:00', meal: 'Lunch', food: '2 Rotis with 1 tsp A2 Cow Ghee + Dal + Seasonal sabzi + Rice + Buttermilk', notes: 'Complete balanced thali' },
      { time: '17:00', meal: 'Evening Snack', food: 'Roasted makhana / Til-Gud laddoo / Fruit smoothie', notes: 'Natural calcium' },
      { time: '19:30', meal: 'Dinner', food: 'Light Moong khichdi with ghee + vegetable soup', notes: 'Easy to digest' },
      { time: '21:30', meal: 'Bedtime Drink', food: 'Warm milk with pinch of turmeric & cardamom', notes: 'Promotes sound sleep' },
    ],
  },
  {
    id: 'pcos',
    label: '🩺 PCOS & Hormonal Balance',
    goal: 'PCOS Management & Insulin Sensitivity',
    calories: '1300-1500 kcal',
    water: '2.5-3.0 L',
    duration: '30 days',
    service: 'Diet Counseling',
    weekLabel: 'Hormonal Reset',
    instructions: '• Low glycemic index (GI) foods.\n• Practice seed cycling (Flax & Pumpkin in follicular phase; Sesame & Sunflower in luteal phase).\n• Avoid dairy, refined carbs, and processed packaged foods.\n• Sleep by 10:30 PM to optimize endocrine rhythm.',
    meals: [
      { time: '06:30', meal: 'Early Morning', food: 'Warm fenugreek (Methi) soaked water + 1 tbsp ground flaxseeds', notes: 'Insulin sensitizer' },
      { time: '08:30', meal: 'Breakfast', food: 'Besan vegetable chilla + mint coriander chutney', notes: 'High fiber & protein' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: '1 cup green tea / spearmint tea + 1 fistful roasted pumpkin seeds', notes: 'Hormone balance' },
      { time: '13:30', meal: 'Lunch', food: '1 Multigrain roti + green leafy vegetable + boiled sprouts / dal + salad', notes: 'Rich in antioxidants' },
      { time: '17:00', meal: 'Evening Snack', food: 'Sprouted moong chaat OR cucumber carrot sticks with hummus', notes: 'Low sugar snack' },
      { time: '19:30', meal: 'Dinner', food: 'Vegetable stir-fry + paneer / tofu soup OR vegetable dalia', notes: 'Light carb dinner' },
      { time: '21:30', meal: 'Bedtime Drink', food: 'Warm chamomile or spearmint tea', notes: 'Anti-androgenic' },
    ],
  },
  {
    id: 'detox',
    label: '🥣 Deepana & Pachana (Ayurvedic Detox)',
    goal: 'Agni Deepana & Ama Pachana (Digestive Reset)',
    calories: '1200 kcal',
    water: '3.0 L',
    duration: '15 days',
    service: 'Diet Counseling',
    weekLabel: 'Digestive Reset',
    instructions: '• Consume only freshly cooked warm meals (Koshna Ahara).\n• Sip warm water boiled with Cumin, Coriander, and Fennel (CCF tea) throughout the day.\n• Strictly no cold, oily, heavy, or curd preparations.\n• Stop eating when 75% full (Aharamatra).',
    meals: [
      { time: '07:00', meal: 'Early Morning', food: '1 cup warm ginger-cumin-coriander infusion', notes: 'Stimulates digestive fire' },
      { time: '08:30', meal: 'Breakfast', food: 'Warm rice porridge (Peya) OR roasted suji upma with ginger', notes: 'Light and warm' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: 'Warm CCF (Cumin-Coriander-Fennel) herbal tea', notes: 'Sip slowly' },
      { time: '13:00', meal: 'Lunch', food: 'Yellow Moong dal soup (Yusha) with 1 light phulka + steamed bottle gourd', notes: 'Pachana Ahara' },
      { time: '16:30', meal: 'Evening Snack', food: 'Warm water with pinch of roasted jeera powder', notes: 'Digestive aid' },
      { time: '19:00', meal: 'Dinner', food: 'Thin Moong khichdi tempered with ghee, cumin & hing', notes: 'Finished before dusk' },
      { time: '21:00', meal: 'Bedtime Drink', food: 'Warm water with dash of ajwain and rock salt', notes: 'Prevents morning bloating' },
    ],
  },
  {
    id: 'diabetes',
    label: '🩸 Diabetes & Metabolic Care',
    goal: 'Blood Sugar Regulation & HbA1c Control',
    calories: '1400-1600 kcal',
    water: '2.5 L',
    duration: '30 days',
    service: 'Diet Counseling',
    weekLabel: 'Glycemic Control',
    instructions: '• Complex carbohydrates only (Barley, Methi, Oats, Millets).\n• Include bitter & astringent tastes (Tikta & Kashaya Rasa) like Karela, Jamun, Methi.\n• Regular interval meals: avoid long fasting and overeating.\n• Minimum 30 mins brisk walking morning & evening.',
    meals: [
      { time: '06:30', meal: 'Early Morning', food: 'Soaked Methi dana water + chew the seeds + 4 soaked almonds', notes: 'Glucose regulation' },
      { time: '08:30', meal: 'Breakfast', food: 'Barley (Jau) porridge / Methi thepla with curd (skimmed)', notes: 'Low glycemic load' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: '1 small apple or amla juice + roasted flaxseeds', notes: 'Antioxidant rich' },
      { time: '13:30', meal: 'Lunch', food: '1 Multigrain roti (Jau-Chana-Wheat) + 1 bowl Karela/Bhindi sabzi + 1 bowl Dal + salad', notes: 'High fiber' },
      { time: '17:00', meal: 'Evening Snack', food: 'Roasted makhana + green tea (no sugar)', notes: 'Safe snacking' },
      { time: '19:30', meal: 'Dinner', food: 'Vegetable daliya OR mixed vegetable clear soup with tofu/paneer', notes: 'No rice at night' },
      { time: '21:30', meal: 'Bedtime Drink', food: 'Warm water with pinch of cinnamon powder', notes: 'Maintains nocturnal fasting sugar' },
    ],
  },
  {
    id: 'vitality',
    label: '💪 Vitality & Dhatu Poshan',
    goal: 'Muscle Tone, Stamina & Dhatu Poshan',
    calories: '2000-2400 kcal',
    water: '3.0 L',
    duration: '30 days',
    service: 'Diet Counseling',
    weekLabel: 'Strength & Nourishment',
    instructions: '• Protein and micronutrient-dense Sattvic nutrition.\n• Natural healthy fats: Cow Ghee, Almonds, Walnuts, Sesame seeds.\n• Strength training or Yoga followed by immediate post-workout nourishment.',
    meals: [
      { time: '06:30', meal: 'Pre-Workout', food: '1 Banana + 5 soaked almonds + 2 dates + warm water', notes: 'Energy boost' },
      { time: '08:30', meal: 'Breakfast', food: 'Paneer bhurji / Boiled sprouts + Oats with milk and honey', notes: 'High protein' },
      { time: '11:00', meal: 'Mid-Morning Snack', food: 'Seasonal fruit + 1 handful mixed seeds (Pumpkin, Chia, Sunflower)', notes: 'Micronutrients' },
      { time: '13:30', meal: 'Lunch', food: '2 Rotis with ghee + 1 bowl dense Dal/Rajma + Paneer sabzi + Brown rice + Salad', notes: 'Anabolic nutrition' },
      { time: '17:00', meal: 'Evening Snack', food: 'Sattu drink (sweet or salted) OR Peanut butter toast / Sweet potato', notes: 'Sustained energy' },
      { time: '20:00', meal: 'Dinner', food: 'Paneer/Lentil soup + Roti + cooked greens + fresh salad', notes: 'Muscle recovery' },
      { time: '21:30', meal: 'Bedtime Drink', food: 'Warm milk with 1 tsp Ashwagandha & pinch of nutmeg', notes: 'Tissue regeneration (Rasayana)' },
    ],
  },
];

export const QUICK_MEAL_SLOTS = [
  { time: '06:30', meal: 'Early Morning', food: '', notes: '' },
  { time: '08:30', meal: 'Breakfast', food: '', notes: '' },
  { time: '11:00', meal: 'Mid-Morning Snack', food: '', notes: '' },
  { time: '13:30', meal: 'Lunch', food: '', notes: '' },
  { time: '17:00', meal: 'Evening Snack', food: '', notes: '' },
  { time: '19:30', meal: 'Dinner', food: '', notes: '' },
  { time: '21:30', meal: 'Bedtime Drink', food: '', notes: '' },
];

export const AYURVEDIC_GUIDELINES = [
  'Drink 2-3 glasses of warm/lukewarm water throughout the day.',
  'Strictly avoid cold water, refrigerated drinks, and leftover refrigerated food.',
  'Finish light dinner before 8:00 PM to facilitate optimal digestion (Agni).',
  'Gentle 100-step walk (Shatapadi) after lunch and dinner.',
  'Eat mindfully in a calm seated posture; chew food 32 times.',
  'Maintain a 3 to 4 hour gap between main meals; avoid frequent snacking.',
  'Avoid refined white sugar, maida, processed packaged foods, and bakery items.',
  'Avoid curd (dahi) and sour foods at night.',
  'Drink 1 cup of warm turmeric/nutmeg milk before sleeping for restorative sleep.',
  'Practice seed cycling as advised for hormonal and menstrual balance.',
];

export const DEFAULT_DIET_MEALS = [
  { time: '06:30', meal: 'Early Morning', food: '1 glass warm lemon/methi water + 4 soaked almonds', notes: 'Start hydration' },
  { time: '08:30', meal: 'Breakfast', food: 'Moong dal chilla / Vegetable oats + green tea', notes: 'Low oil, high protein' },
  { time: '11:00', meal: 'Mid-Morning Snack', food: '1 seasonal fresh fruit', notes: 'Chew well' },
  { time: '13:30', meal: 'Lunch', food: '1-2 Jowar rotla + green sabzi + dal + cucumber salad', notes: 'Balanced meal' },
  { time: '17:00', meal: 'Evening Snack', food: 'Roasted makhana + herbal tea', notes: 'Light snack' },
  { time: '19:30', meal: 'Dinner', food: 'Thin Moong khichdi with ghee OR bottle gourd soup', notes: 'Finish before 8:00 PM' },
];

function escapeDietHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function fileSafeDietName(value) {
  return String(value || 'diet-plan').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'diet-plan';
}

function buildDietPlanPrintHtml(plan) {
  const mealRows = (plan.meals ?? []).map((meal) => `
    <tr>
      <td style="font-weight:700;color:#138f86;white-space:nowrap;padding:10px 12px;border-bottom:1px solid #e2ece8;">${escapeDietHtml(meal.time)}</td>
      <td style="font-weight:700;color:#1f6b4a;white-space:nowrap;padding:10px 12px;border-bottom:1px solid #e2ece8;">${escapeDietHtml(meal.meal)}</td>
      <td style="line-height:1.5;padding:10px 12px;border-bottom:1px solid #e2ece8;white-space:pre-wrap;">${escapeDietHtml(meal.food)}</td>
      <td style="color:#57766d;font-size:12px;line-height:1.45;padding:10px 12px;border-bottom:1px solid #e2ece8;white-space:pre-wrap;">${escapeDietHtml(meal.notes || '—')}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Diet Plan - ${escapeDietHtml(plan.client || 'Patient')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #163f33; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #138f86; padding-bottom: 14px; margin-bottom: 20px; }
    .logo-box h1 { margin: 0; font-size: 22px; color: #1f6b4a; }
    .logo-box p { margin: 4px 0 0; color: #57766d; font-size: 13px; font-weight: 500; }
    .patient-badge { text-align: right; background: #f0f7f4; padding: 8px 14px; border-radius: 8px; border: 1px solid #d3e7df; }
    .patient-badge strong { font-size: 15px; color: #163f33; display: block; }
    .patient-badge span { font-size: 12px; color: #57766d; }
    .plan-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #fafdfc; border: 1px solid #dcebe5; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; }
    .meta-item span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6f8d83; font-weight: 600; }
    .meta-item strong { font-size: 13.5px; color: #163f33; margin-top: 2px; display: block; }
    h2 { font-size: 15px; color: #1f6b4a; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid #138f86; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; background: #fff; }
    thead th { background: #eaf5f1; color: #163f33; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; text-align: left; border-bottom: 2px solid #c8ded6; }
    .instructions-box { background: #fcfdfd; border: 1px solid #dcebe5; border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #2c4e43; white-space: pre-wrap; margin-top: 8px; }
    .toolbar { display: flex; gap: 10px; margin-bottom: 24px; }
    .toolbar button { border: none; background: #138f86; color: #fff; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @page { margin: 14mm; }
    @media print {
      .toolbar { display: none; }
      body { margin: 0; }
      thead th { background: #eaf5f1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .plan-meta-grid, .patient-badge, .instructions-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="logo-box">
      <h1>SHREE AYURVED HOSPITAL & CLINIC</h1>
      <p>Personalized Ayurvedic Diet & Lifestyle Protocol • Mom's Pathshala</p>
    </div>
    <div class="patient-badge">
      <strong>${escapeDietHtml(plan.client || 'Patient')}</strong>
      <span>Date: ${escapeDietHtml(plan.planDate || new Date().toISOString().slice(0, 10))}</span>
    </div>
  </div>

  <div class="plan-meta-grid">
    <div class="meta-item"><span>Clinical Goal</span><strong>${escapeDietHtml(plan.goal || '—')}</strong></div>
    <div class="meta-item"><span>Service</span><strong>${escapeDietHtml(plan.service || 'Diet Counseling')}</strong></div>
    <div class="meta-item"><span>Duration</span><strong>${escapeDietHtml(plan.duration || '30 days')}</strong></div>
    <div class="meta-item"><span>Phase / Week</span><strong>${escapeDietHtml(plan.weekLabel || 'Phase 1')}</strong></div>
    <div class="meta-item"><span>Target Calories</span><strong>${escapeDietHtml(plan.calories || 'As per advice')}</strong></div>
    <div class="meta-item"><span>Daily Water Intake</span><strong>${escapeDietHtml(plan.water || '2.5 - 3.0 L')}</strong></div>
    <div class="meta-item"><span>Total Meals</span><strong>${plan.meals?.length || 0} meals/day</strong></div>
    <div class="meta-item"><span>Consultant</span><strong>Ayurvedic Consultant</strong></div>
  </div>

  <h2>Daily Meal Schedule</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Time</th>
        <th style="width: 20%;">Meal</th>
        <th style="width: 44%;">Food Items & Nutrition</th>
        <th style="width: 22%;">Guidelines & Notes</th>
      </tr>
    </thead>
    <tbody>
      ${mealRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#6f8d83;">No meal schedule specified.</td></tr>'}
    </tbody>
  </table>

  ${plan.instructions ? `
    <h2>Dietary Guidelines & Precautions (Pathya / Apathya)</h2>
    <div class="instructions-box">${escapeDietHtml(plan.instructions)}</div>
  ` : ''}

  <div style="margin-top: 30px; border-top: 1px dashed #c8ded6; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #6f8d83;">
    <span>Shree Ayurved Hospital • Health & Wellness Care</span>
    <span>Consult doctor before modifying prescription.</span>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

function newDietPlan(client = '') {
  return {
    id: `diet-plan-${Date.now()}`,
    client,
    service: 'Diet Counseling',
    goal: 'Fat loss',
    duration: '30 days',
    planDate: currentSlot().date,
    weekLabel: 'Phase 1 - Detox',
    calories: '1200-1400 kcal',
    water: '2.5-3.0 L',
    instructions: '• Drink warm water throughout the day.\n• Finish light dinner before 8:00 PM.\n• 100 steps walk (Shatapadi) after meals.',
    meals: DEFAULT_DIET_MEALS.map((meal) => ({ ...meal })),
  };
}

const PRINT_SECTION_OPTIONS = [
  ['patient', 'Patient Details'],
  ['symptoms', 'Presenting Complaints'],
  ['vitals', 'Vitals'],
  ['diagnosis', 'Diagnosis'],
  ['investigation', 'Investigation'],
  ['history', 'History & Examination'],
  ['doctorNotes', 'Doctor Notes'],
  ['pregnancyHistory', 'Pregnancy / Garbhsanskar History'],
  ['treatment', 'Treatment Plan'],
  ['medicines', 'Medicines, Dose & Timing'],
  ['followup', 'Next Follow-up'],
  ['payment', 'Payment Details'],
];

function currentSlot() {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeAppointments(rows = []) {
  return rows.map((row) => row.length >= 7 ? [row[0], row[1], row[2], row[3], row[4], row[6] || row[5] || 'Pending'] : row.slice(0, 6));
}

function visitDateFromJourney(visit) {
  return visit?.visitDate
    || visit?.appointmentData?.date
    || String(visit?.appointmentAt ?? visit?.consultedAt ?? visit?.updatedAt ?? '').slice(0, 10)
    || currentSlot().date;
}

function normalizeJourneyRecord(record) {
  if (Array.isArray(record?.visits)) {
    const visits = record.visits.map((visit, index) => ({
      ...visit,
      id: visit.id || `visit-${visitDateFromJourney(visit)}-${index}`,
      visitDate: visitDateFromJourney(visit),
    }));
    return { visits, activeVisitId: record.activeVisitId || visits.at(-1)?.id || '' };
  }
  if (!record || !Object.keys(record).length) return { visits: [], activeVisitId: '' };
  const legacyVisit = {
    ...record,
    id: `visit-${visitDateFromJourney(record)}-legacy`,
    visitDate: visitDateFromJourney(record),
  };
  return { visits: [legacyVisit], activeVisitId: legacyVisit.id };
}

function nextInvoice(rows = []) {
  const highest = rows.reduce((max, row) => {
    const value = Array.isArray(row) ? row[1] : row?.invoice;
    const match = String(value ?? '').match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `INV-${String(highest + 1).padStart(3, '0')}`;
}

function parsePaymentAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculatePaymentPending(totalAmount, paidAmount, status) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(paidAmount);
  const normalizedStatus = String(status ?? '').toLowerCase();
  if (normalizedStatus === 'paid') return 0;
  if (normalizedStatus === 'pending' && !paid) return total;
  return Math.max(total - paid, 0);
}

function normalizeJourneyPayment(entry) {
  const status = entry.status ?? 'Paid';
  const totalAmount = entry.amount ?? '';
  const paidAmount = entry.paidAmount ?? (String(status).toLowerCase() === 'paid' ? totalAmount : '');
  return {
    ...entry,
    amount: totalAmount,
    paidAmount,
    pendingAmount: totalAmount !== undefined && totalAmount !== ''
      ? calculatePaymentPending(totalAmount, paidAmount, status)
      : entry.pendingAmount,
  };
}

function SearchablePresetInput({ label, value, options, onChange, onSelect, onCommit, placeholder, action, helperText }) {
  const [focused, setFocused] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const keywords = query.split(/\s+/).filter(Boolean);
  const matches = query
    ? options.filter((option) => keywords.every((keyword) => option.toLowerCase().includes(keyword))).slice(0, 7)
    : [];

  const selectOption = (option) => {
    (onSelect ?? onChange)(option);
    setFocused(false);
  };

  return (
    <div className="field-block searchable-preset">
      <span>{label}</span>
      <div className="searchable-preset-row">
        <input
          className="lead-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !onCommit || !String(value ?? '').trim()) return;
            event.preventDefault();
            onCommit();
            setFocused(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={focused && Boolean(query)}
          aria-autocomplete="list"
        />
        {action}
      </div>
      {helperText && <small className="field-help">{helperText}</small>}
      {focused && query && (
        <div className="searchable-preset-results" role="listbox">
          {matches.length ? matches.map((option) => (
            <button
              type="button"
              role="option"
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          )) : <div className="searchable-preset-empty">No matching option. You can use the typed value.</div>}
        </div>
      )}
    </div>
  );
}

function ClinicalAutocompleteTextarea({ label, value, options, onChange, rows }) {
  const [focused, setFocused] = useState(false);
  const currentLine = String(value ?? '').split('\n').at(-1)?.trim() ?? '';
  const query = currentLine.toLowerCase();
  const matches = query
    ? options.filter((option) => option.toLowerCase().includes(query) && option.toLowerCase() !== query).slice(0, 7)
    : [];

  const selectOption = (option) => {
    const lines = String(value ?? '').split('\n');
    lines[lines.length - 1] = option;
    onChange(lines.join('\n'));
    setFocused(false);
  };

  return (
    <label className="field-block full-field clinical-autocomplete">
      <span>{label}</span>
      <textarea
        className="lead-input clinical-textarea"
        rows={rows}
        value={value}
        onChange={(event) => { onChange(event.target.value); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setFocused(false);
          if (event.key === 'Enter' && matches[0] && !event.shiftKey) {
            event.preventDefault();
            selectOption(matches[0]);
          }
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={focused && Boolean(query)}
        aria-autocomplete="list"
      />
      {focused && query && (
        <div className="clinical-autocomplete-results" role="listbox">
          {matches.map((option) => <button type="button" role="option" key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)}>{option}</button>)}
        </div>
      )}
    </label>
  );
}

function MedicineSearchInput({ index, value, catalog, onChange, onSelect, onAdd }) {
  const [focused, setFocused] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const matches = catalog
    .filter((item) => !query || `${item.Medicine} ${item['Default Dose'] || ''} ${item.Timing || ''}`.toLowerCase().includes(query))
    .slice(0, 8);
  const exactMatch = catalog.some((item) => item.Medicine.toLowerCase() === query);

  return (
    <div className="field-block searchable-preset medicine-search-picker">
      <span>Medicine {index + 1}</span>
      <input
        className="lead-input"
        value={value}
        onChange={(event) => { onChange(event.target.value); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setFocused(false);
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            onSelect(matches[0]);
            setFocused(false);
          }
        }}
        placeholder="Search medicine..."
        autoComplete="off"
        role="combobox"
        aria-expanded={focused}
        aria-autocomplete="list"
      />
      {focused && (
        <div className="searchable-field-results medicine-search-results" role="listbox">
          {matches.map((item) => (
            <button type="button" role="option" key={item.Medicine} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(item); setFocused(false); }}>
              <strong>{item.Medicine}</strong>
              <small>{[item['Default Dose'], item.Timing].filter(Boolean).join(' · ') || 'Dose and timing not saved'}</small>
            </button>
          ))}
          {query && !exactMatch && (
            <button className="medicine-add-result" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onAdd(); setFocused(false); }}>
              <strong>+ Add “{value.trim()}” as new medicine</strong>
              <small>Current dose and timing will be saved in Medicines master.</small>
            </button>
          )}
          {!matches.length && (!query || exactMatch) ? <div className="searchable-field-empty">No matching medicine found.</div> : null}
        </div>
      )}
    </div>
  );
}

export function ClientJourneyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branchKey } = useBranch();
  const clientsKey = branchKey('ayurflow-clients:rows:v3');
  const appointmentsKey = branchKey('Appointments:rows:v3');
  const paymentsKey = branchKey('ayurflow-payments:rows:v3');
  const operationsKey = branchKey('Operations:tabs:v3');
  const treatmentTemplatesKey = branchKey('treatment-templates:v2');
  const dietPlansKey = branchKey('diet-plans:v1');
  const dietTemplatesKey = branchKey('diet-templates:v1');
  const journeysKey = branchKey('client-journeys:v1');
  const consultationTemplatesKey = branchKey('consultation-templates:v1');
  const clinicalPrintTemplatesKey = branchKey('clinical-print-templates:v1');
  const patientFormUpdatesKey = branchKey('patient-form-updates:v1');
  const [clients, setClients] = useState(() => loadValue(clientsKey, []));
  const [journeys, setJourneys] = useState(() => loadValue(journeysKey, {}));
  const [selectedClient, setSelectedClient] = useState(() => searchParams.get('client') ?? '');
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [patientViewTab, setPatientViewTab] = useState('workflow');
  const [showMobileList, setShowMobileList] = useState(false);
  const [search, setSearch] = useState('');
  const [dietTemplates, setDietTemplates] = useState(() => loadValue(dietTemplatesKey, []));
  const [dietTemplateName, setDietTemplateName] = useState('');
  const [selectedDietPreset, setSelectedDietPreset] = useState('');
  const [dietToastMessage, setDietToastMessage] = useState('');
  const [todayKey, setTodayKey] = useState(() => localDateKey());
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [consultation, setConsultation] = useState({ complaint: '', diagnosis: '', investigation: '', notes: '', doctorNotes: '', vitals: '' });
  const [consultationSections, setConsultationSections] = useState(() => [
    { id: 'c-1', service: 'Consultation', complaint: '', diagnosis: '', investigation: '', notes: '', doctorNotes: '', vitals: '' }
  ]);
  const [sectionDoctorNoteChoices, setSectionDoctorNoteChoices] = useState({});
  const [consultationTemplates, setConsultationTemplates] = useState(() => loadValue(consultationTemplatesKey, []));
  const [consultationTemplateName, setConsultationTemplateName] = useState('');
  const [selectedConsultationTemplate, setSelectedConsultationTemplate] = useState('');
  const [treatmentTemplates, setTreatmentTemplates] = useState(() => loadValue(treatmentTemplatesKey, loadValue('ayurflow:treatment-templates:v1', [])));
  const [treatmentTemplateName, setTreatmentTemplateName] = useState('');
  const [selectedTreatmentTemplate, setSelectedTreatmentTemplate] = useState('');
  const [selectedPastTreatmentService, setSelectedPastTreatmentService] = useState('');
  const [pastTreatmentApplied, setPastTreatmentApplied] = useState(false);
  const customDoctorNotesKey = branchKey('consultation-custom-doctor-notes:v1');
  const [doctorNoteChoice, setDoctorNoteChoice] = useState('');
  const [customDoctorNotes, setCustomDoctorNotes] = useState(() => loadValue(customDoctorNotesKey, []));
  const [pregnancyHistoryOpen, setPregnancyHistoryOpen] = useState(false);
  const [pregnancyHistoryForm, setPregnancyHistoryForm] = useState(() => ({
    date: currentSlot().date,
    pregnancyStage: '',
    gynecName: '',
    gynecAdvice: '',
    tests: '',
    medicines: '',
    garbhsanskarAdvice: '',
    nextFollowup: '',
  }));
  const [stageModal, setStageModal] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(() => ({ mobile: '', ...currentSlot(), type: 'Consultation', status: 'Pending' }));
  const [requiredForm, setRequiredForm] = useState('Patient Intake Form');
  const [treatmentForm, setTreatmentForm] = useState({ service: 'Consultation', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
  const [dietPlanForm, setDietPlanForm] = useState(() => newDietPlan());
  const [treatmentMedicineRows, setTreatmentMedicineRows] = useState([{ medicine: '', dose: '', timing: '' }]);
  const [treatmentSections, setTreatmentSections] = useState(() => [
    { id: 't-1', service: 'Consultation', goal: '', duration: '30 days', status: 'Active', medicines: [{ medicine: '', dose: '', timing: '' }] }
  ]);
  const [treatmentSaveError, setTreatmentSaveError] = useState('');
  const [medicineCatalogRevision, setMedicineCatalogRevision] = useState(0);
  const [paymentForm, setPaymentForm] = useState({ invoice: '', amount: '', paidAmount: '', pendingAmount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
  const [followupForm, setFollowupForm] = useState(() => ({ date: addDays(7), time: currentSlot().time, notes: '', status: 'Confirmed' }));
  const [clinicalPrintOpen, setClinicalPrintOpen] = useState(false);
  const [clinicalPrintTitle, setClinicalPrintTitle] = useState('Consultation & Treatment Summary');
  const [clinicalPrintNote, setClinicalPrintNote] = useState('');
  const [clinicalPrintSections, setClinicalPrintSections] = useState(() => Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])));
  const [clinicalPrintVisitIds, setClinicalPrintVisitIds] = useState([]);
  const [clinicalPrintTemplates, setClinicalPrintTemplates] = useState(() => loadValue(clinicalPrintTemplatesKey, []));
  const [clinicalPrintTemplateName, setClinicalPrintTemplateName] = useState('');
  const [selectedClinicalPrintTemplate, setSelectedClinicalPrintTemplate] = useState('');
  const appointments = loadValue(appointmentsKey, []);
  const payments = loadValue(paymentsKey, []);
  const [localForms, setLocalForms] = useState(() => loadForms());
  const [localResponses, setLocalResponses] = useState(() => loadAllLocalResponses());
  const [patientFormUpdates, setPatientFormUpdates] = useState(() => loadValue(patientFormUpdatesKey, []));
  const formOptions = localForms.filter((form) => formTitle(form));
  const formByKey = new Map(localForms.flatMap((form) => [[form.id, form], [form.slug, form]].filter(([key]) => key)));
  const medicineCatalog = useMemo(() => {
    const operationRows = loadValue(operationsKey, {});
    return (Array.isArray(operationRows.medicines) ? operationRows.medicines : []).map((row) => Array.isArray(row)
      ? { Medicine: row[0] ?? '', 'Default Dose': row[2] ?? '', Timing: row[3] ?? '' }
      : row).filter((row) => row.Medicine);
  }, [operationsKey, medicineCatalogRevision]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setTodayKey(localDateKey()), nextMidnight.getTime() - now.getTime() + 100);
    return () => window.clearTimeout(timer);
  }, [todayKey]);

  useEffect(() => {
    const refresh = () => setClients(loadValue(clientsKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [clientsKey]);

  useEffect(() => {
    const refresh = () => setPatientFormUpdates(loadValue(patientFormUpdatesKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('moms-pathshala:cloud-hydrated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refresh);
    };
  }, [patientFormUpdatesKey]);

  useEffect(() => {
    const refreshFormsAndResponses = () => {
      setLocalForms(loadForms());
      setLocalResponses(loadAllLocalResponses());
    };
    window.addEventListener('focus', refreshFormsAndResponses);
    window.addEventListener('storage', refreshFormsAndResponses);
    window.addEventListener('moms-pathshala:cloud-hydrated', refreshFormsAndResponses);
    return () => {
      window.removeEventListener('focus', refreshFormsAndResponses);
      window.removeEventListener('storage', refreshFormsAndResponses);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refreshFormsAndResponses);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(journeysKey, JSON.stringify(journeys));
  }, [journeys, journeysKey]);

  useEffect(() => {
    window.localStorage.setItem(consultationTemplatesKey, JSON.stringify(consultationTemplates));
  }, [consultationTemplates, consultationTemplatesKey]);

  useEffect(() => {
    window.localStorage.setItem(treatmentTemplatesKey, JSON.stringify(treatmentTemplates));
  }, [treatmentTemplates, treatmentTemplatesKey]);

  useEffect(() => {
    window.localStorage.setItem(clinicalPrintTemplatesKey, JSON.stringify(clinicalPrintTemplates));
  }, [clinicalPrintTemplates, clinicalPrintTemplatesKey]);

  useEffect(() => {
    window.localStorage.setItem(customDoctorNotesKey, JSON.stringify(customDoctorNotes));
  }, [customDoctorNotes, customDoctorNotesKey]);

  useEffect(() => {
    if (!formOptions.length) return;
    if (formOptions.some((form) => formTitle(form).toLowerCase() === requiredForm.toLowerCase())) return;
    setRequiredForm(formTitle(formOptions[0]));
  }, [formOptions, requiredForm]);

  const clientRecords = useMemo(() => {
    const seen = new Set();
    return clients.filter((row) => {
      const name = clientName(row);
      if (!name) return false;
      const key = `${clientId(row) || name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clients]);
  const selectedClientRecord = useMemo(() => clients.find((row) => (
    clientName(row).toLowerCase() === selectedClient.toLowerCase()
    || clientId(row).toLowerCase() === selectedClient.toLowerCase()
  )), [clients, selectedClient]);
  const clientVisitMeta = useMemo(() => {
    const byName = new Map();
    const remember = (name, date, time = '') => {
      const key = normalizePersonName(name);
      const priority = journeyPriority(date, time, todayKey);
      const current = byName.get(key);
      if (!key || !priority.value) return;

      const shouldReplace = !current
        || priority.group < current.group
        || (priority.group === current.group && (
          priority.group === 2 ? priority.value < current.value : priority.value > current.value
        ));
      if (!shouldReplace) return;
      byName.set(key, {
        date: String(date).slice(0, 10),
        time: String(time ?? '').slice(0, 5),
        ...priority,
      });
    };
    appointments.forEach((row) => {
      if (Array.isArray(row)) remember(row[0], row[2], row[3]);
      else remember(row?.client ?? row?.Client ?? row?.name, row?.date ?? row?.['Visit Date'], row?.time);
    });
    clientRecords.forEach((row) => remember(clientName(row), clientVisitDate(row)));
    Object.entries(journeys).forEach(([name, record]) => {
      normalizeJourneyRecord(record).visits.forEach((visit) => remember(
        name,
        visit.appointmentData?.date ?? visit.visitDate,
        visit.appointmentData?.time ?? '',
      ));
    });
    return byName;
  }, [appointments, clientRecords, journeys, todayKey]);
  const visibleClients = useMemo(() => clientRecords
    .filter((row) => {
      const haystack = [clientId(row), clientName(row), clientMobile(row)].join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((left, right) => {
      const leftMeta = clientVisitMeta.get(normalizePersonName(clientName(left)));
      const rightMeta = clientVisitMeta.get(normalizePersonName(clientName(right)));
      const groupDifference = (leftMeta?.group ?? 3) - (rightMeta?.group ?? 3);
      if (groupDifference) return groupDifference;

      const leftValue = leftMeta?.value ?? 0;
      const rightValue = rightMeta?.value ?? 0;
      // Today's and past work is latest-first; future work is earliest-first.
      const timeDifference = leftMeta?.group === 2 ? leftValue - rightValue : rightValue - leftValue;
      return timeDifference || clientName(left).localeCompare(clientName(right));
    }), [clientRecords, clientVisitMeta, search]);
  const patientJourneyRecord = normalizeJourneyRecord(journeys[selectedClient]);
  const journeyVisits = patientJourneyRecord.visits;
  const activeVisitId = journeyVisits.some((visit) => visit.id === selectedVisitId)
    ? selectedVisitId
    : patientJourneyRecord.activeVisitId || journeyVisits.at(-1)?.id || '';
  const journey = journeyVisits.find((visit) => visit.id === activeVisitId) ?? {};
  const activeVisitIndex = journeyVisits.findIndex((visit) => visit.id === activeVisitId);
  const previousConsultationVisit = (activeVisitIndex >= 0 ? journeyVisits.slice(0, activeVisitIndex) : journeyVisits)
    .slice()
    .reverse()
    .find((visit) => visit?.consultationData);
  const previousTreatmentVisit = (activeVisitIndex >= 0 ? journeyVisits.slice(0, activeVisitIndex) : journeyVisits)
    .slice()
    .reverse()
    .find((visit) => visit?.treatmentData);
  const previousDietVisit = (activeVisitIndex >= 0 ? journeyVisits.slice(0, activeVisitIndex) : journeyVisits)
    .slice()
    .reverse()
    .find((visit) => visit?.dietPlanData);
  const pastTreatmentOptions = (activeVisitIndex >= 0 ? journeyVisits.slice(0, activeVisitIndex) : journeyVisits)
    .slice()
    .reverse()
    .filter((visit) => visit?.treatmentData)
    .reduce((options, visit) => {
      const service = String(visit.treatmentData.service ?? '').trim() || 'Previous treatment';
      if (options.some((option) => option.service.toLowerCase() === service.toLowerCase())) return options;
      return [...options, { service, visitDate: visit.visitDate, data: visit.treatmentData }];
    }, []);
  const pregnancyHistoryEntries = useMemo(() => journeyVisits.flatMap((visit) => (
    Array.isArray(visit.pregnancyHistory) ? visit.pregnancyHistory.map((entry) => ({
      ...entry,
      visitId: visit.id,
      visitDate: visit.visitDate,
    })) : []
  )).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))), [journeyVisits]);
  const selectedClinicalPrintVisits = useMemo(() => journeyVisits
    .filter((visit) => clinicalPrintVisitIds.includes(visit.id))
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))), [journeyVisits, clinicalPrintVisitIds]);
  const consultationSuggestions = useMemo(() => {
    const collectLines = (value) => String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    const allVisits = Object.values(journeys).flatMap((record) => normalizeJourneyRecord(record).visits);
    const optionsFor = (field) => {
      const values = [
        ...allVisits.map((visit) => visit.consultationData?.[field]),
        ...consultationTemplates.map((template) => template?.[field]),
      ].flatMap(collectLines);
      return [...new Map(values.map((item) => [item.toLocaleLowerCase(), item])).values()];
    };
    return { complaint: optionsFor('complaint'), notes: optionsFor('notes') };
  }, [journeys, consultationTemplates]);
  useEffect(() => {
    const record = normalizeJourneyRecord(journeys[selectedClient]);
    setSelectedVisitId(record.activeVisitId || record.visits.at(-1)?.id || '');
  }, [selectedClient]);
  const selectedClientPhone = normalizePhoneNumber(clientMobile(selectedClientRecord));
  const selectedWeightUpdates = patientFormUpdates
    .filter((update) => update?.type === 'weight' && (
      (selectedClientPhone && normalizePhoneNumber(update.mobile) === selectedClientPhone)
      || (clientId(selectedClientRecord) && String(update.patientId) === String(clientId(selectedClientRecord)))
    ))
    .sort((a, b) => String(b.recordedAt ?? '').localeCompare(String(a.recordedAt ?? '')));
  const requiredFormRecord = localForms.find((form) => formTitle(form).toLowerCase() === requiredForm.toLowerCase());
  const matchedFormResponses = localResponses
    .map((response) => {
      const form = formByKey.get(response.formId) ?? formByKey.get(response.formSlug);
      const phoneMatches = selectedClientPhone && responsePhone(response, form) === selectedClientPhone;
      const nameMatches = selectedClient && responseName(response, form) === normalizePersonName(selectedClient);
      return { response, form, phoneMatches, nameMatches };
    })
    .filter((item) => item.phoneMatches || item.nameMatches)
    .sort((a, b) => String(b.response.submittedAt ?? '').localeCompare(String(a.response.submittedAt ?? '')));
  const hasRequiredFormResponse = localResponses.some((response) => {
    const sameForm = requiredFormRecord
      ? response.formId === requiredFormRecord.id || response.formSlug === requiredFormRecord.slug
      : String(response.formTitle ?? '').toLowerCase() === requiredForm.toLowerCase();
    if (!sameForm) return false;
    const phoneMatches = selectedClientPhone && responsePhone(response, requiredFormRecord) === selectedClientPhone;
    const nameMatches = selectedClient && responseName(response, requiredFormRecord) === normalizePersonName(selectedClient);
    return phoneMatches || nameMatches;
  });
  const hasCurrentVisitFormResponse = matchedFormResponses.some(({ response }) => {
    if (!journey.visitDate) return true;
    return String(response.submittedAt ?? '').slice(0, 10) >= journey.visitDate;
  });

  const stageDone = (id) => {
    if (id === 'registration') return Boolean(selectedClient);
    if (id === 'appointment') return Boolean(journey.appointment);
    if (id === 'billing') return Boolean(journey.billing);
    if (id === 'treatment') return Boolean(journey.treatment);
    if (id === 'diet') return Boolean(journey.diet);
    if (id === 'forms') return Boolean(journey.forms);
    return Boolean(journey[id]);
  };
  const stageDetail = (id, complete) => {
    if (id === 'followup' && journey.followupData?.date) {
      return `${formatResponseDate(journey.followupData.date)} · ${journey.followupData.time || 'Time pending'}`;
    }
    if (id === 'diet' && journey.dietPlanData) {
      return [journey.dietPlanData.goal, journey.dietPlanData.duration].filter(Boolean).join(' · ') || 'Diet plan saved';
    }
    return complete ? 'Completed' : 'Pending';
  };

  const getStageInfo = (id) => {
    const complete = stageDone(id);
    const isCurrent = nextAction() === id;

    if (id === 'registration') {
      const idStr = clientId(selectedClientRecord);
      const phoneStr = clientMobile(selectedClientRecord);
      const programStr = selectedClientRecord?.program || selectedClientRecord?.['Program'] || '';
      return {
        title: 'Patient Registration',
        complete: true,
        status: 'Completed',
        statusTone: 'complete',
        summary: selectedClientRecord
          ? `${patientIdentity(selectedClient, selectedClientRecord)} · Registered profile on file`
          : 'Patient registered in system',
        tags: [idStr ? `#${idStr.replace(/^#/, '')}` : '', phoneStr, programStr].filter(Boolean),
        buttonText: 'View Profile',
        onClick: () => navigate('/clients'),
      };
    }

    if (id === 'appointment') {
      const data = journey.appointmentData;
      let summary = 'Schedule appointment date, time, service type & check-in.';
      if (complete && data?.date) {
        summary = `${formatResponseDate(data.date)}${data.time ? ` at ${data.time}` : ''} · ${data.type || 'Visit'} (${data.status || 'Confirmed'})`;
      }
      return {
        title: 'Appointment & Check-in',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'pending'),
        summary,
        tags: complete && data ? [data.type || 'Consultation', data.status || 'Confirmed'].filter(Boolean) : [],
        buttonText: complete ? 'Edit Appointment' : 'Book Appointment',
        onClick: () => runStage('appointment'),
      };
    }

    if (id === 'consultation') {
      const data = journey.consultationData;
      const sections = consultationSectionsFromData(data);
      const parts = [];
      if (sections.length > 1) {
        sections.forEach((sec) => {
          const secParts = [];
          if (sec.diagnosis) secParts.push(`Diagnosis: ${sec.diagnosis}`);
          if (sec.complaint) secParts.push(`Complaints: ${sec.complaint}`);
          parts.push(`[${sec.service || 'Service'}]: ${secParts.join(', ') || 'Recorded'}`);
        });
      } else if (data) {
        if (data.diagnosis) parts.push(`Diagnosis: ${data.diagnosis}`);
        if (data.vitals) parts.push(`Vitals: ${data.vitals}`);
        if (data.complaint) parts.push(`Complaints: ${data.complaint}`);
      }
      const summary = complete && parts.length
        ? parts.join(' · ')
        : (complete ? 'Doctor consultation notes recorded.' : 'Record presenting complaints, vitals, diagnosis & clinical examination.');
      const tags = complete ? [...new Set(sections.map((s) => s.service).filter(Boolean))] : [];
      return {
        title: 'Doctor Consultation',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'pending'),
        summary,
        tags,
        buttonText: complete ? 'Edit Consultation' : 'Start Consultation',
        onClick: () => runStage('consultation'),
      };
    }

    if (id === 'treatment') {
      const data = journey.treatmentData;
      const sections = treatmentSectionsFromData(data);
      let summary = 'Prescribe Ayurveda therapies, medications, dosage & duration.';
      if (complete && data) {
        if (sections.length > 1) {
          summary = sections.map((s) => {
            const medCount = (s.medicines || []).filter((m) => m.medicine).length;
            return `${s.service} (${s.duration || '30 days'}${medCount ? `, ${medCount} meds` : ''})`;
          }).join(' · ');
        } else {
          const medicines = clinicalMedicines(data);
          const parts = [data.service || 'Treatment', data.duration ? `Duration: ${data.duration}` : '', data.goal ? `Goal: ${data.goal}` : ''].filter(Boolean);
          if (medicines.length) parts.push(`${medicines.length} medicine(s)`);
          summary = parts.join(' · ');
        }
      }
      const tags = complete ? [...new Set(sections.map((s) => s.service).filter(Boolean))] : (data?.service ? [data.service] : []);
      return {
        title: 'Treatment Plan & Medicines',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'pending'),
        summary,
        tags,
        buttonText: complete ? 'Edit Treatment' : 'Add Treatment',
        onClick: () => runStage('treatment'),
      };
    }

    if (id === 'diet') {
      const data = journey.dietPlanData;
      const summary = complete && data
        ? [data.goal ? `Goal: ${data.goal}` : '', data.duration ? `Duration: ${data.duration}` : '', data.calories ? `${data.calories}` : '', `${data.meals?.length || 0} meals`].filter(Boolean).join(' · ')
        : 'Custom meal schedule, calorie targets & nutrition guidelines (Optional).';
      return {
        title: 'Diet & Nutrition Plan',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Optional'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'optional'),
        summary,
        tags: complete && data ? [data.goal, data.calories].filter(Boolean) : ['Optional'],
        buttonText: complete ? 'Edit Diet Plan' : '+ Add Diet Plan',
        onClick: () => runStage('diet'),
      };
    }

    if (id === 'billing') {
      const data = journey.paymentData;
      let summary = 'Generate invoice, collect payment & manage pending dues.';
      if (complete && data) {
        const parts = [`₹ ${data.amount || 0} (${data.status || 'Paid'})`];
        if (data.invoice) parts.push(`Inv: ${data.invoice}`);
        if (data.pendingAmount && Number(data.pendingAmount) > 0) parts.push(`Pending: ₹${data.pendingAmount}`);
        summary = parts.join(' · ');
      }
      return {
        title: 'Invoice & Payment',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'pending'),
        summary,
        tags: complete && data ? [`₹ ${data.amount || 0}`, data.status || 'Paid'].filter(Boolean) : [],
        buttonText: complete ? 'Edit Payment' : 'Collect Payment',
        onClick: () => runStage('billing'),
      };
    }

    if (id === 'followup') {
      const data = journey.followupData;
      const summary = complete && data?.date
        ? `Follow-up on ${formatResponseDate(data.date)}${data.time ? ` at ${data.time}` : ''}${data.notes ? ` · Note: ${data.notes}` : ''}`
        : 'Schedule review visit (7, 15, or 30 days) and automated patient reminder.';
      return {
        title: 'Next Follow-up',
        complete,
        status: complete ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending'),
        statusTone: complete ? 'complete' : (isCurrent ? 'current' : 'pending'),
        summary,
        tags: complete && data?.date ? [formatResponseDate(data.date), data.time || ''].filter(Boolean) : [],
        buttonText: complete ? 'Update Follow-up' : 'Schedule Follow-up',
        onClick: () => runStage('followup'),
      };
    }

    if (id === 'forms') {
      const summary = complete
        ? (hasRequiredFormResponse ? `${requiredForm} submitted and matched with patient phone.` : `${journey.requiredForm || requiredForm} verified.`)
        : (matchedFormResponses.length ? `${matchedFormResponses.length} submitted response(s) ready to verify.` : `Waiting for patient to submit ${requiredForm}.`);
      return {
        title: 'Required Forms',
        complete,
        status: complete ? 'Completed' : (matchedFormResponses.length ? 'Ready to Verify' : 'Waiting'),
        statusTone: complete ? 'complete' : (matchedFormResponses.length ? 'current' : 'pending'),
        summary,
        tags: complete ? [requiredForm, 'Verified'] : [requiredForm],
        buttonText: complete ? 'View Form' : (matchedFormResponses.length ? 'Verify Submission' : 'Check Forms'),
        onClick: () => runStage('forms'),
      };
    }

    return {
      title: id,
      complete,
      status: complete ? 'Completed' : 'Pending',
      statusTone: complete ? 'complete' : 'pending',
      summary: stageDetail(id, complete),
      tags: [],
      buttonText: 'Open',
      onClick: () => runStage(id),
    };
  };

  const updateJourney = (changes) => {
    if (!selectedClient) return;
    const targetId = selectedVisitId || patientJourneyRecord.activeVisitId || `visit-${Date.now()}`;
    if (!selectedVisitId) setSelectedVisitId(targetId);
    setJourneys((current) => {
      const record = normalizeJourneyRecord(current[selectedClient]);
      const now = new Date().toISOString();
      let visits = record.visits;
      if (!visits.some((visit) => visit.id === targetId)) {
        visits = [...visits, { id: targetId, visitDate: currentSlot().date, createdAt: now }];
      }
      return {
        ...current,
        [selectedClient]: {
          visits: visits.map((visit) => visit.id === targetId ? { ...visit, ...changes, updatedAt: now } : visit),
          activeVisitId: targetId,
        },
      };
    });
  };

  useEffect(() => {
    if (!selectedClient || !activeVisitId || journey.forms || !hasCurrentVisitFormResponse) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString(), formAutoMatched: true });
  }, [selectedClient, activeVisitId, journey.forms, hasCurrentVisitFormResponse, requiredForm]);

  const openConsultation = () => {
    const savedConsultation = journey.consultationData ?? previousConsultationVisit?.consultationData;
    const initialSections = consultationSectionsFromData(savedConsultation);
    if (!savedConsultation && journey.appointmentData?.type) {
      initialSections[0].service = journey.appointmentData.type;
    }
    setConsultationSections(initialSections);
    setConsultation(initialSections[0] || { complaint: '', diagnosis: '', investigation: '', notes: '', doctorNotes: '', vitals: '' });
    setConsultationOpen(true);
  };

  const addConsultationSection = () => {
    const newIndex = consultationSections.length + 1;
    const existingServices = consultationSections.map((s) => s.service);
    const nextService = SERVICE_OPTIONS.find((s) => !existingServices.includes(s)) || 'Consultation';
    const newSection = {
      id: `consultation-sec-${Date.now()}-${newIndex}`,
      service: nextService,
      complaint: '',
      diagnosis: '',
      investigation: '',
      notes: '',
      doctorNotes: '',
      vitals: consultationSections[0]?.vitals || '',
    };
    setConsultationSections((prev) => [...prev, newSection]);
  };

  const updateConsultationSection = (index, field, value) => {
    setConsultationSections((prev) => prev.map((sec, i) => (i === index ? { ...sec, [field]: value } : sec)));
    if (index === 0) {
      setConsultation((prev) => ({ ...prev, [field]: value }));
    }
  };

  const removeConsultationSection = (index) => {
    if (consultationSections.length <= 1) return;
    setConsultationSections((prev) => prev.filter((_, i) => i !== index));
  };

  const openPregnancyHistory = () => {
    setPregnancyHistoryForm({
      date: journey.visitDate || currentSlot().date,
      pregnancyStage: '',
      gynecName: '',
      gynecAdvice: '',
      tests: '',
      medicines: '',
      garbhsanskarAdvice: '',
      nextFollowup: '',
    });
    setPregnancyHistoryOpen(true);
  };

  const savePregnancyHistory = () => {
    if (!pregnancyHistoryForm.gynecAdvice.trim() && !pregnancyHistoryForm.garbhsanskarAdvice.trim()) return;
    const entry = {
      ...pregnancyHistoryForm,
      id: `pregnancy-note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateJourney({ pregnancyHistory: [entry, ...(journey.pregnancyHistory ?? [])] });
    setPregnancyHistoryOpen(false);
  };

  const saveConsultation = () => {
    const cleanedSections = consultationSections.map((sec) => ({
      ...sec,
      service: sec.service || 'Consultation',
      complaint: sec.complaint?.trim() || '',
      notes: sec.notes?.trim() || '',
      vitals: sec.vitals?.trim() || '',
      diagnosis: sec.diagnosis?.trim() || '',
      investigation: sec.investigation?.trim() || '',
      doctorNotes: sec.doctorNotes?.trim() || '',
    }));
    const hasAnyContent = cleanedSections.some((sec) => (
      sec.complaint || sec.notes || sec.doctorNotes || sec.diagnosis || sec.investigation || sec.vitals
    ));
    if (!hasAnyContent) return;

    const primary = cleanedSections[0] || {};
    const consultationData = {
      ...primary,
      sections: cleanedSections,
    };
    updateJourney({ consultation: true, consultationData, consultedAt: new Date().toISOString() });
    setConsultationOpen(false);
  };

  const addDoctorNoteToSection = (sectionIndex, selectedNote) => {
    const note = String(selectedNote ?? sectionDoctorNoteChoices[sectionIndex] ?? doctorNoteChoice ?? '').trim().replace(/\s+/g, ' ');
    if (!note) return;
    const targetSection = consultationSections[sectionIndex];
    if (!targetSection) return;
    const current = String(targetSection.doctorNotes ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === note.toLowerCase())) current.push(note);
    if (![...NOTE_OPTIONS, ...customDoctorNotes].some((item) => item.toLowerCase() === note.toLowerCase())) {
      setCustomDoctorNotes((items) => [...items, note]);
    }
    updateConsultationSection(sectionIndex, 'doctorNotes', current.join('\n'));
    setSectionDoctorNoteChoices((prev) => ({ ...prev, [sectionIndex]: '' }));
    setDoctorNoteChoice('');
  };

  const removeDoctorNoteFromSection = (sectionIndex, note) => {
    const targetSection = consultationSections[sectionIndex];
    if (!targetSection) return;
    const updated = String(targetSection.doctorNotes ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item && item !== note)
      .join('\n');
    updateConsultationSection(sectionIndex, 'doctorNotes', updated);
  };

  const addDoctorNote = (selectedNote = doctorNoteChoice) => {
    addDoctorNoteToSection(0, selectedNote);
  };

  const removeDoctorNote = (note) => {
    removeDoctorNoteFromSection(0, note);
  };

  const applyConsultationTemplateToSection = (sectionIndex, indexValue) => {
    if (indexValue === '') return;
    const template = consultationTemplates[Number(indexValue)];
    if (!template) return;
    updateConsultationSection(sectionIndex, 'complaint', template.complaint ?? '');
    updateConsultationSection(sectionIndex, 'diagnosis', template.diagnosis ?? '');
    updateConsultationSection(sectionIndex, 'investigation', template.investigation ?? '');
    updateConsultationSection(sectionIndex, 'notes', template.notes ?? '');
    updateConsultationSection(sectionIndex, 'doctorNotes', template.doctorNotes ?? '');
    if (template.vitals) updateConsultationSection(sectionIndex, 'vitals', template.vitals);
  };

  const applyConsultationTemplate = (indexValue) => {
    setSelectedConsultationTemplate(indexValue);
    applyConsultationTemplateToSection(0, indexValue);
  };

  const saveConsultationTemplate = () => {
    const name = consultationTemplateName.trim();
    if (!name) return;
    const primary = consultationSections[0] || consultation;
    const template = { name, ...primary, updatedAt: new Date().toISOString() };
    setConsultationTemplates((current) => {
      const existing = current.findIndex((item) => item.name?.toLowerCase() === name.toLowerCase());
      return existing === -1 ? [...current, template] : current.map((item, index) => (index === existing ? template : item));
    });
    setSelectedConsultationTemplate('');
  };

  const applyQuickConsultationToSection = (sectionIndex, preset) => {
    setConsultationSections((prev) => prev.map((sec, i) => (i === sectionIndex ? {
      ...sec,
      service: preset.label || sec.service,
      complaint: preset.complaint,
      diagnosis: preset.diagnosis,
      investigation: '',
      notes: preset.notes,
      doctorNotes: '',
      vitals: preset.vitals || sec.vitals,
    } : sec)));
    if (sectionIndex === 0) {
      applyQuickConsultation(preset);
    }
  };

  const applyQuickConsultation = (preset) => {
    setConsultation({
      complaint: preset.complaint,
      diagnosis: preset.diagnosis,
      investigation: '',
      notes: preset.notes,
      doctorNotes: '',
      vitals: preset.vitals,
    });
    setConsultationTemplateName(preset.label);
  };

  const setAppointmentPreset = (preset) => {
    const slot = currentSlot();
    if (preset === 'now') setAppointmentForm((value) => ({ ...value, ...slot, status: 'Checked-in', type: 'Consultation' }));
    if (preset === 'today') setAppointmentForm((value) => ({ ...value, date: slot.date, status: 'Confirmed' }));
    if (preset === 'tomorrow') setAppointmentForm((value) => ({ ...value, date: addDays(1), status: 'Confirmed' }));
    if (preset === 'week') setAppointmentForm((value) => ({ ...value, date: addDays(7), type: 'Follow-up', status: 'Confirmed' }));
    if (preset === 'month') setAppointmentForm((value) => ({ ...value, date: addDays(30), type: 'Follow-up', status: 'Confirmed' }));
  };

  const addTreatmentSection = () => {
    const newIndex = treatmentSections.length + 1;
    const existingServices = treatmentSections.map((s) => s.service);
    const nextService = SERVICE_OPTIONS.find((s) => !existingServices.includes(s)) || 'Therapy Session';
    const newSection = {
      id: `treatment-sec-${Date.now()}-${newIndex}`,
      service: nextService,
      goal: '',
      duration: '30 days',
      status: 'Active',
      medicines: [{ medicine: '', dose: '', timing: '' }],
    };
    setTreatmentSections((prev) => [...prev, newSection]);
  };

  const updateTreatmentSectionField = (sectionIndex, field, value) => {
    setTreatmentSections((prev) => prev.map((sec, i) => (i === sectionIndex ? { ...sec, [field]: value } : sec)));
    if (sectionIndex === 0) {
      setTreatmentForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const removeTreatmentSection = (sectionIndex) => {
    if (treatmentSections.length <= 1) return;
    setTreatmentSections((prev) => prev.filter((_, i) => i !== sectionIndex));
  };

  const addSectionMedicineRow = (sectionIndex) => {
    setTreatmentSections((prev) => prev.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      return { ...sec, medicines: [...(sec.medicines || []), { medicine: '', dose: '', timing: '' }] };
    }));
  };

  const updateSectionMedicine = (sectionIndex, medicineIndex, field, value) => {
    setTreatmentSections((prev) => prev.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      const nextMedicines = (sec.medicines || []).map((row, rIdx) => (rIdx === medicineIndex ? { ...row, [field]: value } : row));
      return { ...sec, medicines: nextMedicines };
    }));
  };

  const selectSectionMedicine = (sectionIndex, medicineIndex, medicineName) => {
    const entry = typeof medicineName === 'object' ? medicineName : medicineCatalog.find((item) => item.Medicine.toLowerCase() === medicineName.toLowerCase());
    setTreatmentSections((prev) => prev.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      const nextMedicines = (sec.medicines || []).map((row, rIdx) => (rIdx === medicineIndex ? {
        medicine: entry?.Medicine ?? medicineName,
        dose: entry?.['Default Dose'] ?? row.dose,
        timing: entry?.Timing ?? row.timing,
      } : row));
      return { ...sec, medicines: nextMedicines };
    }));
  };

  const addSectionMedicineToCatalog = (sectionIndex, medicineIndex) => {
    const row = treatmentSections[sectionIndex]?.medicines?.[medicineIndex];
    const name = row?.medicine?.trim();
    if (!name || medicineCatalog.some((item) => item.Medicine.toLowerCase() === name.toLowerCase())) return;
    const operations = loadValue(operationsKey, {});
    const medicines = Array.isArray(operations.medicines) ? operations.medicines : [];
    window.localStorage.setItem(operationsKey, JSON.stringify({
      ...operations,
      medicines: [[name, 'General', row.dose || '', row.timing || ''], ...medicines],
    }));
    setMedicineCatalogRevision((current) => current + 1);
  };

  const removeSectionMedicineRow = (sectionIndex, medicineIndex) => {
    setTreatmentSections((prev) => prev.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      const next = (sec.medicines || []).filter((_, rIdx) => rIdx !== medicineIndex);
      return { ...sec, medicines: next.length ? next : [{ medicine: '', dose: '', timing: '' }] };
    }));
  };

  const applyQuickTreatment = (preset) => {
    setTreatmentForm((value) => ({ ...value, ...preset }));
    updateTreatmentSectionField(0, 'service', preset.service || treatmentForm.service);
    updateTreatmentSectionField(0, 'goal', preset.goal || treatmentForm.goal);
    updateTreatmentSectionField(0, 'duration', preset.duration || treatmentForm.duration);
  };

  const treatmentRowsFromData = (data) => {
    if (Array.isArray(data?.medicines)) return data.medicines.filter((row) => row?.medicine);
    return String(data?.medicine ?? '').split(',').map((medicine, index) => ({
      medicine: medicine.trim(),
      dose: String(data?.dose ?? '').split(',')[index]?.trim() ?? '',
      timing: String(data?.timing ?? '').split(',')[index]?.trim() ?? '',
    })).filter((row) => row.medicine);
  };

  const applyTreatmentData = (data) => {
    if (!data) return;
    const sections = treatmentSectionsFromData(data);
    setTreatmentSections(sections);
    setTreatmentForm(sections[0] || {
      service: data.service ?? 'Consultation',
      goal: data.goal ?? '',
      duration: data.duration ?? '30 days',
      medicine: data.medicine ?? '',
      dose: data.dose ?? '',
      timing: data.timing ?? '',
      status: data.status ?? 'Active',
    });
    setTreatmentMedicineRows(sections[0]?.medicines || [{ medicine: '', dose: '', timing: '' }]);
  };

  const applyPreviousTreatment = () => {
    const selectedOption = pastTreatmentOptions.find((option) => option.service === selectedPastTreatmentService)
      ?? pastTreatmentOptions[0];
    if (!selectedOption?.data) return;
    setSelectedPastTreatmentService(selectedOption.service);
    applyTreatmentData(selectedOption.data);
    setPastTreatmentApplied(true);
  };

  const applyTreatmentTemplate = (indexValue) => {
    setSelectedTreatmentTemplate(indexValue);
    if (indexValue === '') return;
    const template = treatmentTemplates[Number(indexValue)];
    if (!template) return;
    setTreatmentTemplateName(template.name ?? '');
    applyTreatmentData(template);
  };

  const saveTreatmentTemplate = () => {
    const name = treatmentTemplateName.trim();
    if (!name) return;
    const primary = treatmentSections[0] || {};
    const medicines = (primary.medicines || []).filter((row) => row.medicine.trim());
    const template = {
      name,
      service: primary.service || treatmentForm.service,
      goal: primary.goal || treatmentForm.goal,
      duration: primary.duration || treatmentForm.duration,
      medicine: medicines.map((row) => row.medicine).join(', '),
      dose: medicines.map((row) => row.dose).join(', '),
      timing: medicines.map((row) => row.timing).join(', '),
      medicines,
      updatedAt: new Date().toISOString(),
    };
    setTreatmentTemplates((current) => {
      const existingIndex = current.findIndex((item) => String(item.name ?? '').toLowerCase() === name.toLowerCase());
      if (existingIndex < 0) return [template, ...current];
      return current.map((item, index) => index === existingIndex ? template : item);
    });
    setSelectedTreatmentTemplate('');
  };

  const deleteTreatmentTemplate = () => {
    if (selectedTreatmentTemplate === '') return;
    const index = Number(selectedTreatmentTemplate);
    const template = treatmentTemplates[index];
    if (!template || !window.confirm(`Delete "${template.name}" treatment template?`)) return;
    setTreatmentTemplates((current) => current.filter((_, templateIndex) => templateIndex !== index));
    setSelectedTreatmentTemplate('');
    setTreatmentTemplateName('');
  };

  const syncTreatmentMedicineRows = (rows) => {
    const nextRows = rows.length ? rows : [{ medicine: '', dose: '', timing: '' }];
    setTreatmentMedicineRows(nextRows);
    setTreatmentSections((prev) => prev.map((sec, i) => (i === 0 ? { ...sec, medicines: nextRows } : sec)));
    setTreatmentForm((value) => ({
      ...value,
      medicine: nextRows.map((row) => row.medicine).filter(Boolean).join(', '),
      dose: nextRows.map((row) => row.dose).filter(Boolean).join(', '),
      timing: nextRows.map((row) => row.timing).filter(Boolean).join(', '),
    }));
  };

  const selectTreatmentMedicine = (index, medicineName) => {
    selectSectionMedicine(0, index, medicineName);
  };

  const addTreatmentMedicineToCatalog = (index) => {
    addSectionMedicineToCatalog(0, index);
  };

  const updateTreatmentMedicine = (index, field, value) => {
    updateSectionMedicine(0, index, field, value);
  };

  const removeTreatmentMedicine = (index) => {
    removeSectionMedicineRow(0, index);
  };

  const nextAction = () => STAGES.find(([id]) => id !== 'diet' && !stageDone(id))?.[0] ?? 'completed';
  const openStageModal = (stage) => {
    if (stage === 'consultation') {
      openConsultation();
      return;
    }
    if (stage === 'appointment') {
      setAppointmentForm(journey.appointmentData ?? { mobile: clientMobile(selectedClientRecord), ...currentSlot(), type: 'Consultation', status: 'Pending' });
    }
    if (stage === 'treatment') {
      const savedTreatment = journey.treatmentData;
      if (savedTreatment) {
        const sections = treatmentSectionsFromData(savedTreatment);
        setTreatmentSections(sections);
        setTreatmentForm(sections[0] || { service: 'Consultation', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
        setTreatmentMedicineRows(sections[0]?.medicines || [{ medicine: '', dose: '', timing: '' }]);
      } else {
        const cSections = consultationSectionsFromData(journey.consultationData);
        if (cSections.length > 0 && (cSections.length > 1 || cSections[0]?.service !== 'Consultation' || cSections[0]?.complaint || cSections[0]?.diagnosis)) {
          const generatedSections = cSections.map((cSec, idx) => ({
            id: `treatment-sec-${Date.now()}-${idx + 1}`,
            service: cSec.service || 'Consultation',
            goal: cSec.diagnosis ? `Manage ${cSec.diagnosis}` : '',
            duration: '30 days',
            status: 'Active',
            medicines: [{ medicine: '', dose: '', timing: '' }],
          }));
          setTreatmentSections(generatedSections);
          setTreatmentForm(generatedSections[0]);
          setTreatmentMedicineRows(generatedSections[0].medicines);
        } else {
          const defaultSections = [{
            id: 'treatment-sec-1',
            service: journey.appointmentData?.type || 'Consultation',
            goal: '',
            duration: '30 days',
            status: 'Active',
            medicines: [{ medicine: '', dose: '', timing: '' }],
          }];
          setTreatmentSections(defaultSections);
          setTreatmentForm(defaultSections[0]);
          setTreatmentMedicineRows(defaultSections[0].medicines);
        }
      }
      setTreatmentSaveError('');
      setSelectedPastTreatmentService(pastTreatmentOptions[0]?.service ?? '');
      setPastTreatmentApplied(false);
    }
    if (stage === 'diet') {
      const savedDietPlan = journey.dietPlanData || previousDietVisit?.dietPlanData;
      setDietPlanForm(savedDietPlan ? {
        ...newDietPlan(selectedClient),
        ...savedDietPlan,
        client: selectedClient,
        meals: Array.isArray(savedDietPlan.meals) && savedDietPlan.meals.length ? savedDietPlan.meals : DEFAULT_DIET_MEALS.map((meal) => ({ ...meal })),
      } : newDietPlan(selectedClient));
    }
    if (stage === 'followup') {
      setFollowupForm(journey.followupData ?? { date: addDays(7), time: currentSlot().time, notes: '', status: 'Confirmed' });
    }
    if (stage === 'payment' || stage === 'billing') setPaymentForm(journey.paymentData ?? { invoice: nextInvoice(payments), amount: '', paidAmount: '', pendingAmount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
    setStageModal(stage);
  };

  const openReturningVisit = () => {
    if (!selectedClient || !selectedClientRecord) return;
    const previousAppointments = normalizeAppointments(appointments)
      .filter((row) => String(row[0] ?? '').toLowerCase() === selectedClient.toLowerCase())
      .sort((a, b) => `${b[2] ?? ''} ${b[3] ?? ''}`.localeCompare(`${a[2] ?? ''} ${a[3] ?? ''}`));
    setAppointmentForm({
      mobile: clientMobile(selectedClientRecord),
      ...currentSlot(),
      type: previousAppointments[0]?.[4] || 'Consultation',
      status: 'Checked-in',
    });
    setStageModal('returning-visit');
  };

  const toggleClinicalPrintSection = (sectionId) => {
    setClinicalPrintSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  const openClinicalPrint = () => {
    setClinicalPrintVisitIds(activeVisitId ? [activeVisitId] : journeyVisits.map((visit) => visit.id));
    setClinicalPrintOpen(true);
  };

  const pastJourneyVisits = journeyVisits
    .filter((visit) => visit.id !== activeVisitId && String(visit.visitDate || '') < String(journey.visitDate || ''))
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));

  const openPastJourneyPrint = () => {
    if (!pastJourneyVisits.length) return;
    setClinicalPrintVisitIds(pastJourneyVisits.map((visit) => visit.id));
    setClinicalPrintTitle(selectedClient);
    setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])));
    setClinicalPrintOpen(true);
  };

  const toggleClinicalPrintVisit = (visitId) => {
    setClinicalPrintVisitIds((current) => current.includes(visitId)
      ? current.filter((id) => id !== visitId)
      : [...current, visitId]);
  };

  const applyClinicalPrintTemplate = (templateIndex) => {
    setSelectedClinicalPrintTemplate(templateIndex);
    if (templateIndex === '') return;
    const template = clinicalPrintTemplates[Number(templateIndex)];
    if (!template) return;
    setClinicalPrintTemplateName(template.name ?? '');
    setClinicalPrintTitle(template.title || 'Consultation & Treatment Summary');
    setClinicalPrintNote(template.note ?? '');
    setClinicalPrintSections(Object.fromEntries(
      PRINT_SECTION_OPTIONS.map(([id]) => [id, Boolean(id === 'history' ? template.sections?.history ?? template.sections?.doctorNotes : template.sections?.[id])]),
    ));
  };

  const saveClinicalPrintTemplate = () => {
    const name = clinicalPrintTemplateName.trim();
    if (!name) return;
    const template = {
      name,
      title: clinicalPrintTitle.trim() || 'Consultation & Treatment Summary',
      note: clinicalPrintNote,
      sections: { ...clinicalPrintSections },
      updatedAt: new Date().toISOString(),
    };
    setClinicalPrintTemplates((current) => {
      const existingIndex = current.findIndex((item) => String(item.name ?? '').toLowerCase() === name.toLowerCase());
      if (existingIndex < 0) return [template, ...current];
      return current.map((item, index) => index === existingIndex ? template : item);
    });
    setSelectedClinicalPrintTemplate('');
  };

  const deleteClinicalPrintTemplate = () => {
    if (selectedClinicalPrintTemplate === '') return;
    const index = Number(selectedClinicalPrintTemplate);
    const template = clinicalPrintTemplates[index];
    if (!template || !window.confirm(`Delete "${template.name}" print template?`)) return;
    setClinicalPrintTemplates((current) => current.filter((_, templateIndex) => templateIndex !== index));
    setSelectedClinicalPrintTemplate('');
    setClinicalPrintTemplateName('');
  };

  const printClinicalSummary = () => {
    if (!selectedClient) return;
    const section = (title, content) => content ? `<section><h2>${escapePrintHtml(title)}</h2>${content}</section>` : '';
    const detail = (label, value) => value ? `<div class="detail"><span>${escapePrintHtml(label)}</span><strong>${escapePrintHtml(value)}</strong></div>` : '';
    const listSection = (value) => {
      const items = clinicalListItems(value);
      return items.length ? `<ul class="print-list">${items.map((item) => `<li>${escapePrintHtml(item)}</li>`).join('')}</ul>` : '<p>Not recorded</p>';
    };
    const selectedVisits = [...journeyVisits]
      .filter((visit) => clinicalPrintVisitIds.includes(visit.id))
      .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    const patientIdentityText = patientIdentity(selectedClient, selectedClientRecord);
    const patientSection = [
      clinicalPrintSections.patient && `<section class="patient-line"><strong>${escapePrintHtml(patientIdentityText)}</strong><strong>${escapePrintHtml(clientMobile(selectedClientRecord))}</strong><strong>${escapePrintHtml(new Date().toLocaleDateString('en-GB').replaceAll('/', '-'))}</strong></section>`,
    ].filter(Boolean).join('');
    const visitSections = selectedVisits.map((visit) => {
      const consultationData = visit.consultationData ?? {};
      const cSections = consultationSectionsFromData(consultationData);
      const treatmentData = visit.treatmentData ?? {};
      const tSections = treatmentSectionsFromData(treatmentData);
      const followupData = visit.followupData ?? {};
      const paymentData = visit.paymentData ?? {};
      const pregnancyHistory = Array.isArray(visit.pregnancyHistory) ? visit.pregnancyHistory : [];
      const visitTitle = `${formatResponseDate(visit.visitDate) || 'Undated visit'} · ${visit.appointmentData?.time || 'Time not recorded'} · ${visit.appointmentData?.type || 'Patient visit'}`;

      const symptomsHtml = cSections.map((s) => `<p>${cSections.length > 1 ? `<b>[${escapePrintHtml(s.service || 'Consultation')}]:</b> ` : ''}${escapePrintHtml(s.complaint || 'Not recorded')}</p>`).join('');
      const vitalsHtml = `<p>${escapePrintHtml(consultationData.vitals || cSections[0]?.vitals || 'Not recorded')}</p>`;
      const diagnosisHtml = cSections.map((s) => `<p>${cSections.length > 1 ? `<b>[${escapePrintHtml(s.service || 'Consultation')}]:</b> ` : ''}${escapePrintHtml(s.diagnosis || 'Not recorded')}</p>`).join('');
      const investigationHtml = cSections.map((s) => s.investigation ? `<p>${cSections.length > 1 ? `<b>[${escapePrintHtml(s.service)}]:</b> ` : ''}${listSection(s.investigation)}</p>` : '').filter(Boolean).join('') || '<p>Not recorded</p>';
      const historyHtml = cSections.map((s) => `<p>${cSections.length > 1 ? `<b>[${escapePrintHtml(s.service || 'Consultation')}]:</b> ` : ''}${escapePrintHtml(s.notes || 'Not recorded')}</p>`).join('');
      const doctorNotesHtml = cSections.map((s) => `<p>${cSections.length > 1 ? `<b>[${escapePrintHtml(s.service || 'Consultation')}]:</b> ` : ''}${escapePrintHtml(s.doctorNotes || 'Not recorded')}</p>`).join('');

      const treatmentHtml = tSections.map((s) => (
        `<div class="details" style="margin-bottom:8px">` +
        detail('Service', s.service) +
        detail('Goal', s.goal) +
        detail('Duration', s.duration) +
        detail('Status', s.status) +
        `</div>`
      )).join('');

      const medicinesHtml = tSections.map((s) => {
        const meds = clinicalMedicines(s);
        if (!meds.length) return '';
        return `<div style="margin-bottom:10px"><strong>${escapePrintHtml(s.service)} Medicines:</strong><table><thead><tr><th style="width:36px">No.</th><th>Medicine / Product</th><th>Dose</th><th>Timing</th></tr></thead><tbody>${meds.map((item, index) => `<tr><td>${index + 1}</td><td>${escapePrintHtml(item.medicine)}</td><td>${escapePrintHtml(item.dose || '—')}</td><td>${escapePrintHtml(item.timing || '—')}</td></tr>`).join('')}</tbody></table></div>`;
      }).join('') || '<p>No medicines recorded.</p>';

      return `<div class="visit-summary"><h1>${escapePrintHtml(visitTitle)}</h1>${[
        clinicalPrintSections.symptoms && section('Presenting Complaints', symptomsHtml),
        clinicalPrintSections.vitals && section('Vitals', vitalsHtml),
        clinicalPrintSections.diagnosis && section('Diagnosis', diagnosisHtml),
        clinicalPrintSections.investigation && section('Investigation', investigationHtml),
        clinicalPrintSections.history && section('History & Examination', historyHtml),
        clinicalPrintSections.doctorNotes && section('Doctor Notes', doctorNotesHtml),
        clinicalPrintSections.pregnancyHistory && section('Pregnancy / Garbhsanskar History', pregnancyHistory.length ? pregnancyHistory.map((entry) => `<div class="detail"><span>${escapePrintHtml(formatResponseDate(entry.date) || 'Undated')} · ${escapePrintHtml(entry.pregnancyStage || 'Stage not recorded')}</span><strong>${escapePrintHtml(entry.gynecName ? `Gynec: ${entry.gynecName}` : 'Gynec not recorded')}</strong><p>${escapePrintHtml(entry.gynecAdvice || 'No gynec advice recorded')}</p>${entry.tests ? `<p><b>Reports / Tests:</b> ${escapePrintHtml(entry.tests)}</p>` : ''}${entry.medicines ? `<p><b>Medicines / Supplements:</b> ${escapePrintHtml(entry.medicines)}</p>` : ''}${entry.garbhsanskarAdvice ? `<p><b>Garbhsanskar Plan:</b> ${escapePrintHtml(entry.garbhsanskarAdvice)}</p>` : ''}${entry.nextFollowup ? `<p><b>Next Follow-up:</b> ${escapePrintHtml(formatResponseDate(entry.nextFollowup))}</p>` : ''}</div>`).join('') : '<p>No pregnancy history recorded.</p>'),
        clinicalPrintSections.treatment && section('Treatment Plan', treatmentHtml),
        clinicalPrintSections.medicines && section('Medicines / Products', medicinesHtml),
        clinicalPrintSections.followup && section('Next Follow-up', `<div class="details">${detail('Date', followupData.date)}${detail('Time', followupData.time)}${detail('Notes', followupData.notes)}${detail('Status', followupData.status)}</div>`),
        clinicalPrintSections.payment && section('Payment Details', `<div class="details">${detail('Invoice', paymentData.invoice)}${detail('Amount', paymentData.amount ? `₹ ${paymentData.amount}` : '')}${detail('Paid', paymentData.paidAmount ? `₹ ${paymentData.paidAmount}` : '')}${detail('Pending', paymentData.pendingAmount ? `₹ ${paymentData.pendingAmount}` : '')}${detail('Status', paymentData.status)}</div>`),
      ].filter(Boolean).join('')}</div>`;
    }).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapePrintHtml(selectedClient)} - Clinical Summary</title><style>*{box-sizing:border-box}body{margin:0;padding:28px 34px;color:#173b31;font-family:Arial,sans-serif;font-size:12px;line-height:1.5}.header{display:flex;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:3px solid #0e5b52}.header h1{margin:0 0 4px;color:#0e5b52;font-size:22px}.header p{margin:0;color:#60776f}.clinic{text-align:right;font-weight:700}.patient-line{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:start;gap:38px;margin-top:16px;padding-bottom:9px;border-bottom:1px solid #173b31;color:#111}.patient-line strong{overflow-wrap:anywhere}.visit-summary{margin-top:24px;padding-top:14px;border-top:2px solid #0e5b52;break-before:auto}.visit-summary>h1{margin:0;color:#0e5b52;font-size:17px}section{margin-top:17px;break-inside:avoid}h2{margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #d6e4df;color:#0e5b52;font-size:14px}p{margin:0;white-space:pre-wrap}.print-list{margin:0;padding-left:18px}.print-list li{margin:0 0 5px;break-inside:avoid}.details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.detail{padding:8px;border:1px solid #dbe7e2;border-radius:6px}.detail span{display:block;margin-bottom:2px;color:#6a7f77;font-size:10px}.detail strong{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #d6e4df;text-align:left;vertical-align:top}th{background:#edf7f3}.custom-note{margin-top:18px;padding:10px;border:1px solid #d6e4df;border-radius:6px;white-space:pre-wrap}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #d6e4df;color:#758a82;font-size:10px;display:flex;justify-content:space-between}@page{margin:14mm}@media print{body{padding:0}th{background:#edf7f3!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><div><h1>${escapePrintHtml(clinicalPrintTitle || 'Clinical Summary')}</h1><p>${selectedVisits.length} selected patient journey${selectedVisits.length === 1 ? '' : 's'}</p></div><div class="clinic">Mom's Pathshala<br>Main Branch</div></div>${patientSection}${visitSections}${clinicalPrintNote.trim() ? `<div class="custom-note"><strong>Additional Instructions</strong><br>${escapePrintHtml(clinicalPrintNote).replaceAll('\n', '<br>')}</div>` : ''}<div class="footer"><span>Generated from Patient Journey</span><span>Doctor / Consultant Signature: __________________</span></div><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},300)});<\/script></body></html>`);
    printWindow.document.close();
  };

  const saveAppointment = () => {
    if (!appointmentForm.date || !appointmentForm.time) return;
    const current = normalizeAppointments(loadValue(appointmentsKey, []));
    const row = [selectedClient, appointmentForm.mobile, appointmentForm.date, appointmentForm.time, appointmentForm.type, appointmentForm.status];
    window.localStorage.setItem(appointmentsKey, JSON.stringify([row, ...current]));
    if (stageModal === 'returning-visit') {
      const visitId = `visit-${appointmentForm.date}-${Date.now()}`;
      const now = new Date().toISOString();
      setJourneys((currentJourneys) => {
        const record = normalizeJourneyRecord(currentJourneys[selectedClient]);
        const previousConsultation = record.visits.slice().reverse().find((visit) => visit?.consultationData);
        return {
          ...currentJourneys,
          [selectedClient]: {
            visits: [...record.visits, {
              id: visitId,
              visitDate: appointmentForm.date,
              createdAt: now,
              updatedAt: now,
              appointment: true,
              appointmentData: appointmentForm,
              appointmentAt: now,
              ...(previousConsultation?.consultationData ? {
                consultationData: { ...previousConsultation.consultationData },
                consultationCarriedForwardFrom: previousConsultation.id,
              } : {}),
              ...(record.visits.slice().reverse().find((visit) => visit?.dietPlanData)?.dietPlanData ? {
                dietPlanData: {
                  ...record.visits.slice().reverse().find((visit) => visit?.dietPlanData).dietPlanData,
                  id: `diet-plan-${Date.now()}`,
                  client: selectedClient,
                  planDate: appointmentForm.date,
                  carriedForwardFrom: record.visits.slice().reverse().find((visit) => visit?.dietPlanData).id,
                  updatedAt: now,
                },
              } : {}),
            }],
            activeVisitId: visitId,
          },
        };
      });
      setSelectedVisitId(visitId);
    } else {
      updateJourney({ appointment: true, appointmentData: appointmentForm, visitDate: appointmentForm.date, appointmentAt: new Date().toISOString() });
    }
    setStageModal('');
  };

  const saveRequiredForm = () => {
    if (!hasRequiredFormResponse && !matchedFormResponses.length) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString(), matchedResponses: matchedFormResponses.length });
    setStageModal('');
  };

  const saveTreatment = () => {
    const current = loadValue(operationsKey, {});
    const cleanedSections = treatmentSections.map((sec) => {
      const validMedicines = (sec.medicines || [])
        .map((row) => ({
          medicine: String(row.medicine ?? '').trim(),
          dose: String(row.dose ?? '').trim(),
          timing: String(row.timing ?? '').trim(),
        }))
        .filter((row) => row.medicine);
      return {
        ...sec,
        service: sec.service || 'Consultation',
        goal: sec.goal?.trim() || '',
        duration: sec.duration || '30 days',
        status: sec.status || 'Active',
        medicines: validMedicines,
        medicine: validMedicines.map((m) => m.medicine).join(', '),
        dose: validMedicines.map((m) => m.dose).join(', '),
        timing: validMedicines.map((m) => m.timing).join(', '),
      };
    });

    const hasAnyContent = cleanedSections.some((s) => s.goal.trim() || s.medicines.length);
    if (!hasAnyContent) {
      setTreatmentSaveError('Add a treatment goal or at least one medicine before saving.');
      return;
    }
    setTreatmentSaveError('');

    const primarySection = cleanedSections[0] || {};
    const allMedicines = cleanedSections.flatMap((s) => s.medicines);
    const treatmentData = {
      ...primarySection,
      sections: cleanedSections,
      medicines: allMedicines,
      medicine: allMedicines.map((m) => m.medicine).join(', '),
      dose: allMedicines.map((m) => m.dose).join(', '),
      timing: allMedicines.map((m) => m.timing).join(', '),
    };

    const existingRows = Array.isArray(current.treatments) ? current.treatments : [];
    const nextRows = existingRows.filter((savedRow) => !(
      Array.isArray(savedRow) && savedRow[0] === selectedClient
    ));
    const newClientRows = cleanedSections.map((sec) => [
      selectedClient,
      sec.service,
      sec.medicine,
      sec.dose,
      sec.timing,
      sec.goal,
      sec.duration,
      sec.status,
    ]);

    window.localStorage.setItem(operationsKey, JSON.stringify({ ...current, treatments: [...newClientRows, ...nextRows] }));
    updateJourney({ treatment: true, treatmentData, treatmentAt: new Date().toISOString() });
    setStageModal('');
  };

  const saveDietPlan = () => {
    if (!dietPlanForm.goal.trim()) return;
    const plan = {
      ...dietPlanForm,
      client: selectedClient,
      meals: dietPlanForm.meals.filter((meal) => [meal.time, meal.meal, meal.food, meal.notes].some((value) => String(value ?? '').trim())),
      updatedAt: new Date().toISOString(),
    };
    const savedPlans = loadValue(dietPlansKey, []);
    const nextPlans = Array.isArray(savedPlans) && journey.dietPlanData?.id
      ? savedPlans.map((item) => item?.id === journey.dietPlanData.id ? plan : item)
      : [plan, ...(Array.isArray(savedPlans) ? savedPlans : [])];
    window.localStorage.setItem(dietPlansKey, JSON.stringify(nextPlans));
    updateJourney({ diet: true, dietPlanData: plan, dietAt: new Date().toISOString() });
    setStageModal('');
  };

  const updateDietMeal = (index, field, value) => {
    setDietPlanForm((current) => ({
      ...current,
      meals: current.meals.map((meal, mealIndex) => mealIndex === index ? { ...meal, [field]: value } : meal),
    }));
  };

  const addQuickMealSlot = (slot) => {
    setDietPlanForm((current) => ({
      ...current,
      meals: [...current.meals, { time: slot.time || '', meal: slot.meal || 'Meal', food: slot.food || '', notes: slot.notes || '' }],
    }));
  };

  const duplicateDietMeal = (index) => {
    setDietPlanForm((current) => {
      const target = current.meals[index];
      if (!target) return current;
      const nextMeals = [...current.meals];
      nextMeals.splice(index + 1, 0, { ...target });
      return { ...current, meals: nextMeals };
    });
  };

  const moveDietMeal = (index, direction) => {
    setDietPlanForm((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.meals.length) return current;
      const nextMeals = [...current.meals];
      const temp = nextMeals[index];
      nextMeals[index] = nextMeals[nextIndex];
      nextMeals[nextIndex] = temp;
      return { ...current, meals: nextMeals };
    });
  };

  const removeDietMeal = (index) => {
    setDietPlanForm((current) => ({
      ...current,
      meals: current.meals.length > 1 ? current.meals.filter((_, mealIndex) => mealIndex !== index) : current.meals,
    }));
  };

  const appendDietGuideline = (rule) => {
    setDietPlanForm((current) => {
      const trimmed = String(current.instructions ?? '').trim();
      const nextInstructions = trimmed ? `${trimmed}\n• ${rule}` : `• ${rule}`;
      return { ...current, instructions: nextInstructions };
    });
    setDietToastMessage('Guideline added to instructions!');
    setTimeout(() => setDietToastMessage(''), 2500);
  };

  const applyClinicalDietPreset = (preset) => {
    setSelectedDietPreset(preset.id);
    setDietPlanForm((current) => ({
      ...current,
      goal: preset.goal,
      calories: preset.calories,
      water: preset.water,
      duration: preset.duration || current.duration,
      service: preset.service || current.service,
      weekLabel: preset.weekLabel || current.weekLabel,
      instructions: preset.instructions || current.instructions,
      meals: preset.meals.map((m) => ({ ...m })),
    }));
    setDietToastMessage(`Loaded ${preset.label} protocol (${preset.meals.length} meals)!`);
    setTimeout(() => setDietToastMessage(''), 3500);
  };

  const saveDietTemplate = () => {
    if (!dietTemplateName.trim()) return;
    const template = {
      name: dietTemplateName.trim(),
      service: dietPlanForm.service,
      goal: dietPlanForm.goal,
      duration: dietPlanForm.duration,
      planDate: dietPlanForm.planDate,
      weekLabel: dietPlanForm.weekLabel,
      calories: dietPlanForm.calories,
      water: dietPlanForm.water,
      instructions: dietPlanForm.instructions,
      meals: dietPlanForm.meals.filter((meal) => [meal.time, meal.meal, meal.food, meal.notes].some((value) => String(value ?? '').trim())),
    };
    const nextTemplates = [template, ...dietTemplates.filter((t) => t.name.toLowerCase() !== template.name.toLowerCase())];
    setDietTemplates(nextTemplates);
    window.localStorage.setItem(dietTemplatesKey, JSON.stringify(nextTemplates));
    setDietToastMessage(`Saved template "${template.name}"!`);
    setTimeout(() => setDietToastMessage(''), 3000);
  };

  const applyDietTemplate = (index) => {
    const template = dietTemplates[Number(index)];
    if (!template) return;
    setDietPlanForm((current) => ({
      ...current,
      service: template.service || current.service,
      goal: template.goal || current.goal,
      duration: template.duration || current.duration,
      weekLabel: template.weekLabel || current.weekLabel,
      calories: template.calories || current.calories,
      water: template.water || current.water,
      instructions: template.instructions || current.instructions,
      meals: Array.isArray(template.meals) && template.meals.length ? template.meals.map((m) => ({ ...m })) : current.meals,
    }));
    setDietTemplateName(template.name || '');
    setDietToastMessage(`Loaded template "${template.name}"!`);
    setTimeout(() => setDietToastMessage(''), 3000);
  };

  const openDietPdf = (plan) => {
    const html = buildDietPlanPrintHtml(plan);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileSafeDietName(plan.client)}-diet-plan.html`;
      a.click();
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const copyDietForWhatsApp = (plan) => {
    const mealText = (plan.meals || []).map((m, i) =>
      `⏰ *${m.time || '—'} - ${m.meal || `Meal ${i + 1}`}*\n🥗 ${m.food || '—'}${m.notes ? `\n📝 _${m.notes}_` : ''}`
    ).join('\n\n');

    const text = `🌿 *SHREE AYURVED HOSPITAL & CLINIC*
📋 *Personalized Diet Plan*
━━━━━━━━━━━━━━━━━━━
👤 *Patient:* ${plan.client || 'Patient'}
🎯 *Goal:* ${plan.goal || 'Health & Nutrition'}
📅 *Duration:* ${plan.duration || '30 days'}
💧 *Daily Water:* ${plan.water || '2.5 - 3.0 L'}
⚡ *Calories:* ${plan.calories || 'As advised'}
━━━━━━━━━━━━━━━━━━━
🍽️ *DAILY MEAL SCHEDULE:*

${mealText || 'No meals added.'}

━━━━━━━━━━━━━━━━━━━
📌 *GUIDELINES & PRECAUTIONS:*
${plan.instructions || 'Follow warm hydration and healthy sleep habits.'}
━━━━━━━━━━━━━━━━━━━
✨ _Wishing you vibrant health and wellness!_`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setDietToastMessage('Diet Plan copied to clipboard! Ready to paste in WhatsApp.');
        setTimeout(() => setDietToastMessage(''), 4000);
      }).catch(() => {
        alert('Could not auto-copy to clipboard. Please use Print PDF.');
      });
    } else {
      alert('Clipboard not accessible on this device.');
    }
  };

  const savePayment = () => {
    if (!paymentForm.amount) return;
    const current = loadValue(paymentsKey, []);
    const row = normalizeJourneyPayment({ client: selectedClient, ...paymentForm });
    window.localStorage.setItem(paymentsKey, JSON.stringify([row, ...current]));
    updateJourney({ billing: true, paymentData: paymentForm, paidAt: new Date().toISOString() });
    setStageModal('');
  };

  const saveFollowup = () => {
    if (!followupForm.date || !followupForm.time) return;
    const current = normalizeAppointments(loadValue(appointmentsKey, []));
    const previous = journey.followupData;
    const withoutPreviousFollowup = current.filter((appointment) => !(
      String(appointment[0]).toLowerCase() === selectedClient.toLowerCase()
      && appointment[4] === 'Follow-up'
      && previous
      && appointment[2] === previous.date
      && appointment[3] === previous.time
    ));
    const row = [selectedClient, clientMobile(selectedClientRecord), followupForm.date, followupForm.time, 'Follow-up', followupForm.status];
    window.localStorage.setItem(appointmentsKey, JSON.stringify([row, ...withoutPreviousFollowup]));
    updateJourney({ followup: true, followupData: followupForm, followupAt: new Date().toISOString() });
    setStageModal('');
  };

  const runStage = (stage) => {
    if (stage === 'appointment' || stage === 'forms' || stage === 'consultation' || stage === 'treatment' || stage === 'diet' || stage === 'billing' || stage === 'followup') openStageModal(stage);
  };

  const completedStageCount = STAGES.filter(([id]) => stageDone(id)).length;
  const totalStageCount = STAGES.length;
  const progressPercentage = Math.round((completedStageCount / totalStageCount) * 100);

  return (
    <section className="module-page journey-page">
      <div className="module-hero compact-hero">
        <div><h1>Patient Journey</h1><p>Run the complete reception-to-payment workflow from one workspace.</p><p className="subtle">Shared cloud workspace</p></div>
        <div className="module-stats"><div className="mini-stat"><span>Registered Patients</span><strong>{clientRecords.length}</strong></div><div className="mini-stat"><span>Active Journeys</span><strong>{Object.keys(journeys).length}</strong></div><div className="mini-stat"><span>Selected Stage</span><strong>{selectedClient ? nextAction() : 'Select patient'}</strong></div></div>
      </div>

      <div className="journey-layout">
        <div className={`reception-col ${selectedClient && !showMobileList ? 'mobile-hidden' : ''}`}>
          <Card
            title="Reception Desk"
            subtitle="Search an existing patient or register a new walk-in."
            className="reception-card"
            action={<button className="pill primary-action" type="button" onClick={() => navigate('/clients?action=add')}>+ Register Patient</button>}
          >
            <div className="journey-search-wrap">
              <input
                className="lead-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patient by ID, name, or mobile..."
              />
            </div>
            <div className="returning-patient-action">
              <div>
                <strong>Returning patient?</strong>
                <span>Select an existing patient below, then start a new visit with saved profile data.</span>
              </div>
              <button className="pill" type="button" disabled={!selectedClient} onClick={openReturningVisit}>
                + Start New Visit
              </button>
            </div>
            <div className="journey-client-list">
              {visibleClients.length ? visibleClients.map((row) => {
                const name = clientName(row);
                const id = clientId(row);
                const phone = clientMobile(row);
                const visitMeta = clientVisitMeta.get(normalizePersonName(name));
                const isSelected = selectedClient === name;
                const initials = String(name || 'P')
                  .trim()
                  .split(/\s+/)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'P';

                return (
                  <button
                    className={`journey-client ${isSelected ? 'active' : ''}`}
                    type="button"
                    key={id || name}
                    onClick={() => {
                      setSelectedClient(name);
                      setShowMobileList(false);
                    }}
                  >
                    <div className="journey-client-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="journey-client-content">
                      <div className="journey-client-name" title={name}>
                        {name}
                      </div>
                      <div className="journey-client-details">
                        {id && <span className="journey-client-id">#{id.replace(/^#/, '')}</span>}
                        <span className="journey-client-phone">📞 {phone || 'No mobile saved'}</span>
                      </div>
                      <div className="journey-client-footer">
                        <span className={`journey-status-pill ${journeys[name] ? 'in-progress' : 'ready'}`}>
                          {journeys[name] ? '● In progress' : '○ Ready'}
                        </span>
                        <time
                          className="journey-client-time"
                          dateTime={visitMeta ? `${visitMeta.date}${visitMeta.time ? `T${visitMeta.time}` : ''}` : undefined}
                        >
                          🕒 {visitMeta ? formatJourneyDateTime(visitMeta.date, visitMeta.time) : 'No visit yet'}
                        </time>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="empty-state compact-empty">
                  <strong>No patients found.</strong>
                  <p>Register the patient before booking an appointment.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className={`patient-journey-col ${!selectedClient || showMobileList ? 'mobile-hidden' : ''}`}>
          {selectedClient ? (
            <div className="patient-journey-content">
              {/* 1. Ultra-Premium Patient Hero Header Card */}
              <div className="patient-journey-hero-card">
                <div className="patient-hero-top-row">
                  <div className="patient-hero-identity">
                    <div className="patient-hero-avatar" aria-hidden="true">
                      {selectedClient.charAt(0).toUpperCase()}
                    </div>
                    <div className="patient-hero-info">
                      <div className="patient-hero-name-row">
                        <h2>{selectedClient}</h2>
                        {clientId(selectedClientRecord) && (
                          <span className="patient-hero-badge id-badge">
                            #{clientId(selectedClientRecord).replace(/^#/, '')}
                          </span>
                        )}
                        <span className="patient-hero-badge program-badge">
                          🌿 {selectedClientRecord?.program || selectedClientRecord?.['Program'] || 'Ayurveda Care'}
                        </span>
                      </div>
                      <div className="patient-hero-meta-row">
                        {clientMobile(selectedClientRecord) ? (
                          <a href={`tel:${clientMobile(selectedClientRecord)}`} className="patient-hero-meta-item phone-link">
                            📞 {clientMobile(selectedClientRecord)}
                          </a>
                        ) : (
                          <span className="patient-hero-meta-item">📞 No mobile</span>
                        )}
                        <span className="patient-hero-meta-dot">·</span>
                        <span className="patient-hero-meta-item">
                          👤 {patientAgeGender(selectedClientRecord) || 'Age/Gender N/A'}
                        </span>
                        <span className="patient-hero-meta-dot">·</span>
                        <span className="patient-hero-meta-item">
                          🗓️ {clientVisitDate(selectedClientRecord) ? `Reg: ${formatResponseDate(clientVisitDate(selectedClientRecord))}` : 'Saved Patient'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="patient-hero-actions">
                    <button className="pill primary-action" type="button" onClick={openReturningVisit}>
                      + Start New Visit
                    </button>
                    <button className="pill" type="button" onClick={openClinicalPrint}>
                      🖨️ Handout / Print
                    </button>
                    {pastJourneyVisits.length > 0 && (
                      <button className="pill" type="button" onClick={openPastJourneyPrint}>
                        📄 Past History PDF
                      </button>
                    )}
                    <button className="pill mobile-back-btn" type="button" onClick={() => setShowMobileList(true)}>
                      ← Switch Patient
                    </button>
                  </div>
                </div>

                <div className="patient-hero-progress-bar-wrap">
                  <div className="patient-hero-progress-label">
                    <span>
                      <strong>Journey Progress:</strong> {completedStageCount} of {totalStageCount} stages completed
                    </span>
                    <span className="progress-percent">{progressPercentage}%</span>
                  </div>
                  <div className="patient-hero-progress-track">
                    <div className="patient-hero-progress-fill" style={{ width: `${progressPercentage}%` }} />
                  </div>
                </div>
              </div>

              {/* 2. Visit Timeline Selector Bar */}
              <div className="journey-visit-selector-bar">
                <div className="visit-selector-label">
                  <span className="visit-icon">🗓️</span>
                  <div>
                    <strong>Visits Timeline</strong>
                    <small>{journeyVisits.length} {journeyVisits.length === 1 ? 'visit' : 'visits'} on record</small>
                  </div>
                </div>
                <div className="visit-selector-chips" role="tablist" aria-label="Visit timeline">
                  {[...journeyVisits].sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))).map((visit, index) => {
                    const isSelected = activeVisitId === visit.id;
                    return (
                      <button
                        key={visit.id}
                        className={`journey-visit-chip ${isSelected ? 'active' : ''}`}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setSelectedVisitId(visit.id)}
                      >
                        <strong>{formatResponseDate(visit.visitDate)}</strong>
                        <span>{visit.appointmentData?.type || (index === 0 ? 'Latest Visit' : 'Follow-up')}</span>
                      </button>
                    );
                  })}
                  <button className="journey-visit-add-chip" type="button" onClick={openReturningVisit}>
                    + New Visit
                  </button>
                </div>
              </div>

              {/* 3. Section Tabs */}
              <div className="journey-view-tabs" role="tablist" aria-label="Journey view sections">
                <button
                  className={`journey-view-tab ${patientViewTab === 'workflow' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={patientViewTab === 'workflow'}
                  onClick={() => setPatientViewTab('workflow')}
                >
                  ⚡ Clinical Workflow ({completedStageCount}/{totalStageCount})
                </button>
                <button
                  className={`journey-view-tab ${patientViewTab === 'records' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={patientViewTab === 'records'}
                  onClick={() => setPatientViewTab('records')}
                >
                  📋 History & Vitals {selectedWeightUpdates.length || pregnancyHistoryEntries.length ? `(${selectedWeightUpdates.length + pregnancyHistoryEntries.length})` : ''}
                </button>
                <button
                  className={`journey-view-tab ${patientViewTab === 'handout' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={patientViewTab === 'handout'}
                  onClick={() => setPatientViewTab('handout')}
                >
                  🖨️ Handout & Summary
                </button>
              </div>

              {/* 4. Tab 1: Clinical Workflow Stages */}
              {patientViewTab === 'workflow' && (
                <>
                  <div className="journey-stages-grid">
                    {STAGES.map(([id]) => {
                      const info = getStageInfo(id);
                      return (
                        <div className={`journey-stage-card ${info.statusTone}`} key={id}>
                          <div className={`journey-stage-index-badge ${info.statusTone}`}>
                            {info.complete ? '✓' : (STAGES.findIndex(([s]) => s === id) + 1)}
                          </div>
                          <div className="journey-stage-content">
                            <div className="journey-stage-head">
                              <div className="journey-stage-title-wrap">
                                <h3>{info.title}</h3>
                                <span className={`journey-status-pill ${info.statusTone}`}>{info.status}</span>
                              </div>
                              {info.tags && info.tags.length > 0 && (
                                <div className="journey-stage-tags">
                                  {info.tags.map((tag, tIndex) => (
                                    <span className="journey-stage-tag" key={tIndex}>{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="journey-stage-summary-text">{info.summary}</p>
                          </div>
                          <div className="journey-stage-action-wrap">
                            <button
                              className={`pill ${info.statusTone === 'current' ? 'primary-action' : ''}`}
                              type="button"
                              onClick={info.onClick}
                            >
                              {info.buttonText}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {nextAction() !== 'completed' ? (
                    <div className="journey-next-action-bar">
                      <div className="next-action-copy">
                        <strong>Next Recommended Step:</strong>
                        <span>{STAGES.find(([id]) => id === nextAction())?.[1]}</span>
                      </div>
                      <button className="pill primary-action journey-next-btn" type="button" onClick={() => runStage(nextAction())}>
                        Continue to {STAGES.find(([id]) => id === nextAction())?.[1]} →
                      </button>
                    </div>
                  ) : (
                    <div className="journey-completed-banner">
                      <span className="check-icon">✓</span>
                      <div>
                        <strong>Complete Patient Journey Recorded</strong>
                        <p>All core clinical stages for this visit have been completed. You can now generate the patient handout or print receipt.</p>
                      </div>
                      <button className="pill primary-action" type="button" onClick={openClinicalPrint}>
                        Customize & Print Handout
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* 5. Tab 2: Medical History & Vitals */}
              {patientViewTab === 'records' && (
                <div className="journey-records-container">
                  {selectedWeightUpdates.length > 0 ? (
                    <div className="patient-weight-summary">
                      <div className="weight-summary-head">
                        <div>
                          <strong>Weight Tracking History</strong>
                          <small>Auto-synced from submitted patient health forms</small>
                        </div>
                        <div className="weight-metric-box">
                          <strong>{selectedWeightUpdates[0].value}</strong>
                          <span>{selectedWeightUpdates[0].unit || 'kg'} (Latest)</span>
                        </div>
                      </div>
                      <div className="patient-weight-history" aria-label={`${selectedClient} weight history`}>
                        {selectedWeightUpdates.slice(0, 8).map((update) => (
                          <div className="weight-history-chip" key={update.id}>
                            <strong>{update.value} {update.unit || 'kg'}</strong>
                            <small>{formatResponseDate(update.recordedAt)}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state compact-empty" style={{ background: '#fff', marginBottom: '16px', borderRadius: '14px' }}>
                      <strong>No weight updates recorded.</strong>
                      <p>Weight entries from submitted patient intake and progress forms will appear here automatically.</p>
                    </div>
                  )}

                  <div className="pregnancy-history-panel">
                    <div className="pregnancy-history-head">
                      <div>
                        <strong>Pregnancy & Garbhsanskar Clinical Notes</strong>
                        <span>{pregnancyHistoryEntries.length ? `${pregnancyHistoryEntries.length} history ${pregnancyHistoryEntries.length === 1 ? 'entry' : 'entries'} saved` : 'Record what the gynec advised during each visit.'}</span>
                      </div>
                      <button className="pill" type="button" onClick={openPregnancyHistory}>+ Add Clinical Note</button>
                    </div>
                    {pregnancyHistoryEntries.length ? (
                      <div className="pregnancy-history-timeline">
                        {pregnancyHistoryEntries.map((entry) => (
                          <article className="pregnancy-history-entry" key={entry.id}>
                            <div className="pregnancy-history-date">
                              <strong>{formatResponseDate(entry.date || entry.visitDate)}</strong>
                              <span>{entry.pregnancyStage || 'Stage not specified'}</span>
                            </div>
                            <div className="pregnancy-history-content">
                              {entry.gynecName && <p><b>Gynec:</b> {entry.gynecName}</p>}
                              {entry.gynecAdvice && <p><b>Gynec Advice:</b> {entry.gynecAdvice}</p>}
                              {entry.tests && <p><b>Reports / Tests:</b> {entry.tests}</p>}
                              {entry.medicines && <p><b>Medicines / Supplements:</b> {entry.medicines}</p>}
                              {entry.garbhsanskarAdvice && <p><b>Garbhsanskar Plan:</b> {entry.garbhsanskarAdvice}</p>}
                              {entry.nextFollowup && <p><b>Next Follow-up:</b> {formatResponseDate(entry.nextFollowup)}</p>}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="pregnancy-history-empty">
                        No pregnancy or Garbhsanskar clinical history added yet. Click "+ Add Clinical Note" above to record advice.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Tab 3: Patient Handout & Summary */}
              {patientViewTab === 'handout' && (
                <div className="journey-handout-preview-card">
                  <div className="journey-handout-preview-head">
                    <div>
                      <strong>Visit Handout Summary ({formatResponseDate(journey.visitDate)})</strong>
                      <p>Review the active consultation notes, prescribed medicines, and customized printing options.</p>
                    </div>
                    <button className="pill primary-action" type="button" onClick={openClinicalPrint}>
                      🖨️ Customize & Print Full PDF
                    </button>
                  </div>
                  <div className="journey-handout-grid">
                    <div className="journey-handout-item">
                      <strong>Diagnosis & Complaints</strong>
                      {consultationSectionsFromData(journey.consultationData).map((sec, idx) => (
                        <div key={sec.id || idx} style={{ marginTop: idx > 0 ? '6px' : '0' }}>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>[{sec.service || 'Consultation'}]: </span>
                          <span>{sec.diagnosis || 'No diagnosis'}</span>
                          {sec.complaint && <small style={{ color: 'var(--muted)', display: 'block', marginTop: '2px' }}>Complaints: {sec.complaint}</small>}
                        </div>
                      ))}
                    </div>
                    <div className="journey-handout-item">
                      <strong>Vitals & Examination</strong>
                      <p>{journey.consultationData?.vitals || 'Vitals stable / not recorded'}</p>
                    </div>
                    <div className="journey-handout-item">
                      <strong>Treatment Plan</strong>
                      {treatmentSectionsFromData(journey.treatmentData).map((sec, idx) => (
                        <div key={sec.id || idx} style={{ marginTop: idx > 0 ? '4px' : '0' }}>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>[{sec.service}]: </span>
                          <span>{[sec.duration, sec.goal].filter(Boolean).join(' · ') || 'Active'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="journey-handout-item">
                      <strong>Prescribed Medicines</strong>
                      {treatmentSectionsFromData(journey.treatmentData).map((sec, idx) => {
                        const meds = clinicalMedicines(sec);
                        return (
                          <div key={sec.id || idx} style={{ marginTop: idx > 0 ? '6px' : '0' }}>
                            <span style={{ fontWeight: 600, color: 'var(--green)' }}>[{sec.service}]: </span>
                            <span>{meds.length ? meds.map((m) => `${m.medicine} (${m.dose || ''} ${m.timing || ''})`).join(', ') : 'No medicines prescribed'}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="journey-handout-item">
                      <strong>Next Review Date</strong>
                      <p>{journey.followupData?.date ? `${formatResponseDate(journey.followupData.date)} ${journey.followupData.time || ''}` : 'Follow-up pending'}</p>
                    </div>
                    <div className="journey-handout-item">
                      <strong>Billing Status</strong>
                      <p>{journey.paymentData?.amount ? `₹ ${journey.paymentData.amount} · ${journey.paymentData.status || 'Paid'}` : 'Payment pending'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card empty-state" style={{ minHeight: '340px', display: 'grid', placeContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏥</div>
              <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>No Patient Selected</strong>
              <p style={{ color: 'var(--muted)', maxWidth: '380px', margin: '6px auto 16px' }}>
                Select an existing patient from the Reception Desk on the left, or register a new patient to run the complete clinical workflow.
              </p>
              <button className="pill primary-action" type="button" onClick={() => navigate('/clients?action=add')}>
                + Register New Patient
              </button>
            </div>
          )}
        </div>
      </div>

      {clinicalPrintOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setClinicalPrintOpen(false)}>
          <div className="modal-shell clinical-print-modal" role="dialog" aria-modal="true" aria-label="Customize patient print" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Customize Patient Print</h2><p>{selectedClient} · Select only the sections you want to print.</p></div>
              <button className="icon-btn" type="button" onClick={() => setClinicalPrintOpen(false)} aria-label="Close print customization">x</button>
            </div>
            <div className="clinical-print-layout">
              <div className="clinical-print-controls">
                <div className="clinical-print-template-tools">
                  <label className="field-block"><span>Use Template</span><select className="lead-input" value={selectedClinicalPrintTemplate} onChange={(event) => applyClinicalPrintTemplate(event.target.value)}><option value="">{clinicalPrintTemplates.length ? 'Select saved print template...' : 'No print templates saved yet'}</option>{clinicalPrintTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label>
                  <label className="field-block"><span>Template Name</span><input className="lead-input" value={clinicalPrintTemplateName} onChange={(event) => setClinicalPrintTemplateName(event.target.value)} placeholder="e.g. Standard Consultation" /></label>
                  <div className="clinical-print-template-actions">
                    <button className="pill" type="button" disabled={!clinicalPrintTemplateName.trim()} onClick={saveClinicalPrintTemplate}>Save Template</button>
                    <button className="pill danger" type="button" disabled={selectedClinicalPrintTemplate === ''} onClick={deleteClinicalPrintTemplate}>Delete</button>
                  </div>
                </div>
                <label className="field-block"><span>Print Title</span><input className="lead-input" value={clinicalPrintTitle} onChange={(event) => setClinicalPrintTitle(event.target.value)} /></label>
                <div className="clinical-print-select-all">
                  <strong>Journey dates</strong>
                  <div><button className="pill" type="button" onClick={() => setClinicalPrintVisitIds(journeyVisits.map((visit) => visit.id))}>All journeys</button><button className="pill" type="button" onClick={() => setClinicalPrintVisitIds([])}>Clear</button></div>
                </div>
                <div className="clinical-print-visits">
                  {[...journeyVisits].sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))).map((visit) => (
                    <label className={`clinical-print-option ${clinicalPrintVisitIds.includes(visit.id) ? 'selected' : ''}`} key={visit.id}>
                      <input type="checkbox" checked={clinicalPrintVisitIds.includes(visit.id)} onChange={() => toggleClinicalPrintVisit(visit.id)} />
                      <span><strong>{formatResponseDate(visit.visitDate)}</strong><small>{visit.appointmentData?.time || 'Time not recorded'} · {visit.appointmentData?.type || 'Patient visit'}</small></span>
                    </label>
                  ))}
                </div>
                <div className="clinical-print-select-all">
                  <strong>Include in print</strong>
                  <div><button className="pill" type="button" onClick={() => setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])))}>Select all</button><button className="pill" type="button" onClick={() => setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, false])))}>Clear all</button></div>
                </div>
                <div className="clinical-print-options">
                  {PRINT_SECTION_OPTIONS.map(([id, label]) => (
                    <label className={`clinical-print-option ${clinicalPrintSections[id] ? 'selected' : ''}`} key={id}>
                      <input type="checkbox" checked={clinicalPrintSections[id]} onChange={() => toggleClinicalPrintSection(id)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className="field-block"><span>Additional Instructions</span><textarea className="lead-input" rows="4" value={clinicalPrintNote} onChange={(event) => setClinicalPrintNote(event.target.value)} placeholder="Optional custom instruction for this patient..." /></label>
              </div>
              <div className="clinical-print-preview" aria-live="polite">
                <div className="clinical-preview-header"><div><strong>{clinicalPrintTitle || 'Clinical Summary'}</strong><span>Mom&apos;s Pathshala</span></div><small>Print preview</small></div>
                <div className="clinical-preview-section"><strong>Selected Journey Dates</strong><p>{selectedClinicalPrintVisits.map((visit) => `${formatResponseDate(visit.visitDate)} · ${visit.appointmentData?.time || 'Time not recorded'} · ${visit.appointmentData?.type || 'Patient visit'}`).join('\n') || 'Select at least one journey date.'}</p></div>
                {clinicalPrintSections.patient && <div className="clinical-preview-section"><strong>{patientIdentity(selectedClient, selectedClientRecord)}</strong><p>{clientMobile(selectedClientRecord) || 'Mobile not saved'} · {new Date().toLocaleDateString('en-GB').replaceAll('/', '-')}</p></div>}
                {selectedClinicalPrintVisits.map((visit) => {
                  const consultationData = visit.consultationData ?? {};
                  const treatmentData = visit.treatmentData ?? {};
                  const followupData = visit.followupData ?? {};
                  const paymentData = visit.paymentData ?? {};
                  const pregnancyHistory = Array.isArray(visit.pregnancyHistory) ? visit.pregnancyHistory : [];
                  const visitTitle = `${formatResponseDate(visit.visitDate)} · ${visit.appointmentData?.time || 'Time not recorded'} · ${visit.appointmentData?.type || 'Patient visit'}`;
                  return <div className="clinical-preview-visit" key={visit.id}>
                    <h3>{visitTitle}</h3>
                    {clinicalPrintSections.symptoms && (
                      <div className="clinical-preview-section">
                        <strong>Presenting Complaints</strong>
                        {consultationSectionsFromData(consultationData).map((s) => (
                          <p key={s.id}><b>[{s.service || 'Consultation'}]:</b> {s.complaint || 'Not recorded'}</p>
                        ))}
                      </div>
                    )}
                    {clinicalPrintSections.vitals && <div className="clinical-preview-section"><strong>Vitals</strong><p>{consultationData.vitals || 'Not recorded'}</p></div>}
                    {clinicalPrintSections.diagnosis && (
                      <div className="clinical-preview-section">
                        <strong>Diagnosis</strong>
                        {consultationSectionsFromData(consultationData).map((s) => (
                          <p key={s.id}><b>[{s.service || 'Consultation'}]:</b> {s.diagnosis || 'Not recorded'}</p>
                        ))}
                      </div>
                    )}
                    {clinicalPrintSections.investigation && <div className="clinical-preview-section"><strong>Investigation</strong>{clinicalListItems(consultationData.investigation).length ? <ul className="clinical-preview-list">{clinicalListItems(consultationData.investigation).map((item, index) => <li key={`${visit.id}-investigation-${index}`}>{item}</li>)}</ul> : <p>Not recorded</p>}</div>}
                    {clinicalPrintSections.history && (
                      <div className="clinical-preview-section">
                        <strong>History &amp; Examination</strong>
                        {consultationSectionsFromData(consultationData).map((s) => (
                          <p key={s.id}><b>[{s.service || 'Consultation'}]:</b> {s.notes || 'Not recorded'}</p>
                        ))}
                      </div>
                    )}
                    {clinicalPrintSections.doctorNotes && (
                      <div className="clinical-preview-section">
                        <strong>Doctor Notes</strong>
                        {consultationSectionsFromData(consultationData).map((s) => (
                          <p key={s.id}><b>[{s.service || 'Consultation'}]:</b> {s.doctorNotes || 'Not recorded'}</p>
                        ))}
                      </div>
                    )}
                    {clinicalPrintSections.pregnancyHistory && <div className="clinical-preview-section"><strong>Pregnancy / Garbhsanskar History</strong><p>{pregnancyHistory.length ? pregnancyHistory.map((entry) => `${formatResponseDate(entry.date)} · ${entry.pregnancyStage || 'Stage not recorded'}\n${entry.gynecAdvice || entry.garbhsanskarAdvice || 'No advice recorded'}`).join('\n\n') : 'Not recorded'}</p></div>}
                    {clinicalPrintSections.treatment && (
                      <div className="clinical-preview-section">
                        <strong>Treatment Plan</strong>
                        {treatmentSectionsFromData(treatmentData).map((s) => (
                          <p key={s.id}><b>[{s.service}]:</b> {[s.goal, s.duration, s.status].filter(Boolean).join(' · ') || 'Not recorded'}</p>
                        ))}
                      </div>
                    )}
                    {clinicalPrintSections.medicines && (
                      <div className="clinical-preview-section">
                        <strong>Medicines, Dose &amp; Timing</strong>
                        {treatmentSectionsFromData(treatmentData).map((s) => {
                          const meds = clinicalMedicines(s);
                          if (!meds.length) return null;
                          return (
                            <div key={s.id} style={{ marginBottom: '8px' }}>
                              <small style={{ fontWeight: 700, color: 'var(--green)' }}>{s.service} Prescriptions:</small>
                              <div className="clinical-preview-medicine-list" role="table" aria-label={`Medicines for ${s.service}`}>
                                {meds.map((item, index) => (
                                  <div className="clinical-preview-medicine-row" role="row" key={`${visit.id}-${s.id}-${item.medicine}-${index}`}>
                                    <b aria-label={`Medicine ${index + 1}`}>{index + 1}</b>
                                    <span role="cell"><strong>{item.medicine}</strong><small>{item.dose || 'Dose not recorded'} · {item.timing || 'Timing not recorded'}</small></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {clinicalPrintSections.followup && <div className="clinical-preview-section"><strong>Next Follow-up</strong><p>{followupData.date ? `${followupData.date} · ${followupData.time || 'Time pending'}${followupData.notes ? ` · ${followupData.notes}` : ''}` : 'Not scheduled'}</p></div>}
                    {clinicalPrintSections.payment && <div className="clinical-preview-section"><strong>Payment Details</strong><p>{paymentData.amount ? `₹ ${paymentData.amount} · ${paymentData.status || 'Status not recorded'}` : 'Not recorded'}</p></div>}
                  </div>;
                })}
                {clinicalPrintNote.trim() && <div className="clinical-preview-section"><strong>Additional Instructions</strong><p>{clinicalPrintNote}</p></div>}
                {!Object.values(clinicalPrintSections).some(Boolean) && !clinicalPrintNote.trim() && <div className="empty-state compact-empty"><strong>No sections selected.</strong><p>Select at least one item to create a useful patient print.</p></div>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setClinicalPrintOpen(false)}>Cancel</button>
              <button className="pill primary-action" type="button" disabled={!clinicalPrintVisitIds.length || (!Object.values(clinicalPrintSections).some(Boolean) && !clinicalPrintNote.trim())} onClick={printClinicalSummary}>Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}

      {stageModal === 'appointment' && <JourneyModal title="Add Appointment" client={selectedClient} onClose={() => setStageModal('')} onSave={saveAppointment} saveLabel="Save Appointment"><div className="quick-preset-row"><button className="pill" type="button" onClick={() => setAppointmentPreset('now')}>Walk-in now</button><button className="pill" type="button" onClick={() => setAppointmentPreset('today')}>Today</button><button className="pill" type="button" onClick={() => setAppointmentPreset('tomorrow')}>Tomorrow</button><button className="pill" type="button" onClick={() => setAppointmentPreset('week')}>After 7 days</button><button className="pill" type="button" onClick={() => setAppointmentPreset('month')}>After 30 days</button></div><label className="field-block"><span>Mobile</span><input className="lead-input" type="tel" value={appointmentForm.mobile} onChange={(event) => setAppointmentForm((value) => ({ ...value, mobile: event.target.value }))} /></label><label className="field-block"><span>Date</span><input className="lead-input" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Time</span><input className="lead-input" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block"><span>Type</span><select className="lead-input" value={appointmentForm.type} onChange={(event) => setAppointmentForm((value) => ({ ...value, type: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Status</span><select className="lead-input" value={appointmentForm.status} onChange={(event) => setAppointmentForm((value) => ({ ...value, status: event.target.value }))}><option>Pending</option><option>Confirmed</option><option>Checked-in</option><option>Cancelled</option></select></label></JourneyModal>}

      {stageModal === 'returning-visit' && <JourneyModal title="New Visit for Existing Patient" client={selectedClient} onClose={() => setStageModal('')} onSave={saveAppointment} saveLabel="Add Visit & Check In"><div className="returning-patient-summary full-field"><span><strong>{clientId(selectedClientRecord) || 'Saved patient'}</strong> Patient ID</span><span><strong>{clientMobile(selectedClientRecord) || 'Not saved'}</strong> Mobile</span><span><strong>Auto-filled</strong> Saved profile linked</span></div><div className="action-note full-field"><strong>Existing patient selected.</strong> This creates a new visit while keeping all previous journey, treatment, form, and payment records linked.</div><label className="field-block"><span>Mobile</span><input className="lead-input" type="tel" value={appointmentForm.mobile} onChange={(event) => setAppointmentForm((value) => ({ ...value, mobile: event.target.value }))} /></label><label className="field-block"><span>Visit Date</span><input className="lead-input" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Visit Time</span><input className="lead-input" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block"><span>Service</span><select className="lead-input" value={appointmentForm.type} onChange={(event) => setAppointmentForm((value) => ({ ...value, type: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Status</span><select className="lead-input" value={appointmentForm.status} onChange={(event) => setAppointmentForm((value) => ({ ...value, status: event.target.value }))}><option>Checked-in</option><option>Confirmed</option><option>Pending</option></select></label></JourneyModal>}

      {stageModal === 'forms' && <JourneyModal title="Required Form" client={selectedClient} onClose={() => setStageModal('')} onSave={saveRequiredForm} saveLabel={matchedFormResponses.length ? 'Mark Form Received' : 'Waiting for Submission'} saveDisabled={!matchedFormResponses.length}><label className="field-block"><span>Form</span><select className="lead-input" value={requiredForm} onChange={(event) => setRequiredForm(event.target.value)}>{formOptions.length ? formOptions.map((form) => <option key={form.id || form.slug || formTitle(form)} value={formTitle(form)}>{formTitle(form)}</option>) : <option value="">No forms created yet</option>}</select></label><div className="action-note"><strong>{matchedFormResponses.length ? `${matchedFormResponses.length} response(s) found` : 'Submission not found'}</strong>{matchedFormResponses.length ? ' Mobile number matched with submitted form responses below.' : ' Ask the patient to submit any created form using the same mobile number saved in the patient profile.'}</div><div className="matched-response-list full-field">{matchedFormResponses.length ? matchedFormResponses.map(({ response, form }) => <div className="matched-response-card" key={response.id}><div><strong>{response.formTitle || formTitle(form) || 'Submitted Form'}</strong><span>{formatResponseDate(response.submittedAt)}</span></div>{responsePreview(response, form).map(([label, value]) => <p key={`${response.id}-${label}`}><b>{label}:</b> {value}</p>)}</div>) : <div className="empty-state compact-empty"><strong>No matched response yet.</strong><p>Patient mobile: {selectedClientPhone || 'not saved'}</p></div>}</div></JourneyModal>}

      {stageModal === 'treatment' && (
        <JourneyModal
          title={journey.treatment ? 'Edit Treatment Plan' : 'Add Treatment Plan'}
          client={selectedClient}
          onClose={() => setStageModal('')}
          onSave={saveTreatment}
          saveLabel={journey.treatment ? 'Update Treatment' : 'Save Treatment'}
          shellClassName="treatment-modal"
        >
          <div className="treatment-template-tools">
            <label className="field-block">
              <span>Use Template</span>
              <select className="lead-input" value={selectedTreatmentTemplate} onChange={(event) => applyTreatmentTemplate(event.target.value)}>
                <option value="">{treatmentTemplates.length ? 'Select saved template...' : 'No templates saved yet'}</option>
                {treatmentTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>Template Name</span>
              <input className="lead-input" value={treatmentTemplateName} onChange={(event) => setTreatmentTemplateName(event.target.value)} placeholder="e.g. Weight Loss 30 Days" />
            </label>
            {!journey.treatment && pastTreatmentOptions.length > 0 && (
              <label className="field-block">
                <span>Past Treatment Service</span>
                <select className="lead-input" value={selectedPastTreatmentService} onChange={(event) => { setSelectedPastTreatmentService(event.target.value); setPastTreatmentApplied(false); }}>
                  <option value="">Select past service...</option>
                  {pastTreatmentOptions.map((option) => <option key={`${option.service}-${option.visitDate}`} value={option.service}>{option.service}{option.visitDate ? ` · ${formatResponseDate(option.visitDate)}` : ''}</option>)}
                </select>
              </label>
            )}
            <div className="template-actions">
              {!journey.treatment && pastTreatmentOptions.length > 0 && <button className="pill primary-action" type="button" onClick={applyPreviousTreatment}>Use Past Treatment</button>}
              <button className="pill" type="button" disabled={!treatmentTemplateName.trim()} onClick={saveTreatmentTemplate}>Save Template</button>
              <button className="pill danger" type="button" disabled={selectedTreatmentTemplate === ''} onClick={deleteTreatmentTemplate}>Delete</button>
            </div>
          </div>
          {pastTreatmentApplied && <div className="action-note full-field"><strong>Past treatment loaded.</strong> Review the copied plan and medicines, then save this treatment.</div>}
          {treatmentSaveError && <div className="action-note danger-note full-field" role="alert"><strong>Treatment not saved.</strong> {treatmentSaveError}</div>}

          <div className="section-adder-row full-field">
            <button className="add-section-btn" type="button" onClick={addTreatmentSection}>
              + Add Service Section
            </button>
          </div>

          {treatmentSections.map((sec, secIndex) => (
            <div className="service-section-box full-field" key={sec.id || secIndex}>
              <div className="service-section-header">
                <div className="service-section-title-group">
                  <span className="service-badge">Section #{secIndex + 1}</span>
                  <label className="service-input-label">
                    <span>Service:</span>
                    <input
                      className="lead-input service-name-input"
                      list="treatment-service-options"
                      value={sec.service}
                      onChange={(e) => updateTreatmentSectionField(secIndex, 'service', e.target.value)}
                      placeholder="Select or type service..."
                      autoComplete="off"
                    />
                  </label>
                </div>
                {treatmentSections.length > 1 && (
                  <button
                    className="danger-subtle-btn"
                    type="button"
                    onClick={() => removeTreatmentSection(secIndex)}
                    title="Remove this section"
                  >
                    ✕ Remove Section
                  </button>
                )}
              </div>

              <div className="detail-grid">
                <label className="field-block">
                  <span>Goal (optional when medicines are added)</span>
                  <input
                    className="lead-input"
                    list="goal-presets"
                    value={sec.goal}
                    onChange={(event) => { updateTreatmentSectionField(secIndex, 'goal', event.target.value); setTreatmentSaveError(''); }}
                    placeholder="Treatment goal for this service"
                  />
                  <datalist id="goal-presets">{QUICK_TREATMENTS.map((preset) => <option key={preset.goal} value={preset.goal} />)}</datalist>
                </label>
                <label className="field-block">
                  <span>Duration</span>
                  <select
                    className="lead-input"
                    value={sec.duration}
                    onChange={(event) => updateTreatmentSectionField(secIndex, 'duration', event.target.value)}
                  >
                    {[...new Set([...DURATION_OPTIONS, sec.duration].filter(Boolean))].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Status</span>
                  <select
                    className="lead-input"
                    value={sec.status || 'Active'}
                    onChange={(event) => updateTreatmentSectionField(secIndex, 'status', event.target.value)}
                  >
                    <option>Active</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </label>

                <div className="treatment-medicine-builder full-field">
                  <div className="medicine-builder-head">
                    <div>
                      <strong>Medicines / Products for {sec.service || 'Service'}</strong>
                      <span>Search the medicine master or add a missing medicine without leaving this treatment.</span>
                    </div>
                    <button className="pill" type="button" onClick={() => addSectionMedicineRow(secIndex)}>+ Add Medicine</button>
                  </div>
                  {sec.medicines.map((row, medIndex) => (
                    <div className="treatment-medicine-row" key={medIndex}>
                      <MedicineSearchInput
                        index={medIndex}
                        value={row.medicine}
                        catalog={medicineCatalog}
                        onChange={(value) => updateSectionMedicine(secIndex, medIndex, 'medicine', value)}
                        onSelect={(medicine) => selectSectionMedicine(secIndex, medIndex, medicine)}
                        onAdd={() => addSectionMedicineToCatalog(secIndex, medIndex)}
                      />
                      <label className="field-block">
                        <span>Dose</span>
                        <input className="lead-input" value={row.dose} onChange={(event) => updateSectionMedicine(secIndex, medIndex, 'dose', event.target.value)} placeholder="Dose" />
                      </label>
                      <label className="field-block">
                        <span>Timing</span>
                        <input className="lead-input" value={row.timing} onChange={(event) => updateSectionMedicine(secIndex, medIndex, 'timing', event.target.value)} placeholder="After meals" />
                      </label>
                      <button className="icon-btn" type="button" onClick={() => removeSectionMedicineRow(secIndex, medIndex)} aria-label={`Remove medicine ${medIndex + 1}`}>x</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="section-adder-row full-field">
            <button className="add-section-btn" type="button" onClick={addTreatmentSection}>
              + Add Another Service Section
            </button>
          </div>

          <datalist id="treatment-service-options">
            {[...new Set([...SERVICE_OPTIONS, ...pastTreatmentOptions.map((option) => option.service)].filter(Boolean))].map((option) => <option key={option} value={option} />)}
          </datalist>
        </JourneyModal>
      )}

      {stageModal === 'diet' && (
        <DietPlanModal
          client={selectedClient}
          clientRecord={selectedClientRecord}
          dietPlanForm={dietPlanForm}
          setDietPlanForm={setDietPlanForm}
          onClose={() => setStageModal('')}
          onSave={saveDietPlan}
          saveLabel={journey.diet ? 'Update Diet Plan' : 'Save Diet Plan'}
          dietTemplates={dietTemplates}
          dietTemplateName={dietTemplateName}
          setDietTemplateName={setDietTemplateName}
          saveDietTemplate={saveDietTemplate}
          applyDietTemplate={applyDietTemplate}
          applyClinicalDietPreset={applyClinicalDietPreset}
          selectedDietPreset={selectedDietPreset}
          addQuickMealSlot={addQuickMealSlot}
          updateDietMeal={updateDietMeal}
          duplicateDietMeal={duplicateDietMeal}
          moveDietMeal={moveDietMeal}
          removeDietMeal={removeDietMeal}
          appendDietGuideline={appendDietGuideline}
          openDietPdf={() => openDietPdf(dietPlanForm)}
          copyDietForWhatsApp={() => copyDietForWhatsApp(dietPlanForm)}
          toastMessage={dietToastMessage}
        />
      )}

      {stageModal === 'billing' && <JourneyModal title="Add Payment" client={selectedClient} onClose={() => setStageModal('')} onSave={savePayment} saveLabel="Save Payment"><div className="quick-preset-row">{PAYMENT_AMOUNTS.map((amount) => <button className="pill" type="button" key={amount} onClick={() => setPaymentForm((value) => ({ ...value, amount, paidAmount: value.status === 'Paid' ? amount : value.paidAmount, pendingAmount: calculatePaymentPending(amount, value.status === 'Paid' ? amount : value.paidAmount, value.status) }))}>Rs {amount}</button>)}</div><label className="field-block"><span>Invoice</span><input className="lead-input" value={paymentForm.invoice} readOnly /></label><label className="field-block"><span>Total Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((value) => ({ ...value, amount: event.target.value, paidAmount: value.status === 'Paid' ? event.target.value : value.paidAmount, pendingAmount: calculatePaymentPending(event.target.value, value.status === 'Paid' ? event.target.value : value.paidAmount, value.status) }))} placeholder="0" /></label><label className="field-block"><span>Paid Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.paidAmount} onChange={(event) => setPaymentForm((value) => ({ ...value, paidAmount: event.target.value, pendingAmount: calculatePaymentPending(value.amount, event.target.value, value.status) }))} placeholder="0" /></label><label className="field-block"><span>Pending Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.pendingAmount} readOnly placeholder="Auto calculated" /></label><label className="field-block"><span>Status</span><select className="lead-input" value={paymentForm.status} onChange={(event) => setPaymentForm((value) => { const paidAmount = event.target.value === 'Paid' ? value.amount : event.target.value === 'Pending' ? '' : value.paidAmount; return { ...value, status: event.target.value, paidAmount, pendingAmount: calculatePaymentPending(value.amount, paidAmount, event.target.value) }; })}><option>Paid</option><option>Partial</option><option>Pending</option></select></label><label className="field-block"><span>Paid On</span><input className="lead-input" type="date" value={paymentForm.paidOn} onChange={(event) => setPaymentForm((value) => ({ ...value, paidOn: event.target.value }))} /></label></JourneyModal>}

      {stageModal === 'followup' && <JourneyModal title="Schedule Next Follow-up" client={selectedClient} onClose={() => setStageModal('')} onSave={saveFollowup} saveLabel="Save Follow-up"><div className="quick-preset-row"><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(7) }))}>After 7 days</button><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(15) }))}>After 15 days</button><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(30) }))}>After 30 days</button></div><label className="field-block"><span>Follow-up Date</span><input className="lead-input" type="date" value={followupForm.date} onChange={(event) => setFollowupForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Follow-up Time</span><input className="lead-input" type="time" value={followupForm.time} onChange={(event) => setFollowupForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block full-field"><span>Follow-up Notes</span><textarea className="lead-input" rows="3" value={followupForm.notes} onChange={(event) => setFollowupForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Reason, instructions, or reminder note..." /></label><label className="field-block"><span>Status</span><select className="lead-input" value={followupForm.status} onChange={(event) => setFollowupForm((value) => ({ ...value, status: event.target.value }))}><option>Confirmed</option><option>Pending</option></select></label></JourneyModal>}

      {pregnancyHistoryOpen && <JourneyModal title="Add Pregnancy / Garbhsanskar History" client={selectedClient} onClose={() => setPregnancyHistoryOpen(false)} onSave={savePregnancyHistory} saveLabel="Save History" saveDisabled={!pregnancyHistoryForm.gynecAdvice.trim() && !pregnancyHistoryForm.garbhsanskarAdvice.trim()}><div className="action-note full-field"><strong>Visit-wise clinical note.</strong> This entry will remain linked to the selected journey date and will also appear in the patient's complete pregnancy history.</div><label className="field-block"><span>Note Date</span><input className="lead-input" type="date" value={pregnancyHistoryForm.date} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Pregnancy Week / Month</span><input className="lead-input" value={pregnancyHistoryForm.pregnancyStage} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, pregnancyStage: event.target.value }))} placeholder="e.g. Week 18 or 5th month" /></label><label className="field-block full-field"><span>Gynec Doctor Name</span><input className="lead-input" value={pregnancyHistoryForm.gynecName} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, gynecName: event.target.value }))} placeholder="e.g. Dr. Shah" /></label><label className="field-block full-field"><span>What did the gynec advise? *</span><textarea className="lead-input" rows="4" value={pregnancyHistoryForm.gynecAdvice} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, gynecAdvice: event.target.value }))} placeholder="Growth, precautions, diet, activity, or other advice shared by the gynec..." /></label><label className="field-block"><span>Reports / Tests Advised</span><textarea className="lead-input" rows="3" value={pregnancyHistoryForm.tests} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, tests: event.target.value }))} placeholder="e.g. Anomaly scan in week 20" /></label><label className="field-block"><span>Medicines / Supplements</span><textarea className="lead-input" rows="3" value={pregnancyHistoryForm.medicines} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, medicines: event.target.value }))} placeholder="e.g. Continue iron and calcium" /></label><label className="field-block full-field"><span>Garbhsanskar Plan / Instructions *</span><textarea className="lead-input" rows="4" value={pregnancyHistoryForm.garbhsanskarAdvice} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, garbhsanskarAdvice: event.target.value }))} placeholder="Meditation, breathing exercise, prenatal yoga, diet, music, or daily routine..." /></label><label className="field-block"><span>Next Follow-up</span><input className="lead-input" type="date" value={pregnancyHistoryForm.nextFollowup} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, nextFollowup: event.target.value }))} /></label></JourneyModal>}

      {consultationOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConsultationOpen(false)}>
          <div className="modal-shell consultation-modal" role="dialog" aria-modal="true" aria-label="Doctor Consultation" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Doctor Consultation</h2>
                <p>For patient: {selectedClient}</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setConsultationOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              <div className="section-adder-row full-field">
                <button className="add-section-btn" type="button" onClick={addConsultationSection}>
                  + Add Service Section
                </button>
              </div>

              {consultationSections.map((sec, secIndex) => (
                <div className="service-section-box full-field" key={sec.id || secIndex}>
                  <div className="service-section-header">
                    <div className="service-section-title-group">
                      <span className="service-badge">Section #{secIndex + 1}</span>
                      <label className="service-input-label">
                        <span>Service:</span>
                        <input
                          className="lead-input service-name-input"
                          list="consultation-service-options"
                          value={sec.service}
                          onChange={(e) => updateConsultationSection(secIndex, 'service', e.target.value)}
                          placeholder="e.g. Consultation, Skin, Hair..."
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    {consultationSections.length > 1 && (
                      <button
                        className="danger-subtle-btn"
                        type="button"
                        onClick={() => removeConsultationSection(secIndex)}
                        title="Remove this service section"
                      >
                        ✕ Remove Section
                      </button>
                    )}
                  </div>

                  <div className="quick-preset-row">
                    {QUICK_CONSULTATIONS.map((preset) => (
                      <button
                        className="pill"
                        type="button"
                        key={preset.label}
                        onClick={() => applyQuickConsultationToSection(secIndex, preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="consultation-template-tools">
                    <label className="field-block">
                      <span>Use Template</span>
                      <select
                        className="lead-input"
                        value={secIndex === 0 ? selectedConsultationTemplate : ''}
                        onChange={(event) => {
                          if (secIndex === 0) setSelectedConsultationTemplate(event.target.value);
                          applyConsultationTemplateToSection(secIndex, event.target.value);
                        }}
                      >
                        <option value="">{consultationTemplates.length ? 'Select consultation template...' : 'No templates saved yet'}</option>
                        {consultationTemplates.map((template, index) => (
                          <option key={`${template.name}-${index}`} value={index}>{template.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Template Name</span>
                      <input
                        className="lead-input"
                        value={consultationTemplateName}
                        onChange={(event) => setConsultationTemplateName(event.target.value)}
                        placeholder="e.g. Diabetes Follow-up"
                      />
                    </label>
                    <button
                      className="pill"
                      type="button"
                      disabled={!consultationTemplateName.trim()}
                      onClick={saveConsultationTemplate}
                    >
                      Save Template
                    </button>
                  </div>

                  <div className="detail-grid">
                    <ClinicalAutocompleteTextarea
                      label="Presenting Complaints"
                      rows="4"
                      value={sec.complaint}
                      options={consultationSuggestions.complaint}
                      onChange={(complaint) => updateConsultationSection(secIndex, 'complaint', complaint)}
                    />
                    <ClinicalAutocompleteTextarea
                      label="History & Examination"
                      rows="5"
                      value={sec.notes}
                      options={consultationSuggestions.notes}
                      onChange={(notes) => updateConsultationSection(secIndex, 'notes', notes)}
                    />
                    <SearchablePresetInput
                      label="Vitals"
                      value={sec.vitals}
                      options={VITAL_OPTIONS}
                      onChange={(value) => updateConsultationSection(secIndex, 'vitals', value)}
                      placeholder="Search or enter measured vitals"
                    />
                    <SearchablePresetInput
                      label="Diagnosis"
                      value={sec.diagnosis}
                      options={DIAGNOSIS_OPTIONS}
                      onChange={(value) => updateConsultationSection(secIndex, 'diagnosis', value)}
                      placeholder="Type 1-2 keywords, e.g. diabetes"
                    />
                    <label className="field-block full-field">
                      <span>Investigation</span>
                      <textarea
                        className="lead-input"
                        rows="2"
                        value={sec.investigation ?? ''}
                        onChange={(event) => updateConsultationSection(secIndex, 'investigation', event.target.value)}
                        placeholder="Optional investigation, lab test, imaging, report, or any note..."
                      />
                    </label>
                    <div className="doctor-note-builder full-field">
                      <SearchablePresetInput
                        label="Doctor Notes"
                        value={sectionDoctorNoteChoices[secIndex] || ''}
                        options={[...NOTE_OPTIONS, ...customDoctorNotes]}
                        onChange={(val) => setSectionDoctorNoteChoices((prev) => ({ ...prev, [secIndex]: val }))}
                        onSelect={(note) => addDoctorNoteToSection(secIndex, note)}
                        onCommit={(note) => addDoctorNoteToSection(secIndex, note)}
                        placeholder="Search or type a new doctor note..."
                        helperText="Multiple notes select કરો અથવા નવી note લખીને Add New/Enter દબાવો."
                        action={
                          <button
                            className="pill symptom-add-button"
                            type="button"
                            onClick={() => addDoctorNoteToSection(secIndex)}
                            disabled={!String(sectionDoctorNoteChoices[secIndex] || '').trim()}
                          >
                            + Add New
                          </button>
                        }
                      />
                      <div className="consultation-chips">
                        {String(sec.doctorNotes ?? '').split('\n').map((item) => item.trim()).filter(Boolean).map((note) => (
                          <button
                            className="tag symptom-chip"
                            type="button"
                            key={note}
                            onClick={() => removeDoctorNoteFromSection(secIndex, note)}
                          >
                            {note} x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="section-adder-row full-field">
                <button className="add-section-btn" type="button" onClick={addConsultationSection}>
                  + Add Another Service Section
                </button>
              </div>

              <datalist id="consultation-service-options">
                {[...new Set([...SERVICE_OPTIONS, ...pastTreatmentOptions.map((option) => option.service)].filter(Boolean))].map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setConsultationOpen(false)}>Cancel</button>
              <button className="pill primary-action" type="button" onClick={saveConsultation}>Complete Consultation</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function JourneyModal({ title, client, children, onClose, onSave, saveLabel, saveDisabled = false, shellClassName = 'modal-small' }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className={`modal-shell ${shellClassName}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>{title}</h2><p>For patient: {client}</p></div><button className="icon-btn" type="button" onClick={onClose} aria-label="Close modal">x</button></div><div className="modal-body detail-grid">{children}</div><div className="modal-actions"><button className="pill" type="button" onClick={onClose}>Cancel</button><button className="pill primary-action" type="button" onClick={onSave} disabled={saveDisabled}>{saveLabel}</button></div></div></div>;
}

function DietPlanModal({
  client,
  clientRecord,
  dietPlanForm,
  setDietPlanForm,
  onClose,
  onSave,
  saveLabel,
  dietTemplates,
  dietTemplateName,
  setDietTemplateName,
  saveDietTemplate,
  applyDietTemplate,
  applyClinicalDietPreset,
  selectedDietPreset,
  addQuickMealSlot,
  updateDietMeal,
  duplicateDietMeal,
  moveDietMeal,
  removeDietMeal,
  appendDietGuideline,
  openDietPdf,
  copyDietForWhatsApp,
  toastMessage,
}) {
  const initials = String(client || 'P').trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const phone = clientMobile(clientRecord);
  const id = clientId(clientRecord);
  const ageGender = patientAgeGender(clientRecord);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-shell diet-builder-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Diet Plan Builder"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="diet-builder-head">
          <div className="diet-builder-head-left">
            <div className="diet-builder-avatar">{initials}</div>
            <div className="diet-builder-title">
              <h2>{saveLabel.includes('Update') ? 'Edit Diet Plan' : 'Create Personalized Diet Plan'}</h2>
              <div className="diet-builder-patient-meta">
                <span className="patient-name-tag">{client || 'Selected Patient'}</span>
                {id && <span className="patient-id-tag">#{id.replace(/^#/, '')}</span>}
                {phone && <span>📞 {phone}</span>}
                {ageGender && <span>• {ageGender}</span>}
                <span>• Date: {dietPlanForm.planDate || currentSlot().date}</span>
              </div>
            </div>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Scrollable Body */}
        <div className="diet-builder-body">
          {/* Section 1: Clinical Presets & Saved Templates */}
          <div className="diet-section-card">
            <div className="diet-section-header">
              <div>
                <h3>⚡ Clinical Protocols & Quick Presets</h3>
                <p>One-tap load scientifically curated Ayurvedic nutrition frameworks for instant meal scheduling.</p>
              </div>
              {toastMessage && <div className="diet-toast-msg">✨ {toastMessage}</div>}
            </div>

            <div className="diet-presets-bar">
              {CLINICAL_DIET_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`diet-preset-chip ${selectedDietPreset === preset.id ? 'active' : ''}`}
                  onClick={() => applyClinicalDietPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="diet-template-tools">
              <label className="field-block">
                <span>Use Saved Diet Template</span>
                <select className="lead-input" defaultValue="" onChange={(e) => applyDietTemplate(e.target.value)}>
                  <option value="">{dietTemplates.length ? 'Select from saved diet templates...' : 'No saved templates yet'}</option>
                  {dietTemplates.map((t, idx) => (
                    <option key={`${t.name}-${idx}`} value={idx}>{t.name} ({t.goal || 'General'})</option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>Save Current Plan As Template</span>
                <input
                  className="lead-input"
                  value={dietTemplateName}
                  onChange={(e) => setDietTemplateName(e.target.value)}
                  placeholder="e.g. 30-Day Garbh Sanskar Nutrition"
                />
              </label>
              <button
                className="pill"
                type="button"
                onClick={saveDietTemplate}
                disabled={!dietTemplateName.trim()}
              >
                + Save Template
              </button>
            </div>
          </div>

          {/* Section 2: Plan Parameters & Targets */}
          <div className="diet-section-card">
            <div className="diet-section-header">
              <div>
                <h3>📋 Plan Overview & Targets</h3>
                <p>Define clinical service, primary goal, timeframe, and daily nutritional benchmarks.</p>
              </div>
            </div>

            <div className="diet-overview-grid">
              <label className="field-block">
                <span>Service Type</span>
                <select
                  className="lead-input"
                  value={dietPlanForm.service}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, service: e.target.value }))}
                >
                  {SERVICE_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                </select>
              </label>

              <label className="field-block">
                <span>Clinical Goal</span>
                <input
                  className="lead-input"
                  list="diet-goal-presets-list"
                  value={dietPlanForm.goal}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, goal: e.target.value }))}
                  placeholder="e.g. Fat loss"
                />
                <datalist id="diet-goal-presets-list">
                  {DIET_GOAL_PRESETS.map((g) => <option key={g} value={g} />)}
                </datalist>
              </label>

              <label className="field-block">
                <span>Plan Duration</span>
                <select
                  className="lead-input"
                  value={dietPlanForm.duration}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, duration: e.target.value }))}
                >
                  {DURATION_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                </select>
              </label>

              <label className="field-block">
                <span>Start Date</span>
                <input
                  className="lead-input"
                  type="date"
                  value={dietPlanForm.planDate}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, planDate: e.target.value }))}
                />
              </label>
            </div>

            <div className="diet-targets-grid">
              <label className="field-block">
                <span>Week / Phase</span>
                <input
                  className="lead-input"
                  value={dietPlanForm.weekLabel}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, weekLabel: e.target.value }))}
                  placeholder="e.g. Phase 1 - Detox"
                />
              </label>

              <label className="field-block">
                <span>Daily Calories Target</span>
                <input
                  className="lead-input"
                  value={dietPlanForm.calories}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, calories: e.target.value }))}
                  placeholder="e.g. 1200-1400 kcal"
                />
              </label>

              <label className="field-block">
                <span>Daily Water Intake</span>
                <input
                  className="lead-input"
                  value={dietPlanForm.water}
                  onChange={(e) => setDietPlanForm((p) => ({ ...p, water: e.target.value }))}
                  placeholder="e.g. 2.5 - 3.0 Liters"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Time-wise Meal Schedule */}
          <div className="diet-section-card">
            <div className="diet-section-header">
              <div>
                <h3>🍽️ Daily Meal Schedule ({dietPlanForm.meals?.length || 0} Meals)</h3>
                <p>Customize time-wise nutrition slots. Use quick slot buttons below or add custom meals.</p>
              </div>
            </div>

            {/* Quick Meal Slot Adders */}
            <div className="diet-quick-meals-bar">
              <span>Quick Add Slot:</span>
              {QUICK_MEAL_SLOTS.map((slot) => (
                <button
                  key={slot.meal}
                  type="button"
                  className="diet-quick-slot-btn"
                  onClick={() => addQuickMealSlot(slot)}
                  title={`Add ${slot.meal} at ${slot.time}`}
                >
                  + {slot.meal} ({slot.time})
                </button>
              ))}
              <button
                type="button"
                className="diet-quick-slot-btn custom-btn"
                onClick={() => addQuickMealSlot({ time: '', meal: '', food: '', notes: '' })}
              >
                + Custom Meal Row
              </button>
            </div>

            {/* Meal Cards List */}
            <div className="diet-meal-cards-list">
              {dietPlanForm.meals.map((meal, index) => (
                <div className="diet-meal-card" key={index}>
                  <div className="diet-meal-card-head">
                    <div className="diet-meal-card-head-left">
                      <span className="diet-meal-slot-badge">#{index + 1}</span>

                      <div className="diet-time-field">
                        <input
                          className="lead-input"
                          type="time"
                          value={meal.time}
                          onChange={(e) => updateDietMeal(index, 'time', e.target.value)}
                          title="Meal timing"
                        />
                      </div>

                      <div className="diet-meal-name-field">
                        <input
                          className="lead-input"
                          list="common-meal-names-list"
                          value={meal.meal}
                          onChange={(e) => updateDietMeal(index, 'meal', e.target.value)}
                          placeholder="Meal Name (e.g. Breakfast)"
                        />
                      </div>
                    </div>

                    <div className="diet-meal-card-actions">
                      <button
                        className="diet-meal-action-btn"
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveDietMeal(index, -1)}
                        title="Move meal up"
                        aria-label="Move meal up"
                      >
                        ↑
                      </button>
                      <button
                        className="diet-meal-action-btn"
                        type="button"
                        disabled={index === dietPlanForm.meals.length - 1}
                        onClick={() => moveDietMeal(index, 1)}
                        title="Move meal down"
                        aria-label="Move meal down"
                      >
                        ↓
                      </button>
                      <button
                        className="diet-meal-action-btn"
                        type="button"
                        onClick={() => duplicateDietMeal(index)}
                        title="Duplicate meal"
                        aria-label="Duplicate meal"
                      >
                        ⎘
                      </button>
                      <button
                        className="diet-meal-action-btn danger"
                        type="button"
                        disabled={dietPlanForm.meals.length === 1}
                        onClick={() => removeDietMeal(index)}
                        title="Remove this meal"
                        aria-label="Remove meal"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="diet-meal-card-body">
                    <div>
                      <span className="diet-meal-col-label">Food Items & Recipe / Quantity *</span>
                      <textarea
                        className="diet-textarea"
                        rows={2}
                        value={meal.food}
                        onChange={(e) => updateDietMeal(index, 'food', e.target.value)}
                        placeholder="e.g. 1 bowl Moong dal chilla + green mint chutney + 1 cup warm water..."
                      />
                    </div>

                    <div>
                      <span className="diet-meal-col-label">Instructions / Notes / Precautions</span>
                      <textarea
                        className="diet-textarea"
                        rows={2}
                        value={meal.notes}
                        onChange={(e) => updateDietMeal(index, 'notes', e.target.value)}
                        placeholder="e.g. Drink warm water 30 mins later; avoid cold drinks..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <datalist id="common-meal-names-list">
              {COMMON_MEAL_NAMES.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>

          {/* Section 4: Ayurvedic Guidelines & Instructions */}
          <div className="diet-section-card">
            <div className="diet-section-header">
              <div>
                <h3>🌿 Patient Guidelines & Ayurvedic Pathya / Apathya (Do's & Don'ts)</h3>
                <p>Click any guideline chip below to quickly append it to patient instructions:</p>
              </div>
            </div>

            <div className="diet-guidelines-bar">
              {AYURVEDIC_GUIDELINES.map((rule) => (
                <button
                  key={rule}
                  type="button"
                  className="diet-guideline-chip"
                  onClick={() => appendDietGuideline(rule)}
                  title="Click to add to instructions"
                >
                  + {rule}
                </button>
              ))}
            </div>

            <label className="field-block full-field">
              <span className="diet-meal-col-label">Complete Dietary Instructions for Patient</span>
              <textarea
                className="diet-instructions-area"
                rows={4}
                value={dietPlanForm.instructions}
                onChange={(e) => setDietPlanForm((p) => ({ ...p, instructions: e.target.value }))}
                placeholder="Additional instructions, clinical dos and don'ts, or follow-up notes..."
              />
            </label>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="diet-builder-foot">
          <div className="diet-builder-foot-left">
            <button className="pill" type="button" onClick={openDietPdf}>
              🖨️ Preview & Print PDF
            </button>
            <button className="pill" type="button" onClick={copyDietForWhatsApp}>
              📲 Copy for WhatsApp
            </button>
          </div>

          <div className="diet-builder-foot-right">
            <button className="pill" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="pill primary-action"
              type="button"
              onClick={onSave}
              disabled={!dietPlanForm.goal.trim()}
            >
              ✓ {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

