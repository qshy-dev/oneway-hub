import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface BotCommandRequest {
  command: string;
  message: string;
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
}

interface BotCommandResponse {
  matched: boolean;
  output: string | null;
  reply: string | null;
}

function processCommand(req: BotCommandRequest): BotCommandResponse {
  const cmd = req.command.toLowerCase();

  switch (cmd) {
    case "test":
      console.log(`Bot command received: !test from ${req.displayName} (@${req.username}) in #${req.channelName}`);
      console.log("test");
      return {
        matched: true,
        output: "test",
        reply: null,
      };

    case "help":
      return {
        matched: true,
        output: null,
        reply: "Available commands: !test, !help",
      };

    case "uptime":
      return {
        matched: true,
        output: null,
        reply: `Bot is online and connected to #${req.channelName}`,
      };

    default:
      return {
        matched: false,
        output: null,
        reply: null,
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: BotCommandRequest = await req.json();

    if (!body.command || !body.message || !body.channelId || !body.channelName || !body.userId || !body.username || !body.displayName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: command, message, channelId, channelName, userId, username, displayName, roles" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `Received bot command "${body.command}" from ${body.displayName} (@${body.username}) in #${body.channelName}`,
    );

    const result = processCommand(body);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("twitch-bot-command error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
