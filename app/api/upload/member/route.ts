import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const miembroId = formData.get("miembroId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
    }

    if (!miembroId) {
      return NextResponse.json({ error: "ID de miembro requerido" }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Use JPG, PNG, WEBP o GIF" },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB" },
        { status: 400 }
      );
    }

    // Convertir archivo a base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: "corazones-cruzados/members",
      public_id: `member_${miembroId}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // Actualizar foto en la base de datos del miembro
    await query(
      "UPDATE miembros SET foto = $1 WHERE id = $2",
      [result.secure_url, miembroId]
    );

    return NextResponse.json({
      success: true,
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Error uploading member photo:", error);
    return NextResponse.json(
      { error: "Error al subir la imagen" },
      { status: 500 }
    );
  }
}
