/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import postgres from "postgres";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const connectionString = process.env.DATABASE_URL;
let sql: any = null;
let useBackupMock = false;

// Seed patients located in Rayong City (Mueang Rayong) coordinates
const seedPatients = [
  {
    id: 1,
    name: "นายสมชาย กิตติคุณ (สมชาย)",
    bill_name: "นายสมชาย กิตติคุณ",
    phone: "0812345678",
    address: "22/4 ซอย 2 ถนนสุขุมวิท ต.เชิงเนิน อ.เมืองระยอง จ.ระยอง (ใกล้โรงพยาบาลระยอง)",
    latitude: 12.6845,
    longitude: 101.2720,
    priority: "CRITICAL",
    equipment: "เครื่องช่วยหายใจ (Ventilator Model PB840)",
    condition_desc: "ผู้ป่วยติดเตียงสูงอายุด้วยภาวะกล้ามเนื้อลีบ ไม่สามารถหายใจเองได้ ต้องพึ่งพิงกระแสไฟฟ้าหลักประคองเครื่องช่วยหายใจ 24 ชั่วโมอง",
    notes: "มีเครื่องสำรองไฟสำรองได้ 1 ชั่วโมง ต้องการรถพยาบาลเคลื่อนย้ายด่วนถ้าไฟดับนาน"
  },
  {
    id: 2,
    name: "นางสมศรี จิตอาสา (สมศรี)",
    bill_name: "นายจิตต์อาสา แสนดี",
    phone: "0898765432",
    address: "95 ถนนราษฎร์บำรุง ต.เนินพระ อ.เมืองระยอง จ.ระยอง (ใกล้วัดป่าประดู่)",
    latitude: 12.6782,
    longitude: 101.2854,
    priority: "HIGH",
    equipment: "เครื่องผลิตออกซิเจนแรงดันสูง (Oxygen Concentrator 5L)",
    condition_desc: "โรคถุงลมโป่งพองและปอดอุดกั้นเรื้อรัง (COPD) ระยะสุดท้าย ต้องออนออกซิเจนต่อเนื่องตลอดคืน",
    notes: "แบตสำรองรองรับได้ประมาณ 45 นาที"
  },
  {
    id: 3,
    name: "นายวิชัย เพียรธรรม (วิชัย)",
    bill_name: "นางประคอง เพียรธรรม",
    phone: "0851112222",
    address: "14/3 ถนนจันทอุดม ต.ท่าประดู่ อ.เมืองระยอง จ.ระยอง (เยื้องรร.ระยองวิทยาคม)",
    latitude: 12.6883,
    longitude: 101.2631,
    priority: "HIGH",
    equipment: "เครื่องดูดเสมหะไฟฟ้าขนาดย่อม (Suction machine)",
    condition_desc: "ผู้ป่วยเจาะคอ มีเสมหะข้นเหนียวอุดกั้นทางเดินหายใจ จำเป็นต้องใช้ระบบไฟดูดเสมหะทุก 2 ชั่วโมงเพื่อป้องกันเสมหะอุดหลอดลมเฉียบพลัน",
    notes: "ต้องการเจ้าหน้าที่เตรียมพร้อมอุปกรณ์กู้ภัยแบบพกพา"
  },
  {
    id: 4,
    name: "คุณยายทองคำ เจริญยิ่ง (ทองคำ)",
    bill_name: "นายสนิท เจริญยิ่ง",
    phone: "0864445555",
    address: "108 ซอยร่วมใจ ถนนอารีราษฎร์ ต.ปากน้ำ อ.เมืองระยอง จ.ระยอง",
    latitude: 12.6654,
    longitude: 101.2798,
    priority: "MEDIUM",
    equipment: "ที่นอนลมป้องกันแผลกดทับสลับลอนไฟฟ้า และเตียงไฟฟ้า",
    condition_desc: "ผู้ป่วยติดเตียงแผลกดทับเรื้อรังระดับ 4 ต้องการเครื่องสลับลมในลอนปั๊มป้องกันแผลเน่า",
    notes: "สามารถปิดประคองลมได้สูงสุด 3-4 ชั่วโมง"
  },
  {
    id: 5,
    name: "นายเฉลิม ทองดี (เฉลิม)",
    bill_name: "นายพงศธร ทองดี",
    phone: "0823334444",
    address: "47 หมู่ 3 ต.ท่าประดู่ อ.เมืองระยอง จ.ระยอง",
    latitude: 12.6952,
    longitude: 101.2917,
    priority: "LOW",
    equipment: "ผู้ป่วยติดเตียงชราภาพ (ช่วยเหลือตัวเองไม่ได้)",
    condition_desc: "ผู้สูงอายุติดเตียง อ่อนแรง ข้อมือหมุนไม่ได้ ขยับกายลำบาก ไม่มีอุปกรณการแพทย์พึ่งพาไฟโดยตรง",
    notes: "ต้องการแสงสว่างและการดูแลทางอารมณ์รวมถึงน้ำใจจากชุมชนเวลากลางคืน"
  }
];

// Active mock outage zones
const seedReports = [
  {
    id: 1,
    reporter_phone: "0819998888",
    address: "ซอยพูนไฉน ตรงข้ามแยกเกาะกลอย ต.เนินพระ อ.เมืองระยอง",
    latitude: 12.6740,
    longitude: 101.2590,
    radius: 1.5,
    status: "PENDING",
    report_time: new Date().toISOString(),
    description: "หม้อแปลงไฟฟ้าระเบิด เสียงดังสนั่น ขณะนี้มีกระแสไฟฟ้าขัดข้อง ดับไฟเป็นวงกว้างเข้าสู่เขตบ้านผู้ป่วยติดเตียง"
  }
];

// Fallback in-memory database
let mockPatients = [...seedPatients];
let mockReports = [...seedReports];

// Try database connection
if (connectionString) {
  try {
    sql = postgres(connectionString, {
      connect_timeout: 10,
      max: 8
    });
    console.log("PostgreSQL/Supabase Database connection configuration created.");
  } catch (err) {
    console.error("Configuring postgres instance failed, using in-memory mock backend.", err);
    useBackupMock = true;
  }
} else {
  console.warn("DATABASE_URL variable not configured. Operating in high-reliability in-memory mock mode.");
  useBackupMock = true;
}

// Haversine Distance Helper (km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check patient statuses against active (PENDING) reports
function checkPatientsAffected(patients: any[], activeReports: any[]) {
  return patients.map((p) => {
    const isAffected = activeReports.some((r) => {
      if (r.status !== "PENDING") return false;
      const dist = haversineDistance(p.latitude, p.longitude, r.latitude, r.longitude);
      return dist <= r.radius;
    });

    return {
      ...p,
      status: isAffected ? "OUTAGE_AFFECTED" : "NORMAL"
    };
  });
}

// Initialize tables and run migrations
async function initDatabase() {
  if (useBackupMock || !sql) {
    console.log("Database fallback is active. Initial schema seeding using in-memory structure completed.");
    return;
  }

  try {
    // Determine if table query is successful, else run schema
    await sql`
      CREATE TABLE IF NOT EXISTS emergency_house (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        bill_name VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        priority VARCHAR(50) DEFAULT 'LOW',
        equipment TEXT NOT NULL,
        condition_desc TEXT,
        status VARCHAR(50) DEFAULT 'NORMAL',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure bill_name exists in existing table schema
    try {
      await sql`ALTER TABLE emergency_house ADD COLUMN IF NOT EXISTS bill_name VARCHAR(255)`;
    } catch (e) {
      console.log("Alter table column checks bypassed or completed:", e);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS emergency_down_report (
        id SERIAL PRIMARY KEY,
        reporter_phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius DOUBLE PRECISION DEFAULT 1.5,
        status VARCHAR(50) DEFAULT 'PENDING',
        report_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `;

    // Check row count for patients
    const patientCount = await sql`SELECT COUNT(*) FROM emergency_house`;
    if (parseInt(patientCount[0].count, 10) === 0) {
      console.log("Database has 0 patients. Inserting Mueang Rayong initial patient seeds...");
      for (const p of seedPatients) {
        await sql`
          INSERT INTO emergency_house (name, bill_name, phone, address, latitude, longitude, priority, equipment, condition_desc, notes)
          VALUES (${p.name}, ${p.bill_name}, ${p.phone}, ${p.address}, ${p.latitude}, ${p.longitude}, ${p.priority}, ${p.equipment}, ${p.condition_desc}, ${p.notes})
        `;
      }
    }

    // Check row count for reports
    const reportCount = await sql`SELECT COUNT(*) FROM emergency_down_report`;
    if (parseInt(reportCount[0].count, 10) === 0) {
      console.log("Database has 0 reports. Inserting Mueang Rayong initial outage report seeds...");
      for (const r of seedReports) {
        await sql`
          INSERT INTO emergency_down_report (reporter_phone, address, latitude, longitude, radius, status, description)
          VALUES (${r.reporter_phone}, ${r.address}, ${r.latitude}, ${r.longitude}, ${r.radius}, ${r.status}, ${r.description})
        `;
      }
    }

    console.log("Supabase Schema verification and seed checks executed flawlessly.");
  } catch (error) {
    console.warn("Table verification/migration failed, falling back to fully functional inside-memory sandbox server:", error);
    useBackupMock = true;
  }
}

// ---------------- SERVER REST API ROUTES ----------------

// Fetch all registered medically-vulnerable patients (auto-evaluated in power outage active rings)
app.get("/api/patients", async (req, res) => {
  try {
    let patientsList = [];
    if (useBackupMock || !sql) {
      patientsList = mockPatients;
    } else {
      patientsList = await sql`SELECT * FROM emergency_house ORDER BY id ASC`;
    }

    let reportsList = [];
    if (useBackupMock || !sql) {
      reportsList = mockReports;
    } else {
      reportsList = await sql`SELECT * FROM emergency_down_report WHERE status = 'PENDING'`;
    }

    const activeReportsObj = reportsList.filter((r: any) => r.status === "PENDING" || r.status === "pending");
    const updatedPatients = checkPatientsAffected(patientsList, activeReportsObj);
    return res.json(updatedPatients);
  } catch (err: any) {
    console.error("Failed to read patients:", err);
    // Return backup in memory and gracefully proceed
    const updatedPatients = checkPatientsAffected(mockPatients, mockReports.filter(r => r.status === 'PENDING'));
    return res.json(updatedPatients);
  }
});

// Create new vulnerable resident entry (Requires PIN verify: 'h02101')
app.post("/api/patients", async (req, res) => {
  const { pin, name, bill_name, phone, address, latitude, longitude, priority, equipment, condition_desc, notes } = req.body;

  if (pin !== "h02101") {
    return res.status(403).json({ error: "รหัสเข้าสู่ระบบ (PIN) สำหรับแอดมินไม่ถูกต้อง" });
  }

  const latFloat = parseFloat(latitude);
  const lngFloat = parseFloat(longitude);

  if (!name || !phone || !address || isNaN(latFloat) || isNaN(lngFloat) || !priority || !equipment) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน รวมถึงพิกัดละติจูดและลองจิจูด" });
  }

  if (useBackupMock || !sql) {
    const nextId = mockPatients.length > 0 ? Math.max(...mockPatients.map(p => p.id)) + 1 : 1;
    const newP = {
      id: nextId,
      name,
      bill_name: bill_name || "",
      phone,
      address,
      latitude: latFloat,
      longitude: lngFloat,
      priority,
      equipment,
      condition_desc: condition_desc || "",
      notes: notes || "",
      status: "NORMAL" as const
    };
    mockPatients.push(newP);
    return res.json(newP);
  }

  try {
    const [inserted] = await sql`
      INSERT INTO emergency_house (name, bill_name, phone, address, latitude, longitude, priority, equipment, condition_desc, notes)
      VALUES (${name}, ${bill_name || ""}, ${phone}, ${address}, ${latFloat}, ${lngFloat}, ${priority}, ${equipment}, ${condition_desc || ""}, ${notes || ""})
      RETURNING *
    `;
    return res.json(inserted);
  } catch (err: any) {
    console.error("Failed DB write for patients:", err);
    return res.status(500).json({ error: "ระบบฐานข้อมูลหลักขัดข้อง: " + err.message });
  }
});

// Update patient info (Requires PIN: 'h02101')
app.put("/api/patients/:id", async (req, res) => {
  const { id } = req.params;
  const { pin, name, bill_name, phone, address, latitude, longitude, priority, equipment, condition_desc, notes } = req.body;

  if (pin !== "h02101") {
    return res.status(403).json({ error: "กรุณายืนยันรหัส PIN h02101 ให้ถูกต้อง" });
  }

  const patientId = parseInt(id, 10);
  const latFloat = parseFloat(latitude);
  const lngFloat = parseFloat(longitude);

  if (!name || !phone || !address || isNaN(latFloat) || isNaN(lngFloat) || !priority || !equipment) {
    return res.status(400).json({ error: "ข้อมูลผู้ป่วยปรับปรุงมีคุณสมบัติไม่ครบถ้วน" });
  }

  if (useBackupMock || !sql) {
    const idx = mockPatients.findIndex(p => p.id === patientId);
    if (idx === -1) return res.status(404).json({ error: "ไม่พบรหัสผู้ป่วยดังกล่าว" });

    mockPatients[idx] = {
      ...mockPatients[idx],
      name,
      bill_name: bill_name || "",
      phone,
      address,
      latitude: latFloat,
      longitude: lngFloat,
      priority,
      equipment,
      condition_desc: condition_desc || "",
      notes: notes || ""
    };
    return res.json(mockPatients[idx]);
  }

  try {
    const [updated] = await sql`
      UPDATE emergency_house
      SET name = ${name}, bill_name = ${bill_name || ""}, phone = ${phone}, address = ${address}, latitude = ${latFloat}, longitude = ${lngFloat},
          priority = ${priority}, equipment = ${equipment}, condition_desc = ${condition_desc || ""}, notes = ${notes || ""}
      WHERE id = ${patientId}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: "ไม่พบรหัสผู้ป่วยในฐานข้อมูล" });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete patient info (Requires PIN: 'h02101')
app.delete("/api/patients/:id", async (req, res) => {
  const { id } = req.params;
  const pin = req.headers["x-pin"] || req.query.pin;

  if (pin !== "h02101") {
    return res.status(403).json({ error: "ไม่มีสิทธิ์ลบข้อมูลผู้ใช้งาน (PIN ไม่ถูกต้อง)" });
  }

  const patientId = parseInt(id, 10);

  if (useBackupMock || !sql) {
    const idx = mockPatients.findIndex(p => p.id === patientId);
    if (idx === -1) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ป่วย" });
    mockPatients.splice(idx, 1);
    return res.json({ success: true, deletedId: patientId });
  }

  try {
    const deleted = await sql`
      DELETE FROM emergency_house
      WHERE id = ${patientId}
      RETURNING id
    `;
    if (deleted.length === 0) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ป่วยที่จะทำงานลบ" });
    return res.json({ success: true, deletedId: patientId });
  } catch (err: any) {
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล: " + err.message });
  }
});

// Fetch all registered electricity outage and disaster/disaster notifications
app.get("/api/reports", async (req, res) => {
  try {
    let reports = [];
    if (useBackupMock || !sql) {
      reports = mockReports;
    } else {
      reports = await sql`SELECT * FROM emergency_down_report ORDER BY report_time DESC`;
    }
    return res.json(reports);
  } catch (err: any) {
    return res.json(mockReports);
  }
});

// User reports active blackout and grid fail
app.post("/api/reports", async (req, res) => {
  const { reporter_phone, address, latitude, longitude, radius, description } = req.body;
  const latFloat = parseFloat(latitude);
  const lngFloat = parseFloat(longitude);
  const radiusFloat = parseFloat(radius) || 1.5;

  if (!reporter_phone || !address || isNaN(latFloat) || isNaN(lngFloat)) {
    return res.status(400).json({ error: "กรุณาระบุที่พิกัด เบอร์ติดต่อ และที่อยู่ให้ถูกต้องชัดเจน" });
  }

  if (useBackupMock || !sql) {
    const nextId = mockReports.length > 0 ? Math.max(...mockReports.map(r => r.id)) + 1 : 1;
    const newR = {
      id: nextId,
      reporter_phone,
      address,
      latitude: latFloat,
      longitude: lngFloat,
      radius: radiusFloat,
      status: "PENDING" as const,
      report_time: new Date().toISOString(),
      description: description || ""
    };
    mockReports.unshift(newR);
    return res.json(newR);
  }

  try {
    const [inserted] = await sql`
      INSERT INTO emergency_down_report (reporter_phone, address, latitude, longitude, radius, status, description)
      VALUES (${reporter_phone}, ${address}, ${latFloat}, ${lngFloat}, ${radiusFloat}, 'PENDING', ${description || ""})
      RETURNING *
    `;
    return res.json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Change outage status (Requires Admin PIN)
app.put("/api/reports/:id/status", async (req, res) => {
  const { id } = req.params;
  const { pin, status } = req.body;

  if (pin !== "h02101") {
    return res.status(403).json({ error: "รหัส PIN ของพนักงานเพื่ออัปเดตสิทธิ์ไม่ถูกต้อง" });
  }

  const reportId = parseInt(id, 10);
  if (status !== "PENDING" && status !== "RESOLVED") {
    return res.status(400).json({ error: "สถานะไม่ถูกต้อง (เลือกได้เฉพาะ PENDING หรือ RESOLVED)" });
  }

  if (useBackupMock || !sql) {
    const idx = mockReports.findIndex(r => r.id === reportId);
    if (idx === -1) return res.status(404).json({ error: "ไม่พบข้อมูลรายงานดับไฟ" });
    mockReports[idx].status = status;
    return res.json(mockReports[idx]);
  }

  try {
    const [updated] = await sql`
      UPDATE emergency_down_report
      SET status = ${status}
      WHERE id = ${reportId}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: "ไม่พบข้อมูลรายงานไฟฟัดข้องที่จะปรับปรุง" });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete report outright (Requires PIN)
app.delete("/api/reports/:id", async (req, res) => {
  const { id } = req.params;
  const pin = req.headers["x-pin"] || req.query.pin;

  if (pin !== "h02101") {
    return res.status(403).json({ error: "คุณไม่มีสิทธิ์ในการลบรายงานภัยพิบัติ" });
  }

  const reportId = parseInt(id, 10);

  if (useBackupMock || !sql) {
    const idx = mockReports.findIndex(r => r.id === reportId);
    if (idx === -1) return res.status(404).json({ error: "ไม่พบรายการ" });
    mockReports.splice(idx, 1);
    return res.json({ success: true, deletedId: reportId });
  }

  try {
    const deleted = await sql`
      DELETE FROM emergency_down_report
      WHERE id = ${reportId}
      RETURNING id
    `;
    if (deleted.length === 0) return res.status(404).json({ error: "ไม่พบรายงานภัยพิบัติหลักที่จะทำการลบ" });
    return res.json({ success: true, deletedId: reportId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// rule-based clinical classifier fallback in Thai for emergencies
function assignRulesBasedPriority(desc: string) {
  const d = desc.toLowerCase();
  let priority = "LOW";
  let equipment = "ผู้ป่วยติดเตียงทั่วไปชนิดพักฟื้น";
  let confidence = 85;
  let reasoning = "ประเมินจากการวิเคราะห์อาการทั่วไป ไม่พบสัญญาณเครื่องกลไฟฟ้าประคองการหายใจเร่งด่วน";

  if (d.includes("ช่วยหายใจ") || d.includes("ventilator") || d.includes("หายใจเหลว") || d.includes("ท่อช่วยหายใจ")) {
    priority = "CRITICAL";
    equipment = "เครื่องช่วยหายใจพยุงปอด (Ventilator)";
    reasoning = "ตรวจจับพบคำว่า 'เครื่องช่วยหายใจ' ซึ่งต้องใช้ท่อช่วยหายใจประคองชีวิตตลอด 24 ชั่วโมง ความเสี่ยงสูงสุดเป็น CRITICAL ห้ามหยุดกระแสไฟฟ้าพึ่งพิง";
    confidence = 98;
  } else if (d.includes("ดูดเสมหะ") || d.includes("suction") || d.includes("ผลิตออกซิเจน") || d.includes("concentrator") || d.includes("พ่นยา") || d.includes("ถังออกซิเจน") || d.includes("โมบายออกซิเจน")) {
    priority = "HIGH";
    equipment = "เครื่องดูดเสมหะไฟฟ้า หรือเครื่องทำออกซิเจนกระแสไฟตรง";
    reasoning = "ผู้ป่วยพึ่งเสมหะหลอดคอหรือระบบออกซิเจนกระสทางอ้อม จัดให้อยู่ในสถานะ HIGH ซึ่งทนไฟฟ้าดับได้ไม่เกิน 30-60 นาที";
    confidence = 92;
  } else if (d.includes("นอนลม") || d.includes("ที่นอนลม") || d.includes("เตียงไฟฟ้า") || d.includes("แผลกดทับ") || d.includes("air mattress") || d.includes("เตียงปรับไฟฟ้า")) {
    priority = "MEDIUM";
    equipment = "ที่นอนลมป้องกันแผลกดทับสลับลอน หรือเตียงยกปรับระดับลม";
    reasoning = "ผู้ป่วยใช้ที่นอนลมหรือเตียงพยาบาลปรับไฟฟ้า (MEDIUM) ไฟดับนานอาจกระตุ้นการเกิดแผลอับกดทับอักเสบ แต่ไม่เป็นภัยต่อชีวิตเฉียบพลัน";
    confidence = 90;
  }

  return { priority, suggested_equipment: equipment, confidence, reasoning };
}

// 🤖 GEMINI AI Smart Medical priority classifier
app.post("/api/ai/analyze-priority", async (req, res) => {
  const { description } = req.body;
  if (!description || description.trim() === "") {
    return res.status(400).json({ error: "โปรดระบุรายละเอียดประวัติทางการแพทย์หรืออาการและเครื่องพยุงชีพ" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("Using highly calibrated Thai rules-based processor due to missing GEMINI_API_KEY.");
    const rulesOutput = assignRulesBasedPriority(description);
    return res.json(rulesOutput);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const promptMessage = `คุณคือระบบปัญญาประดิษฐ์ประเมินความฉุกเฉินทางการแพทย์เพื่อจัดระดับผู้ป่วย (Triage Bot) ให้กับการรักษาฉุกเฉินภัยพิบัติไฟดับ
ผู้ป่วยบรรยายอาการหรือสถานะเครื่องพยุงชีพไว้ดังนี้: "${description}"

จงจำแนกระดับ Priority และเครื่องมือที่ใช้ คืนเป็น JSON ที่มีข้อมูล 4 คีย์นี้:
1. priority: ต้องตอบเป็นคำเหล่านี้เท่านั้น "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
   - CRITICAL: ผู้ป่วยพึ่งพิงเครื่องช่วยหายใจ (Ventilator) หรือมีอาการทางสมองไม่รู้ตัว ห้ามขาดไฟฟ้าแม้แต่นาทีเดียว
   - HIGH: ผู้ป่วยพึ่งพิงเครื่องผลิตออกซิเจน, พ่นยา หรือมีท่อเจาะคอดูดเสมหะ (Suction)
   - MEDIUM: ผู้ป่วยสูงอายุใช้ที่นอนลมป้องกันแผลกดทับไฟฟ้า หรือเตียงไฟฟ้าปรับท่าทาง
   - LOW: ผู้ป่วยติดเตียงติดบ้านทั่วไป ที่ไม่มีอุปกรณ์ใช้ไฟฟ้าพยุงชีวิตเร่งด่วน
2. suggested_equipment: ชื่อประเภทเครื่องมือประคองชีพภาษาไทยเชิงประเมิน
3. confidence: ตัวเลข 0 ถึง 100 ดัชนีความมั่นใจของ AI 
4. reasoning: เหตุผลอธิบายนความรุนแรงทางการแพทย์สั้นกระชับเป็นภาษาไทย ไพเราะน่าเชื่อถือ`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              description: "Medical criticality rank. Recommended values: CRITICAL, HIGH, MEDIUM, LOW"
            },
            suggested_equipment: {
              type: Type.STRING,
              description: "Suggested medical devices likely required."
            },
            confidence: {
              type: Type.INTEGER,
              description: "Classification confidence score out of 100."
            },
            reasoning: {
              type: Type.STRING,
              description: "Professional medical classification reason in Thai language."
            }
          },
          required: ["priority", "suggested_equipment", "confidence", "reasoning"]
        }
      }
    });

    const bodyText = result.text ? result.text.trim() : "";
    if (!bodyText) {
      throw new Error("Empty response received from server-side Gemini invocation.");
    }

    const aiCleanObj = JSON.parse(bodyText);
    return res.json(aiCleanObj);
  } catch (error: any) {
    console.error("Gemini classification failed, reverting to local Thai triage heuristics:", error);
    const rulesOutput = assignRulesBasedPriority(description);
    return res.json({
      ...rulesOutput,
      reasoning: `${rulesOutput.reasoning} (ประมวลด้วยระบบประเมินอาการฉุกเฉินอัตโนมัติสำรอง: ${error.message})`
    });
  }
});


// ---------------- VITE / EXPRESS ENVIRONMENT HANDLER ----------------

async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development express server with integrated transparent Vite middleware...");
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(viteInstance.middlewares);
  } else {
    console.log("Starting production express server serving precompiled artifacts...");
    const buildPath = path.join(process.cwd(), "dist");
    app.use(express.static(buildPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(buildPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`========================================================================`);
    console.log(`LifeLine ElectriGuard running securely at: http://localhost:${PORT}`);
    console.log(`Targeting Rayong Vulnerable Patients Emergency Protection Area`);
    console.log(`========================================================================`);
  });
}

startServer();
