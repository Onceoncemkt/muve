import { NextResponse } from "next/server";
import { getPaymentCalendarEvents } from "@/modules/calendar/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end params" }, { status: 400 });
  }

  const events = await getPaymentCalendarEvents({ start, end });
  return NextResponse.json(events);
}
