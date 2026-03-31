const axios = require('axios');
const jwt = require('jsonwebtoken');
const { google } = require('../config/environment');

const GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function getNormalizedPrivateKey() {
  return String(google.sheetsPrivateKey || '').replace(/\\n/g, '\n');
}

function isGoogleSheetsConfigured() {
  return Boolean(google.sheetsClientEmail && getNormalizedPrivateKey());
}

function normalizeSpreadsheetId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || text;
}

async function getGoogleAccessToken() {
  if (!isGoogleSheetsConfigured()) {
    throw new Error('Google Sheets no está configurado en el entorno');
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: google.sheetsClientEmail,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_OAUTH_URL,
      iat: now,
      exp: now + 3600,
    },
    getNormalizedPrivateKey(),
    { algorithm: 'RS256' }
  );

  const response = await axios.post(
    GOOGLE_OAUTH_URL,
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );

  return response.data.access_token;
}

async function sheetsRequest(method, path, data = null, params = null) {
  const accessToken = await getGoogleAccessToken();
  return axios({
    method,
    url: `${GOOGLE_SHEETS_API}${path}`,
    data,
    params,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

function rangeForSheet(sheetName, suffix = 'A1:ZZ') {
  return encodeURIComponent(`'${sheetName}'!${suffix}`);
}

function rowsToMatrix(columns, rows) {
  return [
    columns,
    ...(rows || []).map((row) => columns.map((column) => row?.[column] ?? '')),
  ];
}

async function getSpreadsheet(spreadsheetId) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  const response = await sheetsRequest('get', `/${normalizedId}`, null, {
    fields: 'spreadsheetId,properties.title,sheets.properties',
  });
  return response.data;
}

async function ensureSheet(spreadsheetId, sheetName) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  const spreadsheet = await getSpreadsheet(normalizedId);
  const exists = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === sheetName);
  if (exists) return spreadsheet;

  await sheetsRequest('post', `/${normalizedId}:batchUpdate`, {
    requests: [{ addSheet: { properties: { title: sheetName } } }],
  });

  return getSpreadsheet(normalizedId);
}

async function clearSheet(spreadsheetId, sheetName) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  await sheetsRequest('post', `/${normalizedId}/values/${rangeForSheet(sheetName)}:clear`, {});
}

async function updateSheet(spreadsheetId, sheetName, columns, rows) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  const values = rowsToMatrix(columns, rows);
  await sheetsRequest(
    'put',
    `/${normalizedId}/values/${rangeForSheet(sheetName, 'A1')}?valueInputOption=RAW`,
    { values }
  );
  return { writtenRows: Math.max(values.length - 1, 0) };
}

async function getSheetValues(spreadsheetId, sheetName) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  const response = await sheetsRequest('get', `/${normalizedId}/values/${rangeForSheet(sheetName)}`);
  return response.data.values || [];
}

async function appendRows(spreadsheetId, sheetName, values) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  if (!values.length) return { appendedRows: 0 };

  await sheetsRequest(
    'post',
    `/${normalizedId}/values/${rangeForSheet(sheetName, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values }
  );
  return { appendedRows: values.length };
}

function buildKeyFromRow(columns, row, keyColumns) {
  return keyColumns.map((column) => String(row?.[column] ?? '')).join('||');
}

function buildKeyFromValues(headerMap, values, keyColumns) {
  return keyColumns.map((column) => String(values[headerMap[column]] ?? '')).join('||');
}

async function appendUniqueRows(spreadsheetId, sheetName, columns, rows, keyColumns = []) {
  if (!rows?.length) return { appendedRows: 0 };

  const existing = await getSheetValues(spreadsheetId, sheetName);
  if (!existing.length) {
    await updateSheet(spreadsheetId, sheetName, columns, rows);
    return { appendedRows: rows.length, initialized: true };
  }

  const headers = existing[0] || [];
  if (headers.join('|') !== columns.join('|')) {
    await clearSheet(spreadsheetId, sheetName);
    await updateSheet(spreadsheetId, sheetName, columns, rows);
    return { appendedRows: rows.length, resetHeaders: true };
  }

  if (!keyColumns.length) {
    const values = rows.map((row) => columns.map((column) => row?.[column] ?? ''));
    return appendRows(spreadsheetId, sheetName, values);
  }

  const headerMap = headers.reduce((acc, header, index) => {
    acc[header] = index;
    return acc;
  }, {});
  const existingKeys = new Set(existing.slice(1).map((row) => buildKeyFromValues(headerMap, row, keyColumns)));
  const newRows = rows.filter((row) => !existingKeys.has(buildKeyFromRow(columns, row, keyColumns)));
  const values = newRows.map((row) => columns.map((column) => row?.[column] ?? ''));
  return appendRows(spreadsheetId, sheetName, values);
}

async function syncMasterSheet(spreadsheetId, masterSheet) {
  const normalizedId = normalizeSpreadsheetId(spreadsheetId);
  if (!normalizedId) {
    throw new Error('Falta spreadsheetId de Google Sheets');
  }

  const result = {
    spreadsheetId: normalizedId,
    tabs: [],
  };

  for (const tab of masterSheet?.tabs || []) {
    await ensureSheet(normalizedId, tab.name);
    let syncResult;

    if (tab.mode === 'overwrite') {
      await clearSheet(normalizedId, tab.name);
      syncResult = await updateSheet(normalizedId, tab.name, tab.columns || [], tab.rows || []);
    } else {
      syncResult = await appendUniqueRows(normalizedId, tab.name, tab.columns || [], tab.rows || [], tab.keyColumns || []);
    }

    result.tabs.push({
      name: tab.name,
      mode: tab.mode,
      rows: tab.rows?.length || 0,
      ...syncResult,
    });
  }

  return result;
}

module.exports = {
  isGoogleSheetsConfigured,
  normalizeSpreadsheetId,
  getSpreadsheet,
  syncMasterSheet,
};
