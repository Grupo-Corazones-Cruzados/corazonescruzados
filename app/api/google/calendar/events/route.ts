import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: { email: string }[];
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();

    if (tokens.error) {
      console.error("Token refresh error:", tokens);
      return null;
    }

    // Update stored access token
    await query(
      `UPDATE google_tokens SET access_token = $1, expiry_date = $2, updated_at = NOW() WHERE id = $3`,
      [tokens.access_token, Date.now() + tokens.expires_in * 1000, userId]
    );

    return tokens.access_token;
  } catch (err) {
    console.error("Error refreshing token:", err);
    return null;
  }
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const result = await query(
    `SELECT access_token, refresh_token, expiry_date FROM google_tokens WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenData = result.rows[0];

  // Check if token is expired (with 5 min buffer)
  if (tokenData.expiry_date && tokenData.expiry_date < Date.now() + 300000) {
    if (tokenData.refresh_token) {
      return refreshAccessToken(userId, tokenData.refresh_token);
    }
    return null;
  }

  return tokenData.access_token;
}

// CREATE event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, event } = body as { userId: string; event: CalendarEvent };

    if (!userId || !event) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected", code: "not_connected" },
        { status: 401 }
      );
    }

    // Create event with Google Meet
    const eventWithMeet = {
      ...event,
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventWithMeet),
      }
    );

    const result = await response.json();

    if (result.error) {
      console.error("Google Calendar API error:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: response.status }
      );
    }

    return NextResponse.json({
      eventId: result.id,
      htmlLink: result.htmlLink,
      hangoutLink: result.hangoutLink,
    });
  } catch (err) {
    console.error("Error creating calendar event:", err);
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}

// UPDATE event
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventId, event } = body as {
      userId: string;
      eventId: string;
      event: Partial<CalendarEvent>;
    };

    if (!userId || !eventId || !event) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected", code: "not_connected" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    const result = await response.json();

    if (result.error) {
      console.error("Google Calendar API error:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: response.status }
      );
    }

    return NextResponse.json({
      eventId: result.id,
      htmlLink: result.htmlLink,
    });
  } catch (err) {
    console.error("Error updating calendar event:", err);
    return NextResponse.json(
      { error: "Failed to update calendar event" },
      { status: 500 }
    );
  }
}

// DELETE event
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const eventId = searchParams.get("eventId");

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected", code: "not_connected" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const result = await response.json();
      console.error("Google Calendar API error:", result.error);
      return NextResponse.json(
        { error: result.error?.message || "Failed to delete event" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting calendar event:", err);
    return NextResponse.json(
      { error: "Failed to delete calendar event" },
      { status: 500 }
    );
  }
}
