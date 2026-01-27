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

    // Verify user is a member
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "Solo miembros pueden subir imágenes" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bidId = formData.get("bidId") as string | null;

    if (!file || !bidId) {
      return NextResponse.json({ error: "Archivo y bidId son requeridos" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Use JPG, PNG, WEBP o GIF" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB" },
        { status: 400 }
      );
    }

    // Verify bid belongs to this member
    const bidResult = await query(
      "SELECT id, imagenes, id_miembro FROM project_bids WHERE id = $1",
      [parseInt(bidId)]
    );
    if (bidResult.rows.length === 0) {
      return NextResponse.json({ error: "Postulación no encontrada" }, { status: 404 });
    }
    if (bidResult.rows[0].id_miembro !== userResult.rows[0].id_miembro) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Check max 5 images
    const currentImages = bidResult.rows[0].imagenes || [];
    if (currentImages.length >= 5) {
      return NextResponse.json(
        { error: "Máximo 5 imágenes por postulación" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: "corazones-cruzados/bid-images",
      transformation: [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // Update bid images (append to JSONB array)
    const updatedImages = [...currentImages, result.secure_url];
    await query(
      "UPDATE project_bids SET imagenes = $1::jsonb WHERE id = $2",
      [JSON.stringify(updatedImages), parseInt(bidId)]
    );

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      imagenes: updatedImages,
    });
  } catch (error) {
    console.error("Error uploading bid image:", error);
    return NextResponse.json(
      { error: "Error al subir la imagen" },
      { status: 500 }
    );
  }
}
