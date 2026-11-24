import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSession } from "@/lib/session";

// Pastikan Route Handler berjalan di Node.js runtime untuk akses filesystem
export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Route Handler untuk unggah lampiran pengajuan cuti.
 * Wajib autentikasi sesi, memvalidasi tipe MIME dan ukuran berkas (maks 5 MB).
 */
export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Sesi tidak valid. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Berkas lampiran tidak ditemukan." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Berkas lampiran kosong." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran berkas melebihi batas maksimal 5 MB." },
        { status: 400 }
      );
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        {
          error:
            "Format berkas tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP.",
        },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "leaves");
    await mkdir(uploadDir, { recursive: true });

    // Buat nama file acak agar aman dari path traversal dan tabrakan nama
    const safeFileName = `${session.id}-${Date.now()}-${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(uploadDir, safeFileName);

    const bytes = await file.arrayBuffer();
    await writeFile(targetPath, Buffer.from(bytes));

    const originalName = path.basename(file.name || `lampiran${ext}`).slice(0, 200);

    return NextResponse.json({
      attachmentPath: `/uploads/leaves/${safeFileName}`,
      attachmentName: originalName,
    });
  } catch (error) {
    console.error("Gagal mengunggah lampiran:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan berkas lampiran. Silakan coba lagi." },
      { status: 500 }
    );
  }
}