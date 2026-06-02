/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutageReport, Patient } from '../types';

export function exportOutagesToExcel(reports: OutageReport[], patientsInZone: Patient[]) {
  // UTF-8 BOM representation to tell Microsoft Excel it's in Hebrew, Thai, or Japanese correctly
  const BOM = '\uFEFF';
  
  let csvContent = '';

  // 1. Title/Header section
  csvContent += 'รายงานบันทึกข้อมูไฟฟ้าดับและการช่วยเหลือผู้ป่วยเปราะบาง\r\n';
  csvContent += `พิมพ์รายงานเมื่อวันที่: ${new Date().toLocaleString('th-TH')}\r\n`;
  csvContent += '\r\n';

  // 2. Outages table
  csvContent += 'ตารางที่ 1: รายการแจ้งเหตุไฟฟ้าดับ/ภัยพิบัติในพื้นที่\r\n';
  csvContent += 'ลำดับ,เบอร์ติดต่อผู้แจ้ง,สถานที่จุดไฟดับ,พิกัด Lat,พิกัด Lng,รัศมีผลกระทบ (กิโลเมตร),สถานะปัจจุบัน,เวลาได้รับแจ้ง,รายละเอียดภัยพิบัติ\r\n';
  
  reports.forEach((r, idx) => {
    const row = [
      idx + 1,
      r.reporter_phone,
      `"${r.address.replace(/"/g, '""')}"`,
      r.latitude,
      r.longitude,
      r.radius,
      r.status === 'PENDING' ? 'กำลังดำเนินการแก้ไข/ไฟดับรุนแรง' : 'แก้ไขเรียบร้อยแล้ว/ไฟปกติ',
      `"${new Date(r.report_time).toLocaleString('th-TH')}"`,
      `"${(r.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ];
    csvContent += row.join(',') + '\r\n';
  });

  csvContent += '\r\n\r\n';

  // 3. Affected patients table
  csvContent += 'ตารางที่ 2: ทะเบียนรายชื่อผู้ป่วยเปราะบางในพื้นที่ประสบภัย (OUTAGE_AFFECTED)\r\n';
  csvContent += 'ลำดับ,ชื่อผู้ป่วย,เบอร์ติดต่อ,อุปกรณ์ทางการแพทย์พึ่งพิง,ระดับความเร่งด่วน,พิกัด Lat,พิกัด Lng,ที่อยู่พยาบาล,บันทึกความช่วยเหลือ\r\n';

  patientsInZone.forEach((p, idx) => {
    const row = [
      idx + 1,
      `"${p.name}"`,
      p.phone,
      `"${p.equipment}"`,
      p.priority,
      p.latitude,
      p.longitude,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${(p.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ];
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LifeLine_ElectriGuard_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
