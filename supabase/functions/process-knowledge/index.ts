import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUMMARIZE_PROMPT = `Summarize the following web page content into a concise knowledge entry. Extract:
1. Key facts and data points
2. Main arguments or insights
3. Relevant quotes or statistics
4. How this could be useful for creating social media content

Keep the summary under 2000 characters. Be specific and factual.

Content:
`;

function stripHtml(html: string): string {
  let text = html.replace(/<(script|style|nav|footer|header|aside|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function summarizeWithAI(text: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const truncated = text.slice(0, 10000);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      messages: [
        { role: "user", content: SUMMARIZE_PROMPT + truncated },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Anthropic API error:", resp.status, errText);
    throw new Error("AI summarization failed");
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "No summary generated.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { knowledge_id, user_id } = await req.json();
    if (!knowledge_id || !user_id) {
      return new Response(JSON.stringify({ error: "knowledge_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("knowledge_base")
      .select("*")
      .eq("id", knowledge_id)
      .eq("user_id", user_id)
      .single();

    if (fetchErr || !item) {
      return new Response(JSON.stringify({ error: "Knowledge item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const type = item.type as string;
    let rawContent = "";
    let summary = "";
    let processingError: string | null = null;

    try {
      if (type === "url") {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const pageResp = await fetch(item.content, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; Threadable/1.0)" } });
        clearTimeout(timeout);

        if (!pageResp.ok) throw new Error(`Failed to fetch URL: ${pageResp.status}`);
        const html = await pageResp.text();
        rawContent = stripHtml(html);

        if (rawContent.length < 50) {
          processingError = "Could not extract meaningful content from this URL.";
        } else {
          summary = await summarizeWithAI(rawContent);
        }
      } else if (type === "document") {
        if (!item.file_path) {
          processingError = "No file uploaded.";
        } else {
          const ext = (item.file_path as string).split(".").pop()?.toLowerCase();

          if (ext === "txt" || ext === "md") {
            const { data: fileData, error: dlErr } = await supabaseAdmin.storage
              .from("knowledge-docs")
              .download(item.file_path);

            if (dlErr || !fileData) {
              processingError = "Failed to download file.";
            } else {
              rawContent = await fileData.text();
              if (rawContent.length < 50) {
                processingError = "File content too short to summarize.";
              } else {
                summary = await summarizeWithAI(rawContent);
              }
            }
          } else if (ext === "pdf") {
            processingError = "PDF text extraction coming soon — the file has been saved and will be processed when this feature is available.";
          } else if (ext === "docx") {
            processingError = "DOCX text extraction coming soon — the file has been saved and will be processed when this feature is available.";
          } else {
            processingError = `Unsupported file format: .${ext}`;
          }
        }
      } else if (type === "video") {
        processingError = "Video transcript extraction coming soon — the URL has been saved.";
      } else {
        processingError = null;
      }
    } catch (e) {
      console.error("Processing error:", e);
      processingError = e instanceof Error ? e.message : "Unknown processing error";
    }

    const updatePayload: Record<string, unknown> = {
      processed: true,
      processing_error: processingError,
    };
    if (rawContent) updatePayload.raw_content = rawContent.slice(0, 100000);
    if (summary) updatePayload.summary = summary;

    const { error: updateErr } = await supabaseAdmin
      .from("knowledge_base")
      .update(updatePayload)
      .eq("id", knowledge_id)
      .eq("user_id", user_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to save processing results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, processed: true, processing_error: processingError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
