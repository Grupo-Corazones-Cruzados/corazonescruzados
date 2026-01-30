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
    const productId = formData.get("productId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo es requerido" }, { status: 400 });
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

    // If productId provided, verify ownership and check max images
    let currentImages: string[] = [];
    if (productId) {
      const productResult = await query(
        "SELECT id, imagenes, id_miembro FROM productos WHERE id = $1",
        [parseInt(productId)]
      );
      if (productResult.rows.length === 0) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }
      if (productResult.rows[0].id_miembro !== userResult.rows[0].id_miembro) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      currentImages = productResult.rows[0].imagenes || [];
      if (currentImages.length >= 8) {
        return NextResponse.json(
          { error: "Máximo 8 imágenes por producto" },
          { status: 400 }
        );
      }
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: "corazones-cruzados/product-images",
      transformation: [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // If productId provided, update product images
    if (productId) {
      const updatedImages = [...currentImages, result.secure_url];
      await query(
        "UPDATE productos SET imagenes = $1::jsonb WHERE id = $2",
        [JSON.stringify(updatedImages), parseInt(productId)]
      );

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        imagenes: updatedImages,
      });
    }

    // Otherwise just return the URL (for new products being created)
    return NextResponse.json({
      success: true,
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Error uploading product image:", error);
    return NextResponse.json(
      { error: "Error al subir la imagen" },
      { status: 500 }
    );
  }
}

// DELETE - Remove image from product
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const imageUrl = searchParams.get("imageUrl");

    if (!productId || !imageUrl) {
      return NextResponse.json({ error: "productId e imageUrl son requeridos" }, { status: 400 });
    }

    // Verify ownership
    const productResult = await query(
      "SELECT id, imagenes, id_miembro FROM productos WHERE id = $1",
      [parseInt(productId)]
    );
    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (productResult.rows[0].id_miembro !== userResult.rows[0].id_miembro) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const currentImages: string[] = productResult.rows[0].imagenes || [];
    const updatedImages = currentImages.filter((url) => url !== imageUrl);

    await query(
      "UPDATE productos SET imagenes = $1::jsonb WHERE id = $2",
      [JSON.stringify(updatedImages), parseInt(productId)]
    );

    return NextResponse.json({
      success: true,
      imagenes: updatedImages,
    });
  } catch (error) {
    console.error("Error removing product image:", error);
    return NextResponse.json(
      { error: "Error al eliminar la imagen" },
      { status: 500 }
    );
  }
}
