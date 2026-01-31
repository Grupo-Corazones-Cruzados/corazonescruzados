import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createToken, setAuthCookie } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Extract IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    // Check if IP is blocked
    if (ip !== "unknown") {
      const blockedIp = await query(
        "SELECT id FROM blocked_ips WHERE ip_address = $1 LIMIT 1",
        [ip]
      );
      if (blockedIp.rows.length > 0) {
        return NextResponse.json(
          { error: "Acceso bloqueado. Contacta al administrador." },
          { status: 403 }
        );
      }
    }

    // Find user
    const result = await query(
      `SELECT id, email, password_hash, nombre, apellido, avatar_url, telefono, rol, id_miembro, verificado, estado
       FROM user_profiles WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Check if user is blocked (suspendido or baneado)
    if (user.estado === "suspendido" || user.estado === "baneado") {
      return NextResponse.json(
        { error: "Tu cuenta ha sido suspendida. Contacta al administrador." },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Update last login and IP
    await query(
      `UPDATE user_profiles SET last_login = NOW(), last_ip = $1 WHERE id = $2`,
      [ip, user.id]
    );

    // Create JWT token
    const token = await createToken({ userId: user.id, email: user.email });
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        avatar_url: user.avatar_url,
        telefono: user.telefono,
        rol: user.rol,
        id_miembro: user.id_miembro,
        verificado: user.verificado,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
