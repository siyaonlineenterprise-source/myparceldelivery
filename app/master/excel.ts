"use client";

import * as XLSX from "xlsx";

export type ExcelCell = string | number | boolean | null | undefined;

export function downloadExcelWorkbook(filename: string, rows: ExcelCell[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((cell) => cell ?? "")));
  const range = worksheet["!ref"];
  if (range) worksheet["!autofilter"] = { ref: range };
  worksheet["!cols"] = rows[0]?.map((_, columnIndex) => ({
    wch: Math.min(48, Math.max(12, ...rows.slice(0, 250).map((row) => String(row[columnIndex] ?? "").length + 2))),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Data");
  XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}
