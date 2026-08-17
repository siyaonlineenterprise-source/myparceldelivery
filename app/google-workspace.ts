type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type VendorFolderSet = {
  driveFolderId: string;
  packingFolderId: string;
  returnFolderId: string;
  claimsFolderId: string;
};

let cachedToken: { value: string; expiresAt: number; scope: string } | null = null;

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  if (raw) {
    try {
      return JSON.parse(raw) as ServiceAccountCredentials;
    } catch {
      throw new Error("Google Drive secure key invalid hai");
    }
  }
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const private_key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replaceAll("\\n", "\n");
  if (!client_email || !private_key) throw new Error("Google Drive secure connection pending hai");
  return { client_email, private_key };
}

function pemBytes(pem: string) {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function accessToken(scope: string) {
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const account = credentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: account.client_email,
    scope,
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Google authorization failed");
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(300, data.expires_in || 3600) * 1000,
    scope,
  };
  return data.access_token;
}

async function driveRequest(path: string, init: RequestInit = {}) {
  const token = await accessToken("https://www.googleapis.com/auth/drive");
  const response = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive error ${response.status}: ${detail.slice(0, 240)}`);
  }
  return response;
}

export async function createDriveFolder(name: string, parentId: string) {
  const response = await driveRequest("/drive/v3/files?supportsAllDrives=true&fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const data = await response.json() as { id: string };
  return data.id;
}

export async function createVendorFolders(folderName: string): Promise<VendorFolderSet> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  if (!rootFolderId) throw new Error("Google Drive main folder connection pending hai");
  const driveFolderId = await createDriveFolder(folderName, rootFolderId);
  const [packingFolderId, returnFolderId, claimsFolderId] = await Promise.all([
    createDriveFolder("New Packing", driveFolderId),
    createDriveFolder("Return", driveFolderId),
    createDriveFolder("Raise Claims", driveFolderId),
  ]);
  return { driveFolderId, packingFolderId, returnFolderId, claimsFolderId };
}

export async function uploadDriveVideo(video: File, parentId: string, filename: string) {
  const boundary = `mpd-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${video.type || "video/webm"}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([prefix, video, suffix]);
  const response = await driveRequest("/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json() as Promise<{ id: string; name: string; mimeType?: string; size?: string }>;
}

export async function copyDriveVideo(fileId: string, parentId: string, filename: string) {
  const response = await driveRequest(`/drive/v3/files/${encodeURIComponent(fileId)}/copy?supportsAllDrives=true&fields=id,name,mimeType`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: filename, parents: [parentId] }),
  });
  return response.json() as Promise<{ id: string; name: string; mimeType?: string }>;
}

export async function getDriveVideo(fileId: string) {
  return driveRequest(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
}

export function driveFileIdFromUrl(videoUrl: string) {
  try {
    const url = new URL(videoUrl, "https://myparceldelivery.in");
    return url.searchParams.get("driveFileId") || "";
  } catch {
    return "";
  }
}

export function driveVideoUrl(fileId: string) {
  return `/api/video?driveFileId=${encodeURIComponent(fileId)}`;
}

export async function appendFollowUpRow(values: Array<string | number>) {
  const sheetId = process.env.GOOGLE_FOLLOWUP_SHEET_ID || "";
  if (!sheetId) throw new Error("Follow Ups Google Sheet connection pending hai");
  const scope = "https://www.googleapis.com/auth/spreadsheets";
  const token = await accessToken(scope);
  const range = encodeURIComponent("'Follow Ups'!A:K");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets error ${response.status}: ${detail.slice(0, 240)}`);
  }
}

export async function appendDeletedVendorRow(values: Array<string | number>) {
  const sheetId = process.env.GOOGLE_DELETED_VENDOR_SHEET_ID || "";
  if (!sheetId) throw new Error("Deleted Vendors Google Sheet connection pending hai");
  const token = await accessToken("https://www.googleapis.com/auth/spreadsheets");
  const range = encodeURIComponent("'Deleted Vendors'!A:K");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets error ${response.status}: ${detail.slice(0, 240)}`);
  }
}
