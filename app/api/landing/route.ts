import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const landingDoc = await db.collection("landing").doc("published").get();
    
    if (!landingDoc.exists) {
      return NextResponse.json(null);
    }

    const data = landingDoc.data();
    return NextResponse.json(data);
  } catch (err) {
    console.error("/api/landing GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
